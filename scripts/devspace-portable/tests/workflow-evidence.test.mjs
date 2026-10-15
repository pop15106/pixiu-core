import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createWorkflowController } from '../DevSpace.WorkflowStore.mjs';
import support from '../../critical-relay/test-support.js';
import relay from '../../critical-relay/relay-evidence.js';
import runner from '../../critical-relay/test-runner.js';
import planTools from '../../critical-relay/test-plan.js';
import criticalRelay from '../../critical-relay/critical-relay.js';

const { makeFixture, passing } = support;
const { createEvidenceState, applyRunEvidence, initializeFallback } = relay;
const { runPlan } = runner;
const { atomicJson, readJson } = planTools;
const { recordCriticalRelayPhase, evaluateCriticalRelay } = criticalRelay;
const gatePath = fileURLToPath(new URL('../../critical-relay/critical-relay.js', import.meta.url));

function reviewed(state) {
  const next = structuredClone(state);
  // 此處只完成中性 fixture 的測試覆核，並非任何實際產品驗收。
  next.claims = [{ id: 'claim-fixture', statement: '中性 fixture 的必要測試通過', status: 'supported',
    evidenceRefs: [next.evidence.at(-1).id], challengeRefs: ['challenge-fixture'], counterEvidenceRefs: [] }];
  next.challenges = [{ id: 'challenge-fixture', claimRefs: ['claim-fixture'], severity: 'high', status: 'resolved',
    method: '使用獨立測試案例注入缺證據與錯版本反例', result: 'fixture 正常路徑回讀通過；反例由本檔其他案例驗證' }];
  recordCriticalRelayPhase(next, 'RECHALLENGE');
  next.status = 'ready';
  return next;
}

async function fixtureTask(t, sources) {
  const fixture = makeFixture(t, sources);
  const state = createEvidenceState(fixture.root, fixture.planPath, { objective: '中性完整交付測試', scope: ['sample-0.test.js'] });
  const stateDirectory = path.join(fixture.root, '.cr/workflow');
  const controller = createWorkflowController({ stateDirectory, agentAdapter: { start() { throw new Error('本測試不啟動 Agent'); } } });
  let key = 0;
  const common = { workspaceRoot: fixture.root, sessionRef: 'fixture-session', actor: 'producer' };
  let task = await controller.createTask({ ...common, scope: 'same_project', objective: '驗證原始證據與接力',
    acceptanceCriteria: ['真實回讀後才能完成'], requireReview: false, criticalRelayRequired: true, criticalRelay: state,
    idempotencyKey: `fixture-create-${++key}` });
  const update = async (action, extra = {}) => {
    task = await controller.updateTask({ ...common, taskId: task.taskId, action, expectedRevision: task.revision,
      idempotencyKey: `fixture-update-${++key}`, ...extra });
    return task;
  };
  await update('claim');
  const run = () => runPlan({ workspaceRoot: fixture.root, planPath: fixture.planPath, expectedPlanDigest: fixture.binding.planDigest });
  return { ...fixture, state, controller, stateDirectory, common, update, run, get task() { return task; } };
}

test('只有測試成功仍需反證覆核；完整證據才能經 workflow 完成', async t => {
  const f = await fixtureTask(t);
  const run = await f.run();
  const state = applyRunEvidence(f.root, f.state, run);
  assert.equal(state.phase, 'VERIFY');
  assert.equal(evaluateCriticalRelay(state).canComplete, false);
  await assert.rejects(f.update('complete', { criticalRelay: state }), /completion gate blocked/);
  const done = await f.update('complete', { criticalRelay: reviewed(state) });
  assert.equal(done.status, 'completed');
  assert.deepEqual(done.verificationBinding, f.binding);
});

test('workflow 不能替換 binding、移除必要測試或降級 general', async t => {
  const f = await fixtureTask(t);
  const run = await f.run();
  const state = reviewed(applyRunEvidence(f.root, f.state, run));
  const lower = structuredClone(state); lower.mode = 'general'; delete lower.executionContract;
  await assert.rejects(f.update('complete', { criticalRelay: lower }), /不可降級/);
  const missing = structuredClone(state); missing.tests = [];
  await assert.rejects(f.update('complete', { criticalRelay: missing }), /blocked/);
  const optional = structuredClone(state); optional.tests[0].required = false;
  await assert.rejects(f.update('complete', { criticalRelay: optional }), /降級|blocked/);
  const changed = structuredClone(state); changed.executionContract.verificationBinding.planDigest = 'a'.repeat(64);
  await assert.rejects(f.update('complete', { criticalRelay: changed }), /binding|計劃/);
});

test('正式 workflow 完成入口會拒絕遺失原始輸出', async t => {
  const f = await fixtureTask(t);
  const run = await f.run();
  const state = reviewed(applyRunEvidence(f.root, f.state, run));
  fs.unlinkSync(path.join(f.root, run.commands[0].stdoutPath));
  await assert.rejects(f.update('complete', { criticalRelay: state }), /evidence gate blocked/);
});

test('修復、回歸、handoff、重新載入 ledger 與接手完成', async t => {
  const f = await fixtureTask(t, ["require('node:test')('中性失敗', () => { throw new Error('fixture'); });"]);
  const first = await f.run();
  let state = applyRunEvidence(f.root, f.state, first, { authorizedRepair: true });
  assert.equal(state.phase, 'REPAIR');
  assert.equal(state.executionContract.failures[0].attempts, 1);
  const replay = applyRunEvidence(f.root, state, first, { authorizedRepair: true });
  assert.deepEqual(replay, state);
  const second = await f.run();
  state = applyRunEvidence(f.root, state, second, { authorizedRepair: true });
  assert.equal(state.phase, 'REASSESS');
  assert.equal(state.executionContract.failures[0].attempts, 2);
  // 修復僅發生在本案例建立的暫存 fixture。
  fs.writeFileSync(path.join(f.root, 'sample-0.test.js'), passing);
  const fixed = await f.run();
  state = reviewed(applyRunEvidence(f.root, state, fixed, { authorizedRepair: true,
    changedApproach: { 'command-0': '確認 fixture 明確拋錯後換成有效斷言，重跑同一事前計劃' } }));
  assert.equal(state.executionContract.failures[0].status, 'resolved');
  const handed = await f.update('handoff', { criticalRelay: state, toActor: 'receiver', contextSnapshot: '中性 fixture 已修復，接手須回讀證據',
    deliverables: [fixed.resultPath], openItems: [], requiredNextAction: '核對來源與原始事件後完成' });
  const reloaded = createWorkflowController({ stateDirectory: f.stateDirectory });
  const restored = await reloaded.getTask({ ...f.common, taskId: handed.taskId });
  assert.deepEqual(restored.verificationBinding, f.binding);
  await f.update('acknowledge', { actor: 'receiver' });
  const done = await f.update('complete', { actor: 'receiver' });
  assert.equal(done.status, 'completed');
  assert.equal(done.criticalRelay.executionContract.evidenceHistory.length, 3);
});

test('接手時來源改變會清除可交付 checkpoint，保留重驗下一步', async t => {
  const f = await fixtureTask(t);
  const run = await f.run();
  const state = reviewed(applyRunEvidence(f.root, f.state, run));
  await f.update('handoff', { criticalRelay: state, toActor: 'receiver', contextSnapshot: '中性來源變動反例',
    deliverables: [run.resultPath], openItems: [], requiredNextAction: '回讀版本' });
  fs.writeFileSync(path.join(f.root, 'new-source.txt'), '來源已有不同內容');
  const ack = await f.update('acknowledge', { actor: 'receiver' });
  assert.equal(ack.criticalRelay.phase, 'REASSESS');
  assert.equal(ack.criticalRelay.executionContract.verification, null);
  await assert.rejects(f.update('complete', { actor: 'receiver' }), /blocked/);
});

test('已回填的 run 內容改變不能藉重放覆寫歷史', async t => {
  const f = await fixtureTask(t);
  const run = await f.run();
  const state = applyRunEvidence(f.root, f.state, run);
  const changed = readJson(f.root, run.resultPath); changed.outcome = 'FAIL';
  atomicJson(f.root, run.resultPath, changed);
  assert.throws(() => applyRunEvidence(f.root, state, run), /已回填內容遭到變更/);
});

test('CLI 與 workflow 使用同一證據閘門，固定檔可阻擋模式降級', async t => {
  const fixture = makeFixture(t);
  let state = initializeFallback(fixture.root, fixture.planPath);
  const result = await runPlan({ workspaceRoot: fixture.root, planPath: fixture.planPath });
  state = reviewed(applyRunEvidence(fixture.root, state, result));
  atomicJson(fixture.root, '.cr/state.json', state);
  const executeGate = () => spawnSync(process.execPath, [gatePath, 'check', '.cr/state.json'], {
    cwd: fixture.root, encoding: 'utf8', windowsHide: true, timeout: 15000 });
  let checked = executeGate();
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  state.mode = 'general'; delete state.executionContract; delete state.executionContractRequired;
  atomicJson(fixture.root, '.cr/state.json', state);
  checked = executeGate();
  assert.equal(checked.status, 2);
  assert.match(checked.stdout, /不可降級/);
});

test('fallback 初始化保留既有任務，避免覆寫狀態', t => {
  const fixture = makeFixture(t);
  initializeFallback(fixture.root, fixture.planPath);
  const before = fs.readFileSync(path.join(fixture.root, '.cr/state.json'), 'utf8');
  assert.throws(() => initializeFallback(fixture.root, fixture.planPath), /已有/);
  assert.equal(fs.readFileSync(path.join(fixture.root, '.cr/state.json'), 'utf8'), before);
});
