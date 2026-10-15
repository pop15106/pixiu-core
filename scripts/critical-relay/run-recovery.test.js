'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fork, spawn, spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { makeFixture } = require('./test-support');
const { recoverRun, processIdentity, pidStatus } = require('./run-recovery');
const { readJson, atomicJson, boundedPath } = require('./test-plan');
const { createRunJournal } = require('./run-journal');
const { runPlan } = require('./test-runner');

async function holder(t, mode = 'running') {
  const fixture = makeFixture(t);
  const runId = randomUUID();
  const child = fork(path.join(__dirname, 'fixtures/recovery-holder.cjs'), [fixture.root, runId, mode], { silent: true });
  const exit = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await exit; });
  let errors = '';
  child.stderr.on('data', value => { errors += value; });
  await Promise.race([
    once(child, 'message'),
    exit.then(() => { throw new Error(`中性測試程序提前結束：${errors}`); }),
    new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('等待測試程序超時')), 20000); timer.unref(); })
  ]);
  return { ...fixture, runId, child, exit, kill: async () => { child.kill('SIGKILL'); await exit; } };
}

test('命令尚未結束時完整事件已落盤，截斷尾端不冒充完整行', async t => {
  const f = await holder(t);
  const output = fs.readFileSync(path.join(f.root, `.cr/runs/${f.runId}/sample.stdout.jsonl`), 'utf8');
  assert.equal(output.trim().split('\n').length, 1);
  assert.doesNotMatch(output, /unfinished/);
  const progress = readJson(f.root, `.cr/runs/${f.runId}/sample.progress.json`);
  assert.equal(progress.eventCount, 1);
  assert.equal(progress.complete, false);
  assert.equal(progress.stdoutBytes, Buffer.byteLength(output));
  await f.kill();
});

test('活主控即使鎖齡很舊也拒絕恢復，不終止程序', async t => {
  const f = await holder(t);
  const lock = readJson(f.root, '.cr/runner.lock'); lock.createdAt = '2000-01-01T00:00:00Z';
  atomicJson(f.root, '.cr/runner.lock', lock);
  assert.throws(() => recoverRun(f.root, { runId: f.runId, authorized: true }), /OWNER_ALIVE/);
  assert.equal(pidStatus(f.child.pid), 'ALIVE');
  await f.kill();
});

test('硬終止後恢復保留原結果、已完成事件與鎖歷史，整輪標 INTERRUPTED', async t => {
  const f = await holder(t);
  const original = readJson(f.root, `.cr/runs/${f.runId}/result.json`);
  await f.kill();
  const recovered = recoverRun(f.root, { runId: f.runId, authorized: true });
  assert.equal(recovered.outcome, 'INTERRUPTED');
  assert.equal(recovered.processesKilled, 0);
  assert.deepEqual(readJson(f.root, `.cr/runs/${f.runId}/recoveries/${recovered.recoveryId}/before.json`), original);
  const result = readJson(f.root, recovered.resultPath);
  assert.equal(result.commands[0].outcome, 'PASS');
  assert.equal(result.interruptedCommandId, 'sample');
  assert.equal(fs.existsSync(path.join(f.root, '.cr/runner.lock')), false);
  assert.throws(() => recoverRun(f.root, { runId: f.runId, authorized: true }), /ENOENT/);
  const rerun = await runPlan({ workspaceRoot: f.root, planPath: f.planPath });
  assert.notEqual(rerun.runId, f.runId);
  assert.equal(rerun.outcome, 'PASS');
});

test('初始化中斷且沒有 result 仍保存缺失事實，不造成功結果', async t => {
  const f = await holder(t, 'init-only');
  await f.kill();
  const recovered = recoverRun(f.root, { runId: f.runId, authorized: true });
  assert.equal(recovered.outcome, 'INTERRUPTED');
  const result = readJson(f.root, recovered.resultPath);
  assert.deepEqual(result.commands, []);
  assert.match(result.reason, /初始化/);
});

test('未授權、錯 run、錯 owner、錯工作區及不完整鎖都拒絕', async t => {
  const f = await holder(t);
  await f.kill();
  const original = readJson(f.root, '.cr/runner.lock');
  assert.throws(() => recoverRun(f.root, { runId: f.runId }), /AUTHORIZATION/);
  assert.throws(() => recoverRun(f.root, { runId: randomUUID(), authorized: true }), /IDENTITY_MISMATCH/);
  for (const mutate of [x => { x.owner += '-other'; }, x => { x.hostname += '-other'; },
    x => { x.workspaceRoot += '-other'; }, x => { delete x.birth; }, x => { x.schemaVersion = 'old'; }]) {
    const changed = structuredClone(original); mutate(changed); atomicJson(f.root, '.cr/runner.lock', changed);
    assert.throws(() => recoverRun(f.root, { runId: f.runId, authorized: true }), /IDENTITY_MISMATCH/);
  }
  atomicJson(f.root, '.cr/runner.lock', original);
  assert.equal(recoverRun(f.root, { runId: f.runId, authorized: true }).outcome, 'INTERRUPTED');
});

test('活子程序、PID 重用或尚未確認的啟動窗口保持阻擋', async t => {
  const f = await holder(t); await f.kill();
  const original = readJson(f.root, '.cr/runner.lock');
  const live = { ...original, children: [processIdentity()] };
  atomicJson(f.root, '.cr/runner.lock', live);
  assert.throws(() => recoverRun(f.root, { runId: f.runId, authorized: true }), /CHILD_ALIVE/);
  assert.equal(pidStatus(process.pid), 'ALIVE');
  atomicJson(f.root, '.cr/runner.lock', { ...original, launchPending: true });
  assert.throws(() => recoverRun(f.root, { runId: f.runId, authorized: true }), /UNCONFIRMED_CHILD/);
});

test('兩個恢復程序同時競爭，只允許一個成功歸檔', async t => {
  const f = await holder(t); await f.kill();
  const execute = () => new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(__dirname, 'run-recovery.js'), 'recover', f.runId, '--authorized'],
      { cwd: f.root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.resume(); child.stderr.resume(); child.on('close', code => resolve(code));
  });
  const results = await Promise.all([execute(), execute()]);
  assert.equal(results.filter(code => code === 0).length, 1);
  assert.equal(results.filter(code => code === 2).length, 1);
});

test('日誌逐行遮蔽跨 chunk token，未閉合 stdout 只留 digest', t => {
  const f = makeFixture(t);
  fs.mkdirSync(path.join(f.root, '.cr/runs/sample'), { recursive: true });
  const journal = createRunJournal(f.root, '.cr/runs/sample', 'command');
  journal.append('password=fixture-', 'stderr');
  journal.append('secret-123456\n', 'stderr');
  journal.append('{"record":', 'stdout');
  journal.close();
  assert.doesNotMatch(fs.readFileSync(path.join(f.root, journal.stderrPath), 'utf8'), /fixture-secret/);
  assert.equal(fs.readFileSync(path.join(f.root, journal.stdoutPath), 'utf8'), '');
  assert.equal(readJson(f.root, '.cr/runs/sample/command.progress.json').partialStdout, true);
});

test('真實 test-runner 執行中整棵測試程序終止，仍可回讀已落盤事件並安全恢復', async t => {
  const f = makeFixture(t, ["const test=require('node:test'); test('先完成',()=>{}); test('等待終止',async()=>{await new Promise(resolve=>setTimeout(resolve,60000));});"], plan => { plan.commands[0].timeoutMs = 60000; });
  const child = spawn(process.execPath, [path.join(__dirname, 'test-runner.js'), 'plan.json'], {
    cwd: f.root, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.resume(); child.stderr.resume();
  const closed = new Promise(resolve => child.once('close', resolve));
  const stop = () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    if (process.platform === 'win32') spawnSync(path.join(process.env.SystemRoot, 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 10000 });
    else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
  };
  t.after(async () => { stop(); await closed; });
  let runId, progress;
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    try {
      const lock = readJson(f.root, '.cr/runner.lock');
      runId = lock.runId;
      progress = readJson(f.root, `.cr/runs/${runId}/command-0.progress.json`);
      if (progress.eventCount > 0 && !lock.launchPending && lock.children.length > 0) break;
    } catch { /* 等待真實 runner 完成第一筆事件持久化。 */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(progress?.eventCount > 0, '應在終止前看到已持久化的完整事件');
  stop(); await closed;
  const output = fs.readFileSync(path.join(f.root, `.cr/runs/${runId}/command-0.stdout.jsonl`), 'utf8');
  assert.match(output, /先完成/);
  const recovered = recoverRun(f.root, { runId, authorized: true });
  assert.equal(recovered.outcome, 'INTERRUPTED');
  assert.equal(recovered.processesKilled, 0);
  assert.equal(readJson(f.root, recovered.resultPath).interruptedCommandId, 'command-0');
});

test('reporter 將跨 chunk 的 stdout 密鑰合成完整行後才去敏', async () => {
  const reporter = require('./evidence-reporter');
  async function* input() {
    yield { type: 'test:stdout', data: { file: 'fixture', message: 'password=fixture-' } };
    yield { type: 'test:stdout', data: { file: 'fixture', message: 'private-token-1234\n' } };
    yield { type: 'test:summary', data: { success: true, counts: { tests: 0, failed: 0, cancelled: 0, skipped: 0, todo: 0 } } };
  }
  let output = '';
  for await (const part of reporter(input())) output += part;
  assert.doesNotMatch(output, /fixture-private-token/);
  assert.match(output, /REDACTED/);
});
