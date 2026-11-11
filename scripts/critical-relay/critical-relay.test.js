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
  require('node:test')(test.name, test);
}

function riskState(status = 'accepted') {
  const state = completedState();
  state.riskContext = { environment: 'isolated-test', sourceRevision: 'fixture-v1' };
  const context = { scope: state.objective, environment: 'isolated-test', source: { revision: 'fixture-v1' } };
  state.remainingRisks = [{
    id: 'risk-high', severity: 'high', status,
    disposition: { owner: 'operator', reason: '已核對影響範圍', action: '加入保護與回歸驗證',
      context, evidenceRefs: ['risk-proof'] }
  }];
  if (status === 'accepted') {
    state.evidence.push({ id: 'risk-proof', source: 'file:approvals/risk-high.md',
      kind: 'risk-acceptance', authority: 'user', actor: 'user-a', decision: 'accepted',
      riskRefs: ['risk-high'], context: structuredClone(context) });
    state.remainingRisks[0].approval = {
      actor: 'user-a', reference: 'file:approvals/risk-high.md', evidenceRef: 'risk-proof'
    };
  } else {
    state.tests.push({ id: 'risk-proof', name: '風險修復反例', status: 'passed', required: true,
      riskRefs: ['risk-high'], context: structuredClone(context) });
  }
  return state;
}

require('node:test')('高風險不能只修改狀態而略過處置證據', () => {
  for (const status of ['accepted', 'mitigated', 'resolved']) {
    const state = completedState();
    state.remainingRisks = [{ id: 'r', severity: 'high', status }];
    assert.strictEqual(evaluateCriticalRelay(state).canComplete, false, status);
  }
});

require('node:test')('風險等級大小寫、缺漏與未評估值不能繞過閘門', () => {
  for (const severity of ['HIGH', 'High', 'critical ', 'typo', undefined, 'unknown']) {
    const state = completedState();
    state.remainingRisks = [{ id: 'r', severity, status: 'open' }];
    assert.strictEqual(evaluateCriticalRelay(state).canComplete, false, String(severity));
  }
  for (const field of ['assumptions', 'unknowns', 'challenges', 'counterEvidence']) {
    const state = completedState();
    state[field].push({ id: 'invalid-severity', severity: 'HIGH', status: 'open' });
    assert.strictEqual(evaluateCriticalRelay(state).canComplete, false, field);
  }
});

require('node:test')('接受風險需可回讀的使用者接受紀錄與一致範圍', () => {
  const state = riskState();
  assert.strictEqual(evaluateCriticalRelay(state).canComplete, true);
  const cases = [
    x => { delete x.remainingRisks[0].approval; },
    x => { x.remainingRisks[0].approval.actor = 'someone-else'; },
    x => { x.remainingRisks[0].approval.reference = 'file:another-approval.md'; },
    x => { x.evidence.at(-1).authority = 'assistant'; },
    x => { x.evidence.at(-1).decision = 'proposed'; },
    x => { x.evidence.at(-1).riskRefs = ['another-risk']; },
    x => { x.evidence.at(-1).context.environment = 'production'; },
    x => { x.remainingRisks[0].disposition.owner = ''; },
    x => { x.remainingRisks[0].disposition.reason = ''; },
    x => { x.remainingRisks[0].disposition.evidenceRefs = []; },
    x => { x.riskContext.sourceRevision = 'fixture-v2'; },
    x => { x.riskContext.environment = 'production'; },
    x => { x.objective = '不同交付範圍'; },
    x => { delete x.riskContext; }
  ];
  for (const [i, mutate] of cases.entries()) {
    const changed = structuredClone(state); mutate(changed);
    assert.strictEqual(evaluateCriticalRelay(changed).canComplete, false, 'case ' + i);
  }
});

require('node:test')('緩解與解決風險需通過且對應本次範圍的證據', () => {
  for (const status of ['mitigated', 'resolved']) {
    const state = riskState(status);
    assert.strictEqual(evaluateCriticalRelay(state).canComplete, true, status);
    const cases = [
      x => { x.tests.at(-1).status = 'failed'; },
      x => { x.tests.at(-1).status = 'running'; },
      x => { x.tests.at(-1).riskRefs = []; },
      x => { x.tests.at(-1).context.source.revision = 'fixture-v0'; },
      x => { x.remainingRisks[0].disposition.evidenceRefs = ['missing']; },
      x => { x.remainingRisks[0].disposition.action = ''; }
    ];
    for (const [i, mutate] of cases.entries()) {
      const changed = structuredClone(state); mutate(changed);
      assert.strictEqual(evaluateCriticalRelay(changed).canComplete, false, status + ' case ' + i);
    }
  }
});

require('node:test')('風險交接保留環境與版本且拒絕竄改', () => {
  const state = riskState();
  const snapshot = buildHandoffSnapshot(state);
  assert.deepStrictEqual(snapshot.riskContext, state.riskContext);
  assert.strictEqual(verifyHandoffSnapshot(snapshot).canAccept, true);
  snapshot.riskContext.environment = 'production';
  assert.strictEqual(verifyHandoffSnapshot(snapshot).canAccept, false);
});

require('node:test')('風險驗證綁定正式 run 與研究來源摘要', () => {
  const { riskVerificationContext } = require('./risk-review');
  const state = riskState();
  state.executionContract = { schemaVersion: 'pixiu.cr-execution.v2',
    source: { headSha: 'head-a', changeDigest: 'diff-a' },
    verificationRun: { runId: 'run-a' }, verification: { passed: true },
    verificationBinding: { planDigest: 'plan-a' } };
  const first = riskVerificationContext(state);
  state.executionContract.verificationRun.runId = 'run-b';
  assert.notDeepStrictEqual(riskVerificationContext(state), first);
  state.researchRequired = true;
  state.researchVerification = { digest: 'research-a' };
  state.researchBinding = { planDigest: 'research-plan-a' };
  const research = riskVerificationContext(state);
  state.researchVerification.digest = 'research-b';
  assert.notDeepStrictEqual(riskVerificationContext(state), research);
});
