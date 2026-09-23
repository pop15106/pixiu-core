#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  SameChatReviewError,
  buildReviewerPrompt,
  consumeReviewResult,
  createReviewRequest,
  createReviewResult,
  evaluateHostCapabilities,
  hashSnapshot,
  reserveReview,
  submitReviewResult,
  toCriticalRelayProposal,
  validateReviewRequest,
  validateReviewResult
} = require('./same-chat-reviewer');

function tempState() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-same-chat-review-'));
}

function baseRequest(overrides = {}) {
  return createReviewRequest({
    taskId: 'tsk_same_chat_001',
    subjectRevision: 7,
    snapshot: {
      objective: 'Review the reconnect design',
      candidate: 'Reconnect only after transport close'
    },
    question: '找出這個方案可能錯的地方',
    criteria: [
      '找 race condition',
      '找 stale state',
      '找缺少的測試'
    ],
    ttlMs: 60_000,
    ...overrides
  });
}

function finding(overrides = {}) {
  return {
    id: 'finding-1',
    severity: 'high',
    claim: 'Reconnect gate 可能接受 stale session',
    reason: '舊 session 的完成事件可能晚於新 session。',
    claimRefs: ['claim-reconnect'],
    evidenceRefs: ['repo:scripts/reconnect.js'],
    suggestedTests: ['模擬舊 session 晚到的 close event'],
    ...overrides
  };
}

test('Same-Chat request 明確標示 advisory，不能滿足 independent review', () => {
  const request = baseRequest();
  assert.equal(request.mode, 'same_chat_advisory');
  assert.equal(request.independentReview, false);
  assert.equal(request.canSatisfyRequiredReview, false);
  assert.match(request.snapshotHash, /^sha256:[a-f0-9]{64}$/);
});

test('snapshot hash 對相同輸入保持一致', () => {
  const a = hashSnapshot({ b: 2, a: 1 });
  const b = hashSnapshot({ b: 2, a: 1 });
  assert.equal(a, b);
});

test('Reviewer prompt 固定 revision/hash，並禁止直接完成任務', () => {
  const request = baseRequest();
  const prompt = buildReviewerPrompt(request, {
    objective: '檢查 reconnect 設計',
    candidate: '候選方案內容',
    evidenceRefs: ['repo:scripts/reconnect.js'],
    constraints: ['不能直接修改 Git']
  });
  assert.match(prompt, new RegExp(request.reviewId));
  assert.match(prompt, new RegExp(String(request.subjectRevision)));
  assert.match(prompt, new RegExp(request.snapshotHash.replace(':', '\\:')));
  assert.match(prompt, /不能直接把 CR claim 標成 supported\/resolved/);
  assert.match(prompt, /不能直接授權修改、Git、Release 或完成任務/);
});

test('官方 host capability 只能宣告 protocol readiness，不能宣告 auto continue', () => {
  const result = evaluateHostCapabilities({
    uiMessage: true,
    toolCall: true,
    sessionCorrelation: true,
    resultSubmissionTool: true,
    autoContinueReceipt: true
  });
  assert.equal(result.dispatchReady, true);
  assert.equal(result.resultReturnReady, true);
  assert.equal(result.protocolReady, true);
  assert.equal(result.autoContinueVerified, false);
});

test('缺少 ui/message 時不能 dispatch', () => {
  const result = evaluateHostCapabilities({
    uiMessage: false,
    toolCall: true,
    sessionCorrelation: true,
    resultSubmissionTool: true
  });
  assert.equal(result.dispatchReady, false);
  assert.equal(result.protocolReady, false);
});

test('合法 reviewer result 可通過 correlation 驗證', () => {
  const request = baseRequest();
  const result = createReviewResult(request, {
    verdict: 'concerns_found',
    findings: [finding()]
  });
  assert.deepEqual(validateReviewResult(request, result), []);
});

test('stale revision 必須拒絕', () => {
  const request = baseRequest();
  const result = createReviewResult(request, {
    verdict: 'concerns_found',
    findings: [finding()]
  });
  result.subjectRevision += 1;
  assert.match(validateReviewResult(request, result).join('\n'), /subjectRevision 不一致/);
});

test('snapshot hash 不一致必須拒絕', () => {
  const request = baseRequest();
  const result = createReviewResult(request, {
    verdict: 'concerns_found',
    findings: [finding()]
  });
  result.snapshotHash = hashSnapshot('different snapshot');
  assert.match(validateReviewResult(request, result).join('\n'), /snapshotHash 不一致/);
});

test('reviewId 不一致必須拒絕', () => {
  const request = baseRequest();
  const result = createReviewResult(request, {
    verdict: 'concerns_found',
    findings: [finding()]
  });
  result.reviewId = 'other-review';
  assert.match(validateReviewResult(request, result).join('\n'), /reviewId 不一致/);
});

test('concerns_found 沒有 finding 必須拒絕', () => {
  const request = baseRequest();
  const result = {
    schema: 'pixiu.same-chat-review.result.v1',
    reviewId: request.reviewId,
    taskId: request.taskId,
    subjectRevision: request.subjectRevision,
    snapshotHash: request.snapshotHash,
    verdict: 'concerns_found',
    findings: [],
    completedAt: new Date().toISOString()
  };
  assert.match(validateReviewResult(request, result).join('\n'), /至少需要一項 finding/);
});

test('no_additional_findings 不會被轉成 approved 或 completion', () => {
  const request = baseRequest();
  const result = createReviewResult(request, {
    verdict: 'no_additional_findings',
    findings: []
  });
  const proposal = toCriticalRelayProposal(result);
  assert.equal(proposal.advisoryOnly, true);
  assert.equal(proposal.canSatisfyRequiredReview, false);
  assert.equal(proposal.completionEffect, 'none');
  assert.deepEqual(proposal.challenges, []);
  assert.deepEqual(proposal.counterEvidence, []);
});

test('Reviewer finding 只會產生 open challenge/counterEvidence', () => {
  const request = baseRequest();
  const result = createReviewResult(request, {
    verdict: 'concerns_found',
    findings: [finding()]
  });
  const proposal = toCriticalRelayProposal(result);
  assert.equal(proposal.challenges.length, 1);
  assert.equal(proposal.counterEvidence.length, 1);
  assert.equal(proposal.challenges[0].status, 'open');
  assert.equal(proposal.counterEvidence[0].status, 'open');
  assert.deepEqual(proposal.challenges[0].claimRefs, ['claim-reconnect']);
  assert.equal(proposal.completionEffect, 'none');
});

test('相同 reviewId 不能重複 reserve', () => {
  const dir = tempState();
  const request = baseRequest();
  reserveReview(dir, request);
  assert.throws(
    () => reserveReview(dir, request),
    error => error instanceof SameChatReviewError && error.code === 'REVIEW_REPLAY'
  );
});

test('submit result 後不能重複 submit', () => {
  const dir = tempState();
  const request = baseRequest();
  reserveReview(dir, request);
  const result = createReviewResult(request, {
    verdict: 'concerns_found',
    findings: [finding()]
  });
  submitReviewResult(dir, request, result);
  assert.throws(
    () => submitReviewResult(dir, request, result),
    error => error instanceof SameChatReviewError && error.code === 'RESULT_REPLAY'
  );
});

test('result 只能 consume 一次', () => {
  const dir = tempState();
  const request = baseRequest();
  reserveReview(dir, request);
  const result = createReviewResult(request, {
    verdict: 'concerns_found',
    findings: [finding()]
  });
  submitReviewResult(dir, request, result);
  const consumed = consumeReviewResult(dir, request.reviewId);
  assert.equal(consumed.state.status, 'consumed');
  assert.equal(consumed.result.reviewId, request.reviewId);
  assert.throws(
    () => consumeReviewResult(dir, request.reviewId),
    error => error instanceof SameChatReviewError && error.code === 'NOT_READY'
  );
});

test('result 中的 canary secret 會在持久化前遮罩', () => {
  const dir = tempState();
  const request = baseRequest();
  reserveReview(dir, request);
  const marker = 'CANARY_ONLY_NOT_REAL_SECRET';
  const result = createReviewResult(request, {
    verdict: 'concerns_found',
    findings: [
      finding({
        claim: `token=${marker}`,
        reason: `authorization=Bearer ${marker}`
      })
    ]
  });
  const submitted = submitReviewResult(dir, request, result);
  const raw = fs.readFileSync(submitted.statePath, 'utf8');
  assert.equal(raw.includes(marker), false);
  assert.match(raw, /REDACTED/);
});

test('過期 request 不能 reserve', () => {
  const dir = tempState();
  const request = baseRequest({
    now: Date.now() - 10_000,
    ttlMs: 1000
  });
  assert.throws(
    () => reserveReview(dir, request),
    error => error instanceof SameChatReviewError && error.code === 'INVALID_REQUEST'
  );
});

test('request 不能偽裝 independent review', () => {
  const request = baseRequest();
  request.independentReview = true;
  request.canSatisfyRequiredReview = true;
  const reasons = validateReviewRequest(request);
  assert.match(reasons.join('\n'), /不得宣稱 independentReview=true/);
  assert.match(reasons.join('\n'), /不得滿足 required independent review/);
});
