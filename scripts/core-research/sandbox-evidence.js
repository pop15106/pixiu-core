'use strict';

const { verifyEvaluationTask } = require('./evaluation-task-builder');

const ALLOWED_STATUSES = new Set(['PASS', 'FAIL', 'SKIPPED_UNAVAILABLE']);

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nestedValue of Object.values(value)) deepFreeze(nestedValue);
  return Object.freeze(value);
}

function normalizeDate(value, fieldName) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw createError('SANDBOX_EVIDENCE_INVALID', `${fieldName} 必須是有效日期`);
  }
  return new Date(timestamp).toISOString();
}

function requireText(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw createError('SANDBOX_EVIDENCE_INVALID', `${fieldName} 不可為空`);
  }
  return value.trim();
}

function commandKey(command) {
  return command.map((part) => JSON.stringify(part)).join('\n');
}

function validateSandboxEvidence(inputTask, input) {
  const task = verifyEvaluationTask(inputTask);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw createError('SANDBOX_EVIDENCE_INVALID', 'Sandbox evidence 必須是物件');
  }
  if (input.taskId !== task.taskId || input.taskDigest !== task.integrity.value) {
    throw createError('SANDBOX_TASK_MISMATCH', 'Sandbox evidence 與 Evaluation Task 不一致');
  }
  if (!ALLOWED_STATUSES.has(input.status)) {
    throw createError('SANDBOX_STATUS_INVALID', 'Sandbox status 不支援');
  }

  const recordedAt = normalizeDate(input.recordedAt, 'recordedAt');
  if (input.status === 'SKIPPED_UNAVAILABLE') {
    return deepFreeze({
      schemaVersion: 'pixiu.core-research/sandbox-evidence-v1',
      taskId: task.taskId,
      taskDigest: task.integrity.value,
      status: input.status,
      recordedAt,
      reason: requireText(input.reason, 'reason'),
      command: null,
      durationMs: null,
      exitCode: null,
      timedOut: null,
      outputBytes: null,
      networkIsolated: false,
      secretsAvailable: false,
      workspaceOnly: true,
      concerns: ['SANDBOX_UNAVAILABLE'],
    });
  }

  if (!Array.isArray(input.command) || input.command.length === 0 || input.command.some((part) => (
    typeof part !== 'string' || part.trim() === ''
  ))) {
    throw createError('SANDBOX_COMMAND_INVALID', 'Sandbox command 必須是非空字串陣列');
  }
  const approved = new Set(task.sandboxPolicy.approvedCommands.map(commandKey));
  if (!approved.has(commandKey(input.command))) {
    throw createError('SANDBOX_COMMAND_NOT_APPROVED', 'Sandbox command 未列入 Task 核准清單');
  }
  if (input.networkIsolated !== true) {
    throw createError('SANDBOX_ISOLATION_REQUIRED', 'Sandbox PASS／FAIL 必須具備可驗證的網路隔離');
  }
  if (input.secretsAvailable !== false) {
    throw createError('SANDBOX_SECRETS_FORBIDDEN', 'Sandbox 不得提供正式秘密');
  }
  if (input.workspaceOnly !== true) {
    throw createError('SANDBOX_WORKSPACE_ONLY_REQUIRED', 'Sandbox 必須限制在候選工作區');
  }
  if (!Number.isFinite(input.durationMs) || input.durationMs < 0) {
    throw createError('SANDBOX_EVIDENCE_INVALID', 'durationMs 必須是非負數');
  }
  if (input.durationMs > task.sandboxPolicy.timeoutMs) {
    throw createError('SANDBOX_TIMEOUT_EXCEEDED', 'Sandbox 執行時間超過 Task 限制');
  }
  if (!Number.isFinite(input.outputBytes) || input.outputBytes < 0) {
    throw createError('SANDBOX_EVIDENCE_INVALID', 'outputBytes 必須是非負數');
  }
  if (input.outputBytes > task.sandboxPolicy.maxOutputBytes) {
    throw createError('SANDBOX_OUTPUT_LIMIT_EXCEEDED', 'Sandbox 輸出量超過 Task 限制');
  }
  if (!Number.isInteger(input.exitCode)) {
    throw createError('SANDBOX_EVIDENCE_INVALID', 'exitCode 必須是整數');
  }
  if (typeof input.timedOut !== 'boolean') {
    throw createError('SANDBOX_EVIDENCE_INVALID', 'timedOut 必須是布林值');
  }
  if (input.status === 'PASS' && (input.exitCode !== 0 || input.timedOut)) {
    throw createError('SANDBOX_PASS_INVALID', 'PASS 必須 exitCode 0 且未超時');
  }

  const concerns = [];
  if (input.status === 'FAIL') concerns.push('SANDBOX_TEST_FAILED');
  return deepFreeze({
    schemaVersion: 'pixiu.core-research/sandbox-evidence-v1',
    taskId: task.taskId,
    taskDigest: task.integrity.value,
    status: input.status,
    recordedAt,
    reason: null,
    command: [...input.command],
    durationMs: input.durationMs,
    exitCode: input.exitCode,
    timedOut: input.timedOut,
    outputBytes: input.outputBytes,
    networkIsolated: true,
    secretsAvailable: false,
    workspaceOnly: true,
    concerns,
  });
}

module.exports = {
  validateSandboxEvidence,
};
