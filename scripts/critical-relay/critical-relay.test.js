#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  SCHEMA_VERSION,
  createCriticalRelay,
  evaluateCriticalRelay,
  buildHandoffSnapshot
} = require('./critical-relay');

function completedState() {
  const state = createCriticalRelay({
    objective: '確認主張在反證後仍成立',
    completionCriteria: ['核心主張有可追溯證據']
  });

  state.phase = 'RECHALLENGE';
  state.iteration = 2;
  state.claims.push({
    id: 'claim-1',
    statement: '測試主張',
    status: 'supported',
    evidenceRefs: ['evidence-1'],
    counterEvidenceRefs: ['counter-1'],
    counterEvidenceStatus: 'addressed'
  });
  state.evidence.push({ id: 'evidence-1', source: 'primary-source', supports: ['claim-1'] });
  state.counterEvidence.push({ id: 'counter-1', source: 'contrary-source', challenges: ['claim-1'] });
  state.challenges.push({ id: 'challenge-1', severity: 'high', status: 'resolved' });
  state.unknowns.push({ id: 'unknown-1', severity: 'high', status: 'resolved' });
  state.tests.push({ id: 'test-1', name: '反例測試', required: true, status: 'passed' });
  state.completionCriteria[0].satisfied = true;
  state.completionCriteria[0].evidenceRefs = ['evidence-1', 'test-1'];
  state.remainingRisks.push({ id: 'risk-1', severity: 'low', status: 'open' });
  state.nextAction = '交棒並保留剩餘低風險';
  return state;
}

function testCreatesCanonicalState() {
  const state = createCriticalRelay({
    objective: '研究一個可被反證的問題',
    completionCriteria: ['至少一項完成條件']
  });
  assert.strictEqual(state.schemaVersion, SCHEMA_VERSION);
  assert.strictEqual(state.phase, 'UNDERSTAND');
  assert.strictEqual(state.status, 'active');
  assert.deepStrictEqual(state.claims, []);
}

function testOpenClaimBlocksCompletion() {
  const state = completedState();
  state.claims[0].status = 'contested';
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(result.blockingReasons.some(reason => reason.includes('claim-1 尚未收斂')));
}

function testUnaddressedCounterEvidenceBlocksCompletion() {
  const state = completedState();
  state.claims[0].counterEvidenceStatus = 'open';
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(result.blockingReasons.some(reason => reason.includes('未處理 counterEvidence')));
}

function testDanglingEvidenceReferenceBlocksCompletion() {
  const state = completedState();
  state.claims[0].evidenceRefs = ['evidence-999'];
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(result.blockingReasons.some(reason => reason.includes('引用不存在的 evidence')));
}

function testCompletionRequiresRechallengePhase() {
  const state = completedState();
  state.phase = 'VERIFY';
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(result.blockingReasons.some(reason => reason.includes('尚未進入 RECHALLENGE')));
}

function testRequiredVerificationBlocksCompletion() {
  const state = completedState();
  state.tests[0].status = 'failed';
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(result.blockingReasons.some(reason => reason.includes('必要驗證尚未通過')));
}

function testResolvedRelayCanComplete() {
  const result = evaluateCriticalRelay(completedState());
  assert.strictEqual(result.canComplete, true);
  assert.deepStrictEqual(result.blockingReasons, []);
  assert.strictEqual(result.nextPhase, 'READY_TO_HANDOFF');
}

function testHandoffSnapshotKeepsCriticalState() {
  const snapshot = buildHandoffSnapshot(completedState());
  for (const key of [
    'mode',
    'status',
    'claims',
    'assumptions',
    'evidence',
    'counterEvidence',
    'challenges',
    'unknowns',
    'tests',
    'completionCriteria',
    'remainingRisks',
    'nextAction'
  ]) {
    assert.ok(Object.prototype.hasOwnProperty.call(snapshot, key), `handoff 缺少 ${key}`);
  }
  assert.strictEqual(snapshot.evaluation.canComplete, true);
}

for (const test of [
  testCreatesCanonicalState,
  testOpenClaimBlocksCompletion,
  testUnaddressedCounterEvidenceBlocksCompletion,
  testDanglingEvidenceReferenceBlocksCompletion,
  testCompletionRequiresRechallengePhase,
  testRequiredVerificationBlocksCompletion,
  testResolvedRelayCanComplete,
  testHandoffSnapshotKeepsCriticalState
]) {
  test();
  process.stdout.write(`ok ${test.name}\n`);
}
