#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  SCHEMA_VERSION,
  createCriticalRelay,
  recordCriticalRelayPhase,
  evaluateCriticalRelay,
  buildHandoffSnapshot,
  verifyHandoffSnapshot
} = require('./critical-relay');

function completedState() {
  const state = createCriticalRelay({
    objective: '確認主張在反證後仍成立',
    completionCriteria: ['核心主張有可追溯證據']
  });

  recordCriticalRelayPhase(state, 'VERIFY');
  recordCriticalRelayPhase(state, 'RECHALLENGE');
  state.iteration = 2;
  state.claims.push({
    id: 'claim-1',
    statement: '測試主張',
    status: 'supported',
    evidenceRefs: ['evidence-1'],
    challengeRefs: ['challenge-1'],
    counterEvidenceRefs: ['counter-1'],
    counterEvidenceStatus: 'addressed'
  });
  state.evidence.push({
    id: 'evidence-1',
    url: 'https://example.com/primary',
    supports: ['claim-1']
  });
  state.counterEvidence.push({
    id: 'counter-1',
    url: 'https://example.com/contrary',
    claimRefs: ['claim-1'],
    severity: 'high',
    status: 'addressed'
  });
  state.challenges.push({
    id: 'challenge-1',
    claimRefs: ['claim-1'],
    severity: 'high',
    status: 'resolved',
    method: 'countersearch',
    result: '已搜尋反方來源並完成比較'
  });
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
  assert.deepStrictEqual(state.phaseHistory, ['UNDERSTAND']);
  assert.strictEqual(state.status, 'active');
  assert.deepStrictEqual(state.claims, []);
}

function testMalformedTopLevelArrayFailsClosed() {
  const state = completedState();
  state.claims = {};
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(result.blockingReasons.some(reason => reason.includes('claims 必須是陣列')));
}

function testMalformedTestsArrayFailsClosed() {
  const state = completedState();
  state.tests = {};
  state.completionCriteria[0].evidenceRefs = ['evidence-1'];
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(result.blockingReasons.some(reason => reason.includes('tests 必須是陣列')));
}

function testBlockedStateCannotComplete() {
  const state = completedState();
  state.status = 'blocked';
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(result.blockingReasons.some(reason => reason.includes('status=blocked')));
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

function testReverseCounterEvidenceLinkIsRequired() {
  const state = completedState();
  state.counterEvidence.push({
    id: 'counter-2',
    url: 'https://example.com/contrary-2',
    claimRefs: ['claim-1'],
    severity: 'high',
    status: 'open'
  });
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(
    result.blockingReasons.some(reason =>
      reason.includes('該 claim 未反向列出此 counterEvidence')
    )
  );
  assert.ok(result.blockingReasons.some(reason => reason.includes('高風險反證尚未處理')));
}

function testDuplicateIdsBlockCompletion() {
  const state = completedState();
  state.evidence.push({
    id: 'evidence-1',
    url: 'https://example.com/duplicate'
  });
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(result.blockingReasons.some(reason => reason.includes('重複 id：evidence-1')));
}

function testWeakSourceLabelIsNotTraceable() {
  const state = completedState();
  state.evidence[0] = { id: 'evidence-1', source: 'xxx', supports: ['claim-1'] };
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(result.blockingReasons.some(reason => reason.includes('缺少可追溯定位')));
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
  state.phaseHistory = ['UNDERSTAND', 'VERIFY'];
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(result.blockingReasons.some(reason => reason.includes('尚未進入 RECHALLENGE')));
}

function testCompletionRequiresVerifyThenRechallengeHistory() {
  const state = completedState();
  state.phaseHistory = ['UNDERSTAND', 'RECHALLENGE'];
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(result.blockingReasons.some(reason => reason.includes('VERIFY → RECHALLENGE')));
}

function testSupportedClaimWithoutChallengeBlocksCompletion() {
  const state = completedState();
  state.claims[0].challengeRefs = [];
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(result.blockingReasons.some(reason => reason.includes('沒有 challengeRefs')));
}

function testDanglingChallengeReferenceBlocksCompletion() {
  const state = completedState();
  state.claims[0].challengeRefs = ['challenge-999'];
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(result.blockingReasons.some(reason => reason.includes('引用不存在的 challenge')));
}

function testChallengeWithoutMethodBlocksCompletion() {
  const state = completedState();
  state.challenges[0].method = '';
  const result = evaluateCriticalRelay(state);
  assert.strictEqual(result.canComplete, false);
  assert.ok(result.blockingReasons.some(reason => reason.includes('challenge 缺少 method')));
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

function testHandoffSnapshotIsDetachedAndDigestProtected() {
  const state = completedState();
  const snapshot = buildHandoffSnapshot(state);
  assert.strictEqual(snapshot.evaluation.canComplete, true);
  assert.match(snapshot.stateDigest, /^[a-f0-9]{64}$/);

  state.claims[0].status = 'contested';
  assert.strictEqual(snapshot.claims[0].status, 'supported');

  const verified = verifyHandoffSnapshot(snapshot);
  assert.strictEqual(verified.digestMatches, true);
  assert.strictEqual(verified.canAccept, true);

  snapshot.claims[0].status = 'contested';
  const tampered = verifyHandoffSnapshot(snapshot);
  assert.strictEqual(tampered.digestMatches, false);
  assert.strictEqual(tampered.canAccept, false);
}

function testHandoffSnapshotKeepsCriticalState() {
  const snapshot = buildHandoffSnapshot(completedState());
  for (const key of [
    'mode',
    'status',
    'phaseHistory',
    'claims',
    'assumptions',
    'evidence',
    'counterEvidence',
    'challenges',
    'unknowns',
    'tests',
    'completionCriteria',
    'remainingRisks',
    'nextAction',
    'stateDigest'
  ]) {
    assert.ok(Object.prototype.hasOwnProperty.call(snapshot, key), `handoff 缺少 ${key}`);
  }
}

for (const test of [
  testCreatesCanonicalState,
  testMalformedTopLevelArrayFailsClosed,
  testMalformedTestsArrayFailsClosed,
  testBlockedStateCannotComplete,
  testOpenClaimBlocksCompletion,
  testUnaddressedCounterEvidenceBlocksCompletion,
  testReverseCounterEvidenceLinkIsRequired,
  testDuplicateIdsBlockCompletion,
  testWeakSourceLabelIsNotTraceable,
  testDanglingEvidenceReferenceBlocksCompletion,
  testCompletionRequiresRechallengePhase,
  testCompletionRequiresVerifyThenRechallengeHistory,
  testSupportedClaimWithoutChallengeBlocksCompletion,
  testDanglingChallengeReferenceBlocksCompletion,
  testChallengeWithoutMethodBlocksCompletion,
  testRequiredVerificationBlocksCompletion,
  testResolvedRelayCanComplete,
  testHandoffSnapshotIsDetachedAndDigestProtected,
  testHandoffSnapshotKeepsCriticalState
]) {
  test();
  process.stdout.write(`ok ${test.name}\n`);
}
