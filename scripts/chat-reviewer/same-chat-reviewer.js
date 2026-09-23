#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REQUEST_SCHEMA = 'pixiu.same-chat-review.request.v1';
const RESULT_SCHEMA = 'pixiu.same-chat-review.result.v1';
const STORE_SCHEMA = 'pixiu.same-chat-review.store.v1';
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_TTL_MS = 15 * 60 * 1000;
const MAX_TEXT = 8000;
const MAX_CRITERIA = 20;
const MAX_FINDINGS = 50;

class SameChatReviewError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SameChatReviewError';
    this.code = code;
  }
}

function nowMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function iso(value) {
  return new Date(nowMs(value)).toISOString();
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function createReviewId(at = Date.now()) {
  const stamp = new Date(nowMs(at)).toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
    .replace('T', '-');
  return `samechat-review-${stamp}-${crypto.randomBytes(4).toString('hex')}`;
}

function normalizeHash(value, fieldName) {
  const text = String(value || '').trim().toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(text)) {
    throw new SameChatReviewError('INVALID_HASH', `${fieldName} 必須是 sha256:<64 hex>`);
  }
  return text;
}

function hashSnapshot(snapshot) {
  if (typeof snapshot === 'string') {
    return `sha256:${sha256(snapshot)}`;
  }
  return `sha256:${sha256(JSON.stringify(snapshot ?? null))}`;
}

function requiredText(value, fieldName, max = MAX_TEXT) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new SameChatReviewError('INVALID_TEXT', `${fieldName} 必須是非空字串`);
  }
  const text = value.trim();
  if (text.length > max) {
    throw new SameChatReviewError('TEXT_TOO_LONG', `${fieldName} 超過 ${max} 字元`);
  }
  return text;
}

function stringArray(value, fieldName, options = {}) {
  const min = options.min ?? 0;
  const max = options.max ?? MAX_CRITERIA;
  if (!Array.isArray(value)) {
    throw new SameChatReviewError('INVALID_ARRAY', `${fieldName} 必須是陣列`);
  }
  if (value.length < min || value.length > max) {
    throw new SameChatReviewError(
      'INVALID_ARRAY_SIZE',
      `${fieldName} 數量必須介於 ${min} 到 ${max}`
    );
  }
  return value.map((item, index) => requiredText(item, `${fieldName}[${index}]`, 1000));
}

function createReviewRequest(input = {}) {
  const createdAtMs = nowMs(input.now);
  const ttlMs = Number(input.ttlMs ?? DEFAULT_TTL_MS);
  if (!Number.isInteger(ttlMs) || ttlMs <= 0 || ttlMs > MAX_TTL_MS) {
    throw new SameChatReviewError('INVALID_TTL', `ttlMs 必須是 1 到 ${MAX_TTL_MS} 的整數`);
  }

  const subjectRevision = Number(input.subjectRevision);
  if (!Number.isInteger(subjectRevision) || subjectRevision < 1) {
    throw new SameChatReviewError('INVALID_REVISION', 'subjectRevision 必須是大於 0 的整數');
  }

  const snapshotHash = input.snapshotHash
    ? normalizeHash(input.snapshotHash, 'snapshotHash')
    : hashSnapshot(input.snapshot);

  return {
    schema: REQUEST_SCHEMA,
    reviewId: requiredText(input.reviewId || createReviewId(createdAtMs), 'reviewId', 160),
    taskId: requiredText(input.taskId, 'taskId', 160),
    mode: 'same_chat_advisory',
    independentReview: false,
    canSatisfyRequiredReview: false,
    subjectRevision,
    snapshotHash,
    question: requiredText(input.question, 'question', 4000),
    criteria: stringArray(input.criteria, 'criteria', { min: 1, max: MAX_CRITERIA }),
    createdAt: new Date(createdAtMs).toISOString(),
    expiresAt: new Date(createdAtMs + ttlMs).toISOString()
  };
}

function validateReviewRequest(request, options = {}) {
  const reasons = [];
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return ['request 必須是物件'];
  }
  if (request.schema !== REQUEST_SCHEMA) reasons.push('request.schema 不符');
  if (request.mode !== 'same_chat_advisory') reasons.push('request.mode 不符');
  if (request.independentReview !== false) reasons.push('Same-Chat review 不得宣稱 independentReview=true');
  if (request.canSatisfyRequiredReview !== false) {
    reasons.push('Same-Chat review 不得滿足 required independent review');
  }

  for (const key of ['reviewId', 'taskId', 'question']) {
    if (typeof request[key] !== 'string' || !request[key].trim()) {
      reasons.push(`request.${key} 缺失`);
    }
  }
  if (!Number.isInteger(request.subjectRevision) || request.subjectRevision < 1) {
    reasons.push('request.subjectRevision 無效');
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(String(request.snapshotHash || ''))) {
    reasons.push('request.snapshotHash 無效');
  }
  if (!Array.isArray(request.criteria) || request.criteria.length < 1 || request.criteria.length > MAX_CRITERIA) {
    reasons.push('request.criteria 無效');
  }

  const createdAtMs = Date.parse(request.createdAt || '');
  const expiresAtMs = Date.parse(request.expiresAt || '');
  if (!Number.isFinite(createdAtMs)) reasons.push('request.createdAt 無效');
  if (!Number.isFinite(expiresAtMs)) reasons.push('request.expiresAt 無效');
  if (Number.isFinite(createdAtMs) && Number.isFinite(expiresAtMs) && expiresAtMs <= createdAtMs) {
    reasons.push('request.expiresAt 必須晚於 createdAt');
  }

  if (options.checkExpiry === true && Number.isFinite(expiresAtMs) && Date.now() >= expiresAtMs) {
    reasons.push('request 已過期');
  }
  return reasons;
}

function buildReviewerPrompt(request, context = {}) {
  const reasons = validateReviewRequest(request, { checkExpiry: true });
  if (reasons.length) {
    throw new SameChatReviewError('INVALID_REQUEST', reasons.join('；'));
  }

  const objective = requiredText(context.objective || request.question, 'context.objective', 4000);
  const candidate = requiredText(context.candidate, 'context.candidate', 12000);
  const evidenceRefs = Array.isArray(context.evidenceRefs)
    ? context.evidenceRefs.map((item, index) => requiredText(item, `context.evidenceRefs[${index}]`, 1000))
    : [];
  const constraints = Array.isArray(context.constraints)
    ? context.constraints.map((item, index) => requiredText(item, `context.constraints[${index}]`, 1000))
    : [];

  const payload = {
    reviewId: request.reviewId,
    taskId: request.taskId,
    subjectRevision: request.subjectRevision,
    snapshotHash: request.snapshotHash,
    objective,
    candidate,
    criteria: request.criteria,
    evidenceRefs,
    constraints
  };

  return [
    '你現在執行 Same-Chat Advisory Review。',
    '這不是獨立 reviewer，也不能滿足 required independent review。',
    '請只針對下列固定 revision/snapshot 找反例、錯誤假設、遺漏風險與需要補的測試。',
    'Reviewer 回覆不能直接把 CR claim 標成 supported/resolved，也不能直接授權修改、Git、Release 或完成任務。',
    '完成後請透過結果提交工具回填 reviewId、taskId、subjectRevision、snapshotHash、verdict 與 findings。',
    JSON.stringify(payload)
  ].join('\n');
}

function evaluateHostCapabilities(capabilities = {}) {
  const uiMessage = capabilities.uiMessage === true;
  const toolCall = capabilities.toolCall === true;
  const sessionCorrelation = capabilities.sessionCorrelation === true;
  const resultSubmissionTool = capabilities.resultSubmissionTool === true;

  return {
    schema: 'pixiu.same-chat-review.capabilities.v1',
    uiMessage,
    toolCall,
    sessionCorrelation,
    resultSubmissionTool,
    dispatchReady: uiMessage,
    resultReturnReady: toolCall && resultSubmissionTool,
    correlationReady: sessionCorrelation,
    protocolReady: uiMessage && toolCall && sessionCorrelation && resultSubmissionTool,
    autoContinueVerified: false,
    notes: [
      'ui/message 或 sendFollowUpMessage 只證明可要求宿主張貼後續訊息。',
      'tool result 不等於 Chat 最新模型回答。',
      'autoContinueVerified 必須由真實宿主 E2E 收據驗證，不能由 capability boolean 宣告。'
    ]
  };
}

function validateFinding(finding, index) {
  const reasons = [];
  if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
    return [`findings[${index}] 必須是物件`];
  }
  if (typeof finding.id !== 'string' || !finding.id.trim()) reasons.push(`findings[${index}].id 缺失`);
  if (!['low', 'medium', 'high', 'critical'].includes(finding.severity)) {
    reasons.push(`findings[${index}].severity 無效`);
  }
  if (typeof finding.claim !== 'string' || !finding.claim.trim()) reasons.push(`findings[${index}].claim 缺失`);
  if (typeof finding.reason !== 'string' || !finding.reason.trim()) reasons.push(`findings[${index}].reason 缺失`);
  if (!Array.isArray(finding.claimRefs) || finding.claimRefs.length < 1) {
    reasons.push(`findings[${index}].claimRefs 至少需要一項`);
  }
  if (finding.evidenceRefs !== undefined && !Array.isArray(finding.evidenceRefs)) {
    reasons.push(`findings[${index}].evidenceRefs 必須是陣列`);
  }
  if (finding.suggestedTests !== undefined && !Array.isArray(finding.suggestedTests)) {
    reasons.push(`findings[${index}].suggestedTests 必須是陣列`);
  }
  return reasons;
}

function validateReviewResult(request, result, options = {}) {
  const reasons = [];
  reasons.push(...validateReviewRequest(request, { checkExpiry: options.checkExpiry === true }));

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    reasons.push('result 必須是物件');
    return [...new Set(reasons)];
  }
  if (result.schema !== RESULT_SCHEMA) reasons.push('result.schema 不符');
  if (result.reviewId !== request?.reviewId) reasons.push('reviewId 不一致');
  if (result.taskId !== request?.taskId) reasons.push('taskId 不一致');
  if (result.subjectRevision !== request?.subjectRevision) reasons.push('subjectRevision 不一致');
  if (result.snapshotHash !== request?.snapshotHash) reasons.push('snapshotHash 不一致');
  if (!['concerns_found', 'no_additional_findings', 'blocked'].includes(result.verdict)) {
    reasons.push('result.verdict 無效');
  }
  if (!Array.isArray(result.findings) || result.findings.length > MAX_FINDINGS) {
    reasons.push('result.findings 無效');
  } else {
    result.findings.forEach((finding, index) => reasons.push(...validateFinding(finding, index)));
  }
  if (result.verdict === 'concerns_found' && result.findings?.length === 0) {
    reasons.push('concerns_found 至少需要一項 finding');
  }
  if (result.verdict === 'no_additional_findings' && result.findings?.length > 0) {
    reasons.push('no_additional_findings 不應同時包含 findings');
  }
  if (!Number.isFinite(Date.parse(result.completedAt || ''))) {
    reasons.push('result.completedAt 無效');
  }
  return [...new Set(reasons)];
}

function createReviewResult(request, input = {}) {
  const findings = Array.isArray(input.findings) ? input.findings : [];
  const result = {
    schema: RESULT_SCHEMA,
    reviewId: request.reviewId,
    taskId: request.taskId,
    subjectRevision: request.subjectRevision,
    snapshotHash: request.snapshotHash,
    verdict: input.verdict || (findings.length ? 'concerns_found' : 'no_additional_findings'),
    findings,
    completedAt: iso(input.now)
  };
  const reasons = validateReviewResult(request, result);
  if (reasons.length) {
    throw new SameChatReviewError('INVALID_RESULT', reasons.join('；'));
  }
  return result;
}

function redactSensitiveText(value) {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(authorization|api[-_]?key|token|cookie|secret|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
}

function safeFinding(finding) {
  return {
    id: String(finding.id).slice(0, 160),
    severity: finding.severity,
    claim: redactSensitiveText(finding.claim).slice(0, 4000),
    reason: redactSensitiveText(finding.reason).slice(0, 6000),
    claimRefs: finding.claimRefs.map(String).slice(0, 20),
    evidenceRefs: Array.isArray(finding.evidenceRefs) ? finding.evidenceRefs.map(String).slice(0, 50) : [],
    suggestedTests: Array.isArray(finding.suggestedTests)
      ? finding.suggestedTests.map(item => redactSensitiveText(item).slice(0, 1000)).slice(0, 20)
      : []
  };
}

function safeReviewResult(result) {
  return {
    schema: RESULT_SCHEMA,
    reviewId: String(result.reviewId).slice(0, 160),
    taskId: String(result.taskId).slice(0, 160),
    subjectRevision: result.subjectRevision,
    snapshotHash: result.snapshotHash,
    verdict: result.verdict,
    findings: result.findings.map(safeFinding),
    completedAt: result.completedAt
  };
}

function defaultStateDirectory(corePath) {
  const core = corePath ||
    process.env.PIXIU_CORE ||
    process.env.PIXIU_CORE_PATH ||
    path.resolve(__dirname, '..', '..');
  return path.join(core, 'state', 'same-chat-reviewer');
}

function reviewStatePath(stateDirectory, reviewId) {
  const key = sha256(reviewId);
  return path.join(path.resolve(stateDirectory || defaultStateDirectory()), 'reviews', `${key}.json`);
}

function readReviewState(statePath) {
  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

function writeReviewState(statePath, state, exclusive = false) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(
    statePath,
    JSON.stringify(state, null, 2) + '\n',
    exclusive ? { encoding: 'utf8', flag: 'wx' } : 'utf8'
  );
}

function reserveReview(stateDirectory, request) {
  const reasons = validateReviewRequest(request, { checkExpiry: true });
  if (reasons.length) throw new SameChatReviewError('INVALID_REQUEST', reasons.join('；'));

  const statePath = reviewStatePath(stateDirectory, request.reviewId);
  const state = {
    schema: STORE_SCHEMA,
    reviewIdHash: sha256(request.reviewId),
    correlationHash: sha256([
      request.reviewId,
      request.taskId,
      request.subjectRevision,
      request.snapshotHash
    ].join('\u0000')),
    status: 'pending',
    request: {
      schema: request.schema,
      reviewId: request.reviewId,
      taskId: request.taskId,
      mode: request.mode,
      independentReview: false,
      canSatisfyRequiredReview: false,
      subjectRevision: request.subjectRevision,
      snapshotHash: request.snapshotHash,
      criteria: request.criteria,
      createdAt: request.createdAt,
      expiresAt: request.expiresAt
    },
    result: null
  };

  try {
    writeReviewState(statePath, state, true);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new SameChatReviewError('REVIEW_REPLAY', '相同 reviewId 已存在，禁止重複建立');
    }
    throw error;
  }
  return { statePath, state };
}

function submitReviewResult(stateDirectory, request, result) {
  const reasons = validateReviewResult(request, result, { checkExpiry: true });
  if (reasons.length) throw new SameChatReviewError('INVALID_RESULT', reasons.join('；'));

  const statePath = reviewStatePath(stateDirectory, request.reviewId);
  if (!fs.existsSync(statePath)) {
    throw new SameChatReviewError('UNKNOWN_REVIEW', '找不到 review request');
  }
  const state = readReviewState(statePath);
  if (state.status !== 'pending') {
    throw new SameChatReviewError('RESULT_REPLAY', `review 狀態已是 ${state.status}`);
  }

  const expectedCorrelation = sha256([
    request.reviewId,
    request.taskId,
    request.subjectRevision,
    request.snapshotHash
  ].join('\u0000'));
  if (state.correlationHash !== expectedCorrelation) {
    throw new SameChatReviewError('CORRELATION_MISMATCH', 'review correlation hash 不一致');
  }

  state.status = 'result_received';
  state.result = safeReviewResult(result);
  state.receivedAt = iso();
  writeReviewState(statePath, state);
  return { statePath, state };
}

function consumeReviewResult(stateDirectory, reviewId) {
  const statePath = reviewStatePath(stateDirectory, reviewId);
  if (!fs.existsSync(statePath)) {
    throw new SameChatReviewError('UNKNOWN_REVIEW', '找不到 review request');
  }
  const state = readReviewState(statePath);
  if (state.status !== 'result_received') {
    throw new SameChatReviewError('NOT_READY', `review 狀態為 ${state.status}，不可 consume`);
  }
  state.status = 'consumed';
  state.consumedAt = iso();
  writeReviewState(statePath, state);
  return { statePath, state, result: state.result };
}

function toCriticalRelayProposal(result) {
  if (!result || result.schema !== RESULT_SCHEMA) {
    throw new SameChatReviewError('INVALID_RESULT', 'result schema 不符');
  }

  const challenges = [];
  const counterEvidence = [];
  for (const finding of result.findings) {
    const suffix = sha256(`${result.reviewId}\u0000${finding.id}`).slice(0, 12);
    challenges.push({
      id: `samechat-challenge-${suffix}`,
      claimRefs: [...finding.claimRefs],
      severity: finding.severity,
      status: 'open',
      method: 'same-chat-advisory-review',
      result: redactSensitiveText(finding.reason)
    });
    counterEvidence.push({
      id: `samechat-counter-${suffix}`,
      claimRefs: [...finding.claimRefs],
      severity: finding.severity,
      status: 'open',
      provenance: `urn:pixiu:same-chat-review:${result.reviewId}`,
      summary: redactSensitiveText(finding.claim),
      evidenceRefs: [...(finding.evidenceRefs || [])],
      suggestedTests: [...(finding.suggestedTests || [])]
    });
  }

  return {
    reviewId: result.reviewId,
    advisoryOnly: true,
    independentReview: false,
    canSatisfyRequiredReview: false,
    reviewerVerdict: result.verdict,
    challenges,
    counterEvidence,
    completionEffect: 'none',
    note: 'Same-Chat Reviewer 只能提出待驗證 challenge/counterEvidence，不能直接 resolve CR 或滿足 independent review。'
  };
}

module.exports = {
  REQUEST_SCHEMA,
  RESULT_SCHEMA,
  STORE_SCHEMA,
  DEFAULT_TTL_MS,
  SameChatReviewError,
  buildReviewerPrompt,
  consumeReviewResult,
  createReviewId,
  createReviewRequest,
  createReviewResult,
  defaultStateDirectory,
  evaluateHostCapabilities,
  hashSnapshot,
  redactSensitiveText,
  reserveReview,
  reviewStatePath,
  submitReviewResult,
  toCriticalRelayProposal,
  validateReviewRequest,
  validateReviewResult
};
