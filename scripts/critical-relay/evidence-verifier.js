'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { EVIDENCE_PROFILE, isObject, isDigest, boundedPath, readJson, readText, loadPlan,
  digestObject, hash, sourceSnapshot } = require('./test-plan');
const { parseTestOutput } = require('./evidence-parser');
const { RUN_SCHEMA, engineDigest } = require('./test-runner');
const FULL_MODE = 'FULL_AUTOMATIC_RELAY';

function validateBinding(root, binding) {
  if (!isObject(binding) || binding.profile !== EVIDENCE_PROFILE || !isDigest(binding.planDigest) ||
      typeof binding.planPath !== 'string' || binding.planPath.startsWith('.cr/')) throw new Error('缺少有效的事前測試計劃 binding');
  boundedPath(root, binding.planPath);
  const plan = loadPlan(root, binding.planPath);
  if (digestObject(plan) !== binding.planDigest) throw new Error('目前計劃與固定 binding 不一致');
  return { profile: binding.profile, planPath: binding.planPath, planDigest: binding.planDigest };
}

function latchBinding(root, state, previous) {
  const candidate = state?.executionContract?.verificationBinding;
  const required = state?.mode === FULL_MODE || candidate !== undefined || previous !== undefined;
  if (!required) return undefined;
  if (state?.mode !== FULL_MODE || state?.executionContractRequired !== true) throw new Error('完整交付驗證模式不可降級');
  if (state.executionContract?.schemaVersion !== 'pixiu.cr-execution.v2') throw new Error('完整交付需遷移至 v2 執行契約並重驗');
  const binding = validateBinding(root, candidate);
  if (previous && digestObject(previous) !== digestObject(binding)) throw new Error('事前固定的驗證 binding 不可更換或刪除');
  return binding;
}

function verifyRun(root, binding, runRef) {
  const blockingReasons = [];
  let report = null, plan = null;
  try {
    validateBinding(root, binding);
    if (!isObject(runRef) || typeof runRef.runId !== 'string' ||
        !/^[a-f0-9-]{36}$/u.test(runRef.runId) || runRef.resultPath !== `.cr/runs/${runRef.runId}/result.json`) {
      throw new Error('不合法的本機執行證據定位');
    }
    const prefix = `.cr/runs/${runRef.runId}`;
    report = readJson(root, runRef.resultPath);
    plan = loadPlan(root, binding.planPath);
    if (report.schemaVersion !== RUN_SCHEMA || report.runId !== runRef.runId || report.planPath !== binding.planPath ||
        report.planDigest !== binding.planDigest || report.profile !== plan.profile || report.engineDigest !== engineDigest()) {
      throw new Error('執行 ID、計劃或驗證引擎版本不一致');
    }
    if (digestObject(readJson(root, `${prefix}/plan.json`)) !== binding.planDigest) throw new Error('執行前計劃快照不一致');
    if (report.outcome !== 'PASS' || typeof report.endedAt !== 'string' ||
        !Number.isFinite(Date.parse(report.startedAt)) || !Number.isFinite(Date.parse(report.endedAt)) ||
        Date.parse(report.endedAt) < Date.parse(report.startedAt)) throw new Error('執行未完整成功，RUNNING 視為未完成');
    const actualSource = sourceSnapshot(root);
    if (digestObject(actualSource) !== digestObject(report.sourceBefore) ||
        digestObject(actualSource) !== digestObject(report.sourceAfter)) throw new Error('實際工作區與受測來源不同，必須重驗');
    if (!Array.isArray(report.commands) || report.commands.length !== plan.commands.length ||
        new Set(report.commands.map(item => item.commandId)).size !== report.commands.length) throw new Error('測試結果缺漏或重複');
    for (const expected of plan.commands) {
      const result = report.commands.find(item => item.commandId === expected.id);
      if (!result || result.runId !== report.runId || result.planDigest !== binding.planDigest ||
          result.evidenceKind !== expected.evidenceKind) throw new Error(`命令結果或證據種類不符：${expected.id}`);
      if (result.stdoutPath !== `${prefix}/${expected.id}.stdout.jsonl` || result.stderrPath !== `${prefix}/${expected.id}.stderr.log`) {
        throw new Error(`證據路徑不屬於本次執行：${expected.id}`);
      }
      const stdout = readText(root, result.stdoutPath), stderr = readText(root, result.stderrPath);
      if (hash(stdout) !== result.stdoutDigest || hash(stderr) !== result.stderrDigest) throw new Error(`證據內容指紋不符：${expected.id}`);
      if (!expected.required && result.outcome !== 'PASS') continue;
      const expectedArgv = ['--test', '--test-reporter', pathToFileURL(path.join(__dirname, 'evidence-reporter.js')).href,
        boundedPath(root, expected.file)];
      if (result.outcome !== 'PASS' || result.exitCode !== 0 || result.signal !== null ||
          digestObject(result.argv) !== digestObject(expectedArgv) || result.executable !== process.execPath ||
          result.cwd !== fs.realpathSync(root) || result.tool?.version !== process.version || result.tool?.platform !== process.platform ||
          !Number.isFinite(Date.parse(result.startedAt)) || !Number.isFinite(Date.parse(result.endedAt)) ||
          Date.parse(result.endedAt) < Date.parse(result.startedAt)) {
        throw new Error(`必要測試未成功或 runtime 不符：${expected.id}`);
      }
      const parsed = parseTestOutput(stdout);
      if (!parsed.clean || digestObject(parsed.counts) !== digestObject(result.counts)) throw new Error(`必要測試零筆、未通過或統計矛盾：${expected.id}`);
    }
    for (const criterion of plan.criteria) {
      const kinds = new Set(plan.commands.filter(command => command.required && command.criterionRefs.includes(criterion.id) &&
        report.commands.find(item => item.commandId === command.id)?.outcome === 'PASS').map(command => command.evidenceKind));
      if (criterion.requiredEvidenceKinds.some(kind => !kinds.has(kind))) throw new Error(`缺少驗收證據種類：${criterion.id}`);
    }
  } catch (error) { blockingReasons.push(error.message); }
  return { canComplete: blockingReasons.length === 0, blockingReasons, report, plan };
}

function verifyStateEvidence(state, root, trustedBinding) {
  const binding = state?.executionContract?.verificationBinding;
  if (state?.mode !== FULL_MODE && binding === undefined && trustedBinding === undefined) return { canComplete: true, blockingReasons: [] };
  try {
    const locked = latchBinding(root, state, trustedBinding);
    const contract = state.executionContract;
    const checked = verifyRun(root, locked, contract.verificationRun);
    if (!checked.canComplete) return checked;
    const { report, plan } = checked;
    if (contract.source?.headSha !== report.sourceAfter.headSha || contract.source?.changeDigest !== report.sourceAfter.changeDigest ||
        contract.verification?.headSha !== report.sourceAfter.headSha || contract.verification?.changeDigest !== report.sourceAfter.changeDigest) {
      throw new Error('CR state 與實測來源不一致');
    }
    const criterionIds = (state.completionCriteria || []).map(item => item.id).sort();
    if (digestObject(criterionIds) !== digestObject(plan.criteria.map(item => item.id).sort())) throw new Error('CR 驗收條件與事前計劃不一致');
    for (const command of plan.commands.filter(item => item.required)) {
      const declared = state.tests?.find(item => item.id === command.id);
      const actual = report.commands.find(item => item.commandId === command.id);
      if (!declared || declared.required !== true || declared.status !== 'passed' || declared.exitCode !== actual.exitCode ||
          declared.outputRef !== `file:${actual.stdoutPath}` || declared.headSha !== report.sourceAfter.headSha ||
          declared.changeDigest !== report.sourceAfter.changeDigest) throw new Error(`CR 必要測試遭刪除、降級或證據不符：${command.id}`);
    }
    return { canComplete: true, blockingReasons: [], runId: report.runId };
  } catch (error) { return { canComplete: false, blockingReasons: [error.message] }; }
}

module.exports = { validateBinding, latchBinding, verifyRun, verifyStateEvidence };
