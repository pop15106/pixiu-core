'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeFixture, passing } = require('./test-support');
const { initializeFallback, createEvidenceState, applyRunEvidence } = require('./relay-evidence');
const { migrateFallback, resumeMigration, prepareMigration } = require('./plan-migration');
const { readJson, atomicJson, digestObject } = require('./test-plan');
const { verifyStateEvidence } = require('./evidence-verifier');
const { runPlan } = require('./test-runner');

function migrationFixture(t) {
  const fixture = makeFixture(t);
  const state = initializeFallback(fixture.root, fixture.planPath);
  const nextPlan = structuredClone(fixture.plan);
  nextPlan.revision = 2;
  nextPlan.parentDigest = fixture.binding.planDigest;
  nextPlan.commands.push({ ...nextPlan.commands[0], id: 'new-command', file: 'new.test.js' });
  fs.writeFileSync(path.join(fixture.root, 'new.test.js'), passing);
  fs.writeFileSync(path.join(fixture.root, 'plan.json'), JSON.stringify(nextPlan));
  const options = { authorized: true, approvalRef: 'fixture:explicit-user-approval', reason: '新增中性必要測試，保留原失敗',
    newPlanPath: 'plan.json', expectedOldDigest: fixture.binding.planDigest, expectedNewDigest: digestObject(nextPlan) };
  return { ...fixture, state, nextPlan, options };
}

test('合法升版保留版本鏈與舊失敗，清除舊驗證並要求重跑', t => {
  const f = migrationFixture(t);
  f.state.executionContract.failures = [{ id: 'old-failure', fingerprint: 'old-error', attempts: 2, status: 'open' }];
  f.state.executionContract.evidenceHistory = [{ runId: 'old-run', outcome: 'FAIL' }];
  atomicJson(f.root, '.cr/state.json', f.state);
  const result = migrateFallback(f.root, f.options);
  const next = readJson(f.root, '.cr/state.json');
  assert.equal(next.executionContract.verificationBinding.planDigest, f.options.expectedNewDigest);
  assert.equal(next.executionContract.verification, null);
  assert.equal(next.executionContract.verificationRun, null);
  assert.equal(next.executionContract.failures[0].attempts, 2);
  assert.equal(next.executionContract.evidenceHistory[0].runId, 'old-run');
  assert.equal(next.phase, 'REASSESS');
  assert.equal(next.executionContract.verificationMigrations[0].beforeBinding.planDigest, f.binding.planDigest);
  assert.equal(readJson(f.root, `.cr/migrations/${result.migrationId}/receipt.json`).afterRevision, 2);
  assert.equal(fs.existsSync(path.join(f.root, '.cr/migration-pending.json')), false);
});

test('未授權、漏理由、錯指紋與錯版本鏈都不改既有 state', t => {
  const f = migrationFixture(t);
  const before = fs.readFileSync(path.join(f.root, '.cr/state.json'), 'utf8');
  for (const update of [{ authorized: false }, { reason: '' }, { approvalRef: '' },
    { expectedOldDigest: 'a'.repeat(64) }, { expectedNewDigest: 'a'.repeat(64) }]) {
    assert.throws(() => migrateFallback(f.root, { ...f.options, ...update }));
  }
  f.nextPlan.revision = 5;
  fs.writeFileSync(path.join(f.root, 'plan.json'), JSON.stringify(f.nextPlan));
  assert.throws(() => migrateFallback(f.root, { ...f.options, expectedNewDigest: digestObject(f.nextPlan) }), /REVISION_CHAIN/);
  assert.equal(fs.readFileSync(path.join(f.root, '.cr/state.json'), 'utf8'), before);
});

test('失敗後刪除必要命令需逐項明確授權，已存在的失敗仍保留', t => {
  const f = migrationFixture(t);
  f.nextPlan.commands = [f.nextPlan.commands[1]];
  fs.writeFileSync(path.join(f.root, 'plan.json'), JSON.stringify(f.nextPlan));
  const options = { ...f.options, expectedNewDigest: digestObject(f.nextPlan) };
  assert.throws(() => migrateFallback(f.root, options), /SCOPE_REDUCTION/);
  const result = migrateFallback(f.root, { ...options, approvedRequiredRemovals: ['command-0'] });
  const receipt = readJson(f.root, `.cr/migrations/${result.migrationId}/receipt.json`);
  assert.deepEqual(receipt.removedRequired, ['command-0']);
});

test('驗收證據種類不能靜默由 UI 降級成 test', t => {
  const f = migrationFixture(t);
  const before = structuredClone(f.state);
  const oldPlan = before.executionContract.verificationPlanSnapshot;
  oldPlan.criteria[0].requiredEvidenceKinds = ['ui', 'test'];
  const oldDigest = digestObject(oldPlan);
  const binding = { ...f.binding, planDigest: oldDigest };
  before.executionContract.verificationBinding = binding;
  f.nextPlan.parentDigest = oldDigest;
  fs.writeFileSync(path.join(f.root, 'plan.json'), JSON.stringify(f.nextPlan));
  assert.throws(() => prepareMigration(f.root, before, binding, { ...f.options, expectedOldDigest: oldDigest,
    expectedNewDigest: digestObject(f.nextPlan) }), /SCOPE_REDUCTION/);
});

for (const point of ['binding-written', 'state-written']) {
  test(`${point} 中斷後 gate 保持阻擋，可明確恢復同一交易`, async t => {
    const f = migrationFixture(t);
    assert.throws(() => migrateFallback(f.root, f.options, step => { if (step === point) throw new Error('中性中斷'); }), /中性中斷/);
    const marker = readJson(f.root, '.cr/migration-pending.json');
    const state = readJson(f.root, '.cr/state.json');
    assert.equal(verifyStateEvidence(state, f.root).canComplete, false);
    await assert.rejects(runPlan({ workspaceRoot: f.root, planPath: 'plan.json' }), /MIGRATION_INCOMPLETE/);
    assert.throws(() => resumeMigration(f.root, { migrationId: marker.migrationId }), /AUTHORIZATION/);
    const result = resumeMigration(f.root, { migrationId: marker.migrationId, authorized: true });
    assert.equal(result.binding.planDigest, f.options.expectedNewDigest);
    assert.equal(readJson(f.root, '.cr/state.json').executionContract.verification, null);
    assert.equal(fs.existsSync(path.join(f.root, '.cr/migration-pending.json')), false);
  });
}

test('中斷後計劃或 state 被別人改變，恢復不能覆寫', t => {
  const f = migrationFixture(t);
  assert.throws(() => migrateFallback(f.root, f.options, () => { throw new Error('中性中斷'); }));
  const marker = readJson(f.root, '.cr/migration-pending.json');
  const state = readJson(f.root, '.cr/state.json'); state.nextAction = '別人的新進度';
  atomicJson(f.root, '.cr/state.json', state);
  assert.throws(() => resumeMigration(f.root, { migrationId: marker.migrationId, authorized: true }), /CONCURRENT_STATE/);
  assert.equal(readJson(f.root, '.cr/state.json').nextAction, '別人的新進度');
});

test('存在執行鎖时不進行計劃遷移，也不移除該鎖', t => {
  const f = migrationFixture(t);
  fs.writeFileSync(path.join(f.root, '.cr/runner.lock'), '中性執行鎖');
  assert.throws(() => migrateFallback(f.root, f.options), /RUN_ACTIVE/);
  assert.equal(fs.readFileSync(path.join(f.root, '.cr/runner.lock'), 'utf8'), '中性執行鎖');
});

test('workflow 原子遷移使用相同規則，普通 state 更新仍不可換 binding', async t => {
  const f = makeFixture(t);
  const { createWorkflowController } = await import('../devspace-portable/DevSpace.WorkflowStore.mjs');
  const controller = createWorkflowController({ stateDirectory: path.join(f.root, '.cr/workflow') });
  const common = { workspaceRoot: f.root, sessionRef: 'migration-fixture', actor: 'producer' };
  const state = createEvidenceState(f.root, f.planPath);
  let task = await controller.createTask({ ...common, scope: 'same_project', objective: '中性計劃遷移', acceptanceCriteria: ['保留舊證據'],
    requireReview: false, criticalRelayRequired: true, criticalRelay: state, idempotencyKey: 'migration-create-001' });
  task = await controller.updateTask({ ...common, taskId: task.taskId, action: 'claim', expectedRevision: task.revision, idempotencyKey: 'migration-claim-001' });
  const next = structuredClone(f.plan); next.revision = 2; next.parentDigest = f.binding.planDigest;
  next.commands.push({ ...next.commands[0], id: 'another-command' });
  fs.writeFileSync(path.join(f.root, f.planPath), JSON.stringify(next));
  const proposal = { authorized: true, reason: '增加測試', approvalRef: 'fixture:approved', newPlanPath: f.planPath,
    expectedOldDigest: f.binding.planDigest, expectedNewDigest: digestObject(next) };
  await assert.rejects(controller.updateTask({ ...common, actor: 'not-owner', taskId: task.taskId, action: 'migrate_verification',
    expectedRevision: task.revision, idempotencyKey: 'migration-wrong-owner', verificationMigration: proposal }));
  task = await controller.updateTask({ ...common, taskId: task.taskId, action: 'migrate_verification', expectedRevision: task.revision,
    idempotencyKey: 'migration-valid-001', verificationMigration: proposal });
  assert.equal(task.verificationBinding.planDigest, digestObject(next));
  assert.equal(task.criticalRelay.executionContract.verification, null);
  assert.equal(task.verificationMigrations.length, 1);
});
