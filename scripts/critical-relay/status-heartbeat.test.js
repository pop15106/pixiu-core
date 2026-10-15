'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { startRunHeartbeat, readRunStatus, readLifecycleStage, latestRunId } = require('./status-heartbeat');
const { watch, statusOnce } = require('./status-watch');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-cr-status-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, runId: randomUUID() };
}
function runner(f, now, extra) {
  fs.mkdirSync(path.join(f.root, '.cr/runs', f.runId), { recursive: true });
  return startRunHeartbeat(f.root, { runId: f.runId, totalCommands: 3, now: () => new Date(now.value), ...extra });
}
function saveResult(f, outcome) {
  fs.writeFileSync(path.join(f.root, '.cr/runs', f.runId, 'result.json'),
    JSON.stringify({ runId: f.runId, outcome, endedAt: new Date().toISOString() }));
}

test('開啟即持久化可輪詢狀態，但不能當作測試成功', t => {
  const f = fixture(t);
  const now = { value: Date.parse('2026-10-15T08:00:00.000Z') };
  const heartbeat = runner(f, now);
  t.after(() => heartbeat.close());
  assert.equal(latestRunId(f.root), f.runId);
  const observed = readRunStatus(f.root, f.runId, { nowMs: now.value });
  assert.equal(observed.observed, 'RUNNING_HEARTBEAT_FRESH');
  assert.equal(observed.completedCommands, 0);
  assert.equal(observed.totalCommands, 3);
  assert.equal(observed.heartbeatSeq, 1);
  assert.equal(observed.currentCommandId, null);
  assert.ok(!('taskDescription' in observed));
});

test('同一個 run 顯示當前命令、完成數與進度時間', t => {
  const f = fixture(t);
  const now = { value: Date.parse('2026-10-15T08:00:00.000Z') };
  const heartbeat = runner(f, now);
  t.after(() => heartbeat.close());
  now.value += 3000;
  heartbeat.progress({ commandId: 'core-cr', status: 'RUNNING', doneCount: 0 });
  assert.equal(statusOnce(f.root, f.runId).currentCommandId, 'core-cr');
  now.value += 1000;
  heartbeat.progress({ commandId: 'core-cr', status: 'PASS', doneCount: 1 });
  const checked = readRunStatus(f.root, f.runId, { nowMs: now.value });
  assert.equal(checked.completedCommands, 1);
  assert.equal(checked.progressAgeMs, 0);
  assert.equal(checked.currentCommandId, null);
});

test('能讀取現有 journal 事件數，不靠印出 PASS 宣告成功', t => {
  const f = fixture(t), now = { value: Date.parse('2026-10-15T08:00:00.000Z') };
  const heartbeat = runner(f, now);
  t.after(() => heartbeat.close());
  heartbeat.progress({ commandId: 'core-cr', status: 'RUNNING' });
  fs.writeFileSync(path.join(f.root, '.cr/runs', f.runId, 'core-cr.progress.json'),
    JSON.stringify({ schemaVersion: 'pixiu.run-journal.v1', eventCount: 36, complete: false }));
  const status = readRunStatus(f.root, f.runId, { nowMs: now.value });
  assert.equal(status.journalEvents, 36);
  assert.equal(status.outcome, 'RUNNING');
  assert.equal(status.observed, 'RUNNING_HEARTBEAT_FRESH');
});

test('程序沒有新案例時仍定期心跳，不把靜默誤認為失敗', async t => {
  const f = fixture(t), now = { value: Date.parse('2026-10-15T08:00:00.000Z') };
  const heartbeat = runner(f, now, { intervalMs: 1000 });
  t.after(() => heartbeat.close());
  const before = readRunStatus(f.root, f.runId, { nowMs: now.value });
  now.value += 300000;
  await new Promise(resolve => setTimeout(resolve, 1150));
  const after = readRunStatus(f.root, f.runId, { nowMs: now.value });
  assert.ok(after.heartbeatSeq > before.heartbeatSeq);
  assert.equal(after.observed, 'RUNNING_HEARTBEAT_FRESH');
  assert.ok(after.progressAgeMs >= 300000);
  assert.match(after.notice, /沒有新的測試進度/);
});

test('心跳過期標示可能中斷，不顯示 PASS 或偽稱程序死亡', t => {
  const f = fixture(t), now = { value: Date.parse('2026-10-15T08:00:00.000Z') };
  const heartbeat = runner(f, now);
  heartbeat.close();
  const observed = readRunStatus(f.root, f.runId, { nowMs: now.value + 120000 });
  assert.equal(observed.observed, 'HEARTBEAT_STALE');
  assert.equal(observed.outcome, 'RUNNING');
  assert.match(observed.notice, /不能視為失敗或成功/);
});

test('runner 回報 PASS 仍要求 result.json 的實際終態，不冒充 completion gate', t => {
  const f = fixture(t), now = { value: Date.parse('2026-10-15T08:00:00.000Z') };
  const heartbeat = runner(f, now);
  heartbeat.finish('PASS');
  let status = readRunStatus(f.root, f.runId, { nowMs: now.value });
  assert.equal(status.observed, 'TERMINAL_RESULT_UNVERIFIED');
  saveResult(f, 'FAIL');
  status = readRunStatus(f.root, f.runId, { nowMs: now.value });
  assert.equal(status.observed, 'TERMINAL_RESULT_UNVERIFIED');
  saveResult(f, 'PASS');
  status = readRunStatus(f.root, f.runId, { nowMs: now.value });
  assert.equal(status.observed, 'TESTS_PASS_GATE_NOT_CONFIRMED');
  assert.match(status.notice, /證據回讀/);
});

test('失敗的 runner 保存真實 outcome，而輪詢程序不將它改成成功', t => {
  const f = fixture(t), now = { value: Date.parse('2026-10-15T08:00:00.000Z') };
  const heartbeat = runner(f, now);
  heartbeat.finish('FAIL');
  saveResult(f, 'FAIL');
  const status = readRunStatus(f.root, f.runId, { nowMs: now.value });
  assert.equal(status.outcome, 'FAIL');
  assert.equal(status.observed, 'RUN_TERMINATED_UNSUCCESSFULLY');
});

test('輸出不暴露計劃摘要與任務全文，只顯示可定位進度', t => {
  const f = fixture(t), now = { value: Date.parse('2026-10-15T08:00:00.000Z') };
  const secret = 'password=should-not-appear-123456';
  const heartbeat = runner(f, now, { planDigest: 'a'.repeat(64) });
  t.after(() => heartbeat.close());
  assert.throws(() => heartbeat.progress({ commandId: secret, status: 'PASS' }), /INVALID_COMMAND_ID/);
  const output = JSON.stringify(statusOnce(f.root, f.runId));
  assert.doesNotMatch(output, /should-not-appear|password|planDigest/);
});

test('拒絕不合法 runId 與路徑穿越', t => {
  const f = fixture(t), now = { value: Date.parse('2026-10-15T08:00:00.000Z') };
  for (const id of ['../etc/passwd', '.', '/tmp/x', 'x'.repeat(36)]) {
    assert.throws(() => startRunHeartbeat(f.root, { runId: id, totalCommands: 1 }), /INVALID_RUN_ID/);
    assert.throws(() => readRunStatus(f.root, id), /INVALID_RUN_ID/);
  }
  const heartbeat = runner(f, now);
  t.after(() => heartbeat.close());
  if (process.platform !== 'win32') {
    const target = path.join(f.root, '.cr/runs', randomUUID());
    // 再測狀態目錄被連結改向時被拒絕。
    const dir = path.join(f.root, '.cr/runs', f.runId);
    fs.renameSync(dir, target);
    fs.symlinkSync(target, dir);
    assert.throws(() => readRunStatus(f.root, f.runId), /LINK_BLOCKED/);
  }
});

test('輪詢 watch 可停止在終態，不永久占用程序或啟動第二個 Agent', async t => {
  const f = fixture(t), now = { value: Date.parse('2026-10-15T08:00:00.000Z') };
  const heartbeat = runner(f, now);
  const messages = [];
  const result = await watch(f.root, f.runId, { maxPolls: 3, intervalMs: 1000,
    sleep: async () => { heartbeat.finish('FAIL'); saveResult(f, 'FAIL'); },
    readOptions: { nowMs: now.value }, emit: status => messages.push(status.observed) });
  assert.deepEqual(messages, ['RUNNING_HEARTBEAT_FRESH', 'RUN_TERMINATED_UNSUCCESSFULLY']);
  assert.equal(result.outcome, 'FAIL');
});

test('輪詢 watch 的輸出上限不把尚未結束的任務改成已完成', async t => {
  const f = fixture(t), now = { value: Date.parse('2026-10-15T08:00:00.000Z') };
  const heartbeat = runner(f, now);
  t.after(() => heartbeat.close());
  const report = await watch(f.root, f.runId, { maxPolls: 2, intervalMs: 1000, sleep: async()=>{}, readOptions: { nowMs: now.value }, emit:()=>{} });
  assert.equal(report.monitorStopped, 'MAX_POLLS_REACHED_NOT_COMPLETED');
  assert.equal(report.outcome, 'RUNNING');
});

test('研究、設計、開發階段讀取現有 CR state，只稱 checkpoint 而不冒充程序心跳', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, '.cr'), { recursive: true });
  fs.writeFileSync(path.join(f.root, '.cr/state.json'), JSON.stringify({
    schemaVersion: 'pixiu.critical-relay.v1', phase: 'RESEARCH', status: 'active', iteration: 3,
    lifecycle: { stage: 'design' }, nextAction: 'password=do-not-display'
  }));
  const data = readLifecycleStage(f.root);
  assert.equal(data.observed, 'CHECKPOINT_ONLY_NOT_LIVENESS_PROOF');
  assert.equal(data.phase, 'RESEARCH');
  assert.equal(data.lifecycleStage, 'design');
  assert.equal(data.iteration, 3);
  assert.doesNotMatch(JSON.stringify(data), /do-not-display/);
});

test('任務 checkpoint 來源格式錯誤時保持拒絕', t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, '.cr'), { recursive: true });
  fs.writeFileSync(path.join(f.root, '.cr/state.json'), JSON.stringify({ schemaVersion: 'unknown', phase: 'PASS' }));
  assert.throws(() => readLifecycleStage(f.root), /CANONICAL_STATE_INVALID/);
});
