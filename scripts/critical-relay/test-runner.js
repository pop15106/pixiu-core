#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { boundedPath, loadPlan, digestObject, sourceSnapshot, atomicJson, hash, redact, bindPlan } = require('./test-plan');
const { parseTestOutput } = require('./evidence-parser');
const { decideRecovery } = require('./execution-contract');
const { createRunJournal } = require('./run-journal');
const { acquireRunLock } = require('./run-recovery');

const RUN_SCHEMA = 'pixiu.test-run.v1';
const MAX_OUTPUT = 4 * 1024 * 1024;

function engineDigest() {
  return digestObject(['test-plan.js', 'test-runner.js', 'evidence-parser.js', 'evidence-reporter.js',
    'evidence-verifier.js', 'execution-contract.js', 'relay-evidence.js', 'run-journal.js', 'run-recovery.js', 'process-identity.js', 'auxiliary-lock.js', 'plan-migration.js', '../router/resource-policy.js']
    .map(name => [name, hash(fs.readFileSync(path.join(__dirname, name)))]));
}

function childEnvironment(runId) {
  // 不傳遞憑證、NODE_OPTIONS 或外層測試 runner 的內部環境。
  const env = {};
  for (const name of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'TEMP', 'TMP', 'TMPDIR', 'LANG']) {
    if (process.env[name] !== undefined) env[name] = process.env[name];
  }
  env.CR_TEST_RUN_ID = runId;
  return env;
}

function terminateTree(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    const binary = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
    spawnSync(binary, ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 3000, stdio: 'ignore' });
    try { child.kill('SIGKILL'); } catch { /* 程序已結束時保留原始結果。 */ }
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* 已結束。 */ } }
  }
}

function execute(root, command, runId, signal, journal, runLock) {
  const startedAt = new Date().toISOString();
  const base = { commandId: command.id, evidenceKind: command.evidenceKind, startedAt,
    tool: { name: 'node', version: process.version, platform: process.platform }, exitCode: null, signal: null };
  if (signal?.aborted) return Promise.resolve({ ...base, outcome: 'CANCELLED', stdout: '', stderr: '', endedAt: startedAt });
  let file;
  try { file = boundedPath(root, command.file); }
  catch (error) { return Promise.resolve({ ...base, outcome: 'ENV_BLOCKED', stdout: '', stderr: error.code || error.message, endedAt: startedAt }); }
  // Node 的 reporter 經 ESM 載入；Windows 絕對路徑須先轉成 file URL。
  const args = ['--test', '--test-reporter', pathToFileURL(path.join(__dirname, 'evidence-reporter.js')).href, file];
  return new Promise(resolve => {
    runLock.launching();
    const child = spawn(process.execPath, args, { cwd: root, env: childEnvironment(runId),
      windowsHide: true, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', forced = null, size = 0, spawnError = null;
    let finished = false;
    const stop = reason => { if (!forced) forced = reason; terminateTree(child); };
    const aborted = () => stop('CANCELLED');
    const timer = setTimeout(() => stop('TIMEOUT'), command.timeoutMs);
    child.once('spawn', () => {
      try { runLock.spawned(child.pid); }
      catch (error) { spawnError = error.message; stop('IDENTITY_ERROR'); }
    });
    signal?.addEventListener('abort', aborted, { once: true });
    // 註冊之間發生取消，也必須停止本次程序。
    if (signal?.aborted) aborted();
    function collect(value, stream) {
      size += Buffer.byteLength(value);
      if (size > MAX_OUTPUT) { stop('OUTPUT_LIMIT'); return; }
      try { if (journal.append(value, stream).outputLimit) { stop('OUTPUT_LIMIT'); return; } }
      catch (error) { spawnError = error.code || error.message; stop('JOURNAL_ERROR'); return; }
      if (stream === 'stdout') stdout += value; else stderr += value;
    }
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', value => collect(value, 'stdout'));
    child.stderr.on('data', value => collect(value, 'stderr'));
    child.on('error', error => { spawnError = error.code || error.message; });
    child.on('close', (exitCode, exitSignal) => {
      if (finished) return;
      finished = true; clearTimeout(timer); signal?.removeEventListener('abort', aborted);
      try { runLock.exited(child.pid); } catch (error) { forced = 'LOCK_ERROR'; spawnError = error.message; }
      let parsed = null, parseError = null;
      try { parsed = parseTestOutput(stdout); } catch (error) { parseError = error.message; }
      const outcome = forced || (spawnError ? 'ENV_BLOCKED' : exitSignal ? 'INTERRUPTED'
        : exitCode !== 0 ? 'FAIL' : !parsed ? 'PARSE_ERROR' : parsed.counts.total === 0 ? 'ZERO_TESTS'
          : parsed.clean ? 'PASS' : 'FAIL');
      resolve({ ...base, executable: process.execPath, cwd: root, argv: args,
        endedAt: new Date().toISOString(), exitCode, signal: exitSignal, outcome,
        counts: parsed?.counts || null, parseError, spawnError, stdout, stderr });
    });
  });
}

function recoveryFor(result, history = [], { authorizedRepair = false, newEvidence = false } = {}) {
  const failed = result.commands.filter(item => item.outcome !== 'PASS');
  const fingerprint = digestObject(failed.map(item => ({ commandId: item.commandId, outcome: item.outcome,
    failures: item.failures || [] })));
  const unique = [...new Map(history.filter(item => item.runId !== result.runId).map(item => [item.runId, item])).values()];
  let consecutiveFailures = failed.length ? 1 : 0;
  for (let index = unique.length - 1; failed.length && index >= 0; index--) {
    if (unique[index].fingerprint !== fingerprint || unique[index].outcome === 'PASS') break;
    consecutiveFailures++;
  }
  const hardBlocker = result.commands.some(item => ['ENV_BLOCKED', 'CANCELLED', 'INTERRUPTED', 'NOT_RUN'].includes(item.outcome)) || result.outcome === 'SOURCE_CHANGED';
  return { runId: result.runId, outcome: result.outcome, fingerprint, consecutiveFailures,
    nextAction: result.outcome === 'PASS' ? 'VERIFY'
      : decideRecovery({ authorized: authorizedRepair, hardBlocker, consecutiveFailures, newEvidence }) };
}

async function runPlan({ workspaceRoot, planPath = 'scripts/critical-relay/public-core.plan.json', expectedPlanDigest,
  signal, onProgress = () => {}, history = [], authorizedRepair = false } = {}) {
  const root = fs.realpathSync(workspaceRoot || process.cwd());
  const plan = loadPlan(root, planPath);
  const planDigest = digestObject(plan);
  if (expectedPlanDigest && expectedPlanDigest !== planDigest) throw new Error('事前固定的計劃指紋不一致');
  const sourceBefore = sourceSnapshot(root);
  const crDir = boundedPath(root, '.cr', { mustExist: false });
  fs.mkdirSync(crDir, { recursive: true });
  const runId = randomUUID();
  const runLock = acquireRunLock(root, runId);
  const runPath = `.cr/runs/${runId}`;
  const resultPath = `${runPath}/result.json`;
  const result = { schemaVersion: RUN_SCHEMA, runId, planPath, planDigest, profile: plan.profile,
    engineDigest: engineDigest(), startedAt: new Date().toISOString(), endedAt: null,
    sourceBefore, sourceAfter: null, outcome: 'RUNNING', commands: [], executionOwner: runLock.identity, currentCommandId: null };
  try {
    fs.mkdirSync(boundedPath(root, runPath, { mustExist: false }), { recursive: true });
    atomicJson(root, `${runPath}/plan.json`, plan);
    atomicJson(root, resultPath, result);
    for (const command of plan.commands) {
      result.currentCommandId = command.id;
      atomicJson(root, resultPath, result);
      onProgress({ runId, commandId: command.id, status: 'RUNNING' });
      const journal = createRunJournal(root, runPath, command.id);
      const blocked = (command.dependsOn || []).some(id => result.commands.find(item => item.commandId === id)?.outcome !== 'PASS');
      let raw;
      try {
        raw = blocked || signal?.aborted
          ? { commandId: command.id, evidenceKind: 'test', outcome: signal?.aborted ? 'CANCELLED' : 'NOT_RUN',
            exitCode: null, counts: null, signal: null, startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), stdout: '', stderr: '' }
          : await execute(root, command, runId, signal, journal, runLock);
      } finally { journal.close(); }
      const stdoutPath = `${runPath}/${command.id}.stdout.jsonl`;
      const stderrPath = `${runPath}/${command.id}.stderr.log`;
      // 回讀已逐行去敏並落盤的事件，不用記憶體摘要取代證據。
      const stdout = fs.readFileSync(boundedPath(root, stdoutPath), 'utf8');
      const stderr = fs.readFileSync(boundedPath(root, stderrPath), 'utf8');
      const { stdout: ignoredStdout, stderr: ignoredStderr, ...record } = raw;
      try {
        record.failures = parseTestOutput(stdout).cases.filter(item => item.status !== 'passed')
          .map(item => ({ name: item.name, status: item.status, code: item.error?.code || null }));
      } catch { record.failures = []; }
      result.commands.push({ ...record, runId, planDigest, stdoutPath, stdoutDigest: hash(stdout),
        stderrPath, stderrDigest: hash(stderr) });
      atomicJson(root, resultPath, result);
      onProgress({ runId, commandId: command.id, status: raw.outcome, counts: raw.counts });
    }
    result.currentCommandId = null;
    result.sourceAfter = sourceSnapshot(root);
    const sourceStable = digestObject(sourceBefore) === digestObject(result.sourceAfter);
    const planStable = digestObject(loadPlan(root, planPath)) === planDigest;
    result.outcome = !sourceStable || !planStable || result.engineDigest !== engineDigest() ? 'SOURCE_CHANGED'
      : plan.commands.some(command => command.required && result.commands.find(item => item.commandId === command.id)?.outcome !== 'PASS') ? 'FAIL' : 'PASS';
    result.endedAt = new Date().toISOString();
    result.recovery = recoveryFor(result, history, { authorizedRepair });
    atomicJson(root, resultPath, result);
    return { ...result, resultPath };
  } finally {
    runLock.release();
  }
}

if (require.main === module) {
  const [planPath = 'scripts/critical-relay/public-core.plan.json', expectedPlanDigest] = process.argv.slice(2);
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  process.once('SIGTERM', () => controller.abort());
  runPlan({ workspaceRoot: process.cwd(), planPath, expectedPlanDigest, signal: controller.signal,
    onProgress: event => console.log(JSON.stringify(event)) })
    .then(result => {
      const { verifyRun } = require('./evidence-verifier');
      const checked = result.outcome === 'PASS' ? verifyRun(process.cwd(), bindPlan(process.cwd(), planPath), result)
        : { canComplete: false, blockingReasons: ['必要測試尚未通過'] };
      console.log(JSON.stringify({ outcome: result.outcome, evidenceVerification: checked.canComplete ? 'PASS' : 'FAIL',
        blockingReasons: checked.blockingReasons, runId: result.runId, resultPath: result.resultPath,
        planDigest: result.planDigest, source: result.sourceAfter }));
      process.exitCode = result.outcome === 'PASS' && checked.canComplete ? 0 : 1;
    })
    .catch(error => { console.error(redact(error.message)); process.exitCode = 2; });
}
module.exports = { RUN_SCHEMA, engineDigest, runPlan, recoveryFor };
