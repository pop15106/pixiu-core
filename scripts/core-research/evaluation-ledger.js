'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { appendFile, mkdir, readFile } = require('node:fs/promises');

const {
  stableSerialize,
  verifyEvaluationTask,
} = require('./evaluation-task-builder');

const EVENT_TYPES = new Set([
  'EVALUATION_PREPARED',
  'WORKSPACE_SCANNED',
  'EVIDENCE_RECORDED',
  'REVIEW_READY',
  'APPROVAL_RECORDED',
]);
const APPROVAL_RESULTS = Object.freeze({
  'approve-plan': 'APPROVED_FOR_PLAN',
  defer: 'DEFERRED',
  reject: 'REJECTED',
});

function createError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nestedValue of Object.values(value)) deepFreeze(nestedValue);
  return Object.freeze(value);
}

function normalizeDate(value, fieldName = 'eventAt') {
  const timestamp = value === undefined ? Date.now() : Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw createError('EVALUATION_EVENT_TIME_INVALID', `${fieldName} 必須是有效日期`);
  }
  return new Date(timestamp).toISOString();
}

function createEvent({ taskId, taskDigest, eventType, eventAt, payload = {} }) {
  if (!EVENT_TYPES.has(eventType)) {
    throw createError('EVALUATION_EVENT_TYPE_INVALID', `不支援的事件：${eventType}`);
  }
  if (typeof taskId !== 'string' || !taskId) {
    throw createError('EVALUATION_EVENT_INVALID', 'taskId 不可為空');
  }
  if (!/^[a-f0-9]{64}$/.test(taskDigest || '')) {
    throw createError('EVALUATION_EVENT_INVALID', 'taskDigest 格式不合法');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createError('EVALUATION_EVENT_INVALID', 'payload 必須是物件');
  }

  const normalizedEventAt = normalizeDate(eventAt);
  const eventSeed = {
    schemaVersion: 'pixiu.core-research/evaluation-event-v1',
    eventType,
    eventAt: normalizedEventAt,
    taskId,
    taskDigest,
    payload,
  };
  const eventDigest = crypto.createHash('sha256').update(stableSerialize(eventSeed)).digest('hex');
  return deepFreeze({
    ...eventSeed,
    eventId: `event-${eventDigest.slice(0, 24)}`,
    integrity: {
      algorithm: 'sha256',
      value: eventDigest,
    },
  });
}

function verifyEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw createError('EVALUATION_EVENT_INVALID', 'Ledger event 必須是物件');
  }
  if (event.schemaVersion !== 'pixiu.core-research/evaluation-event-v1') {
    throw createError('EVALUATION_EVENT_INVALID', 'Ledger event Schema 不支援');
  }
  if (!EVENT_TYPES.has(event.eventType)) {
    throw createError('EVALUATION_EVENT_TYPE_INVALID', `不支援的事件：${event.eventType}`);
  }
  if (event.integrity?.algorithm !== 'sha256' || !/^[a-f0-9]{64}$/.test(event.integrity.value || '')) {
    throw createError('EVALUATION_EVENT_INTEGRITY_INVALID', 'Ledger event Digest 格式不合法');
  }
  const eventSeed = {
    schemaVersion: event.schemaVersion,
    eventType: event.eventType,
    eventAt: event.eventAt,
    taskId: event.taskId,
    taskDigest: event.taskDigest,
    payload: event.payload,
  };
  const actual = crypto.createHash('sha256').update(stableSerialize(eventSeed)).digest('hex');
  if (actual !== event.integrity.value || event.eventId !== `event-${actual.slice(0, 24)}`) {
    throw createError('EVALUATION_EVENT_INTEGRITY_MISMATCH', 'Ledger event 遭竄改');
  }
  return deepFreeze({ ...event });
}

async function readEvaluationLedger(ledgerPath) {
  let text;
  try {
    text = await readFile(ledgerPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return Object.freeze([]);
    throw error;
  }

  const events = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw createError(
        'EVALUATION_LEDGER_LINE_INVALID',
        `Evaluation Ledger 第 ${index + 1} 行不是有效 JSON`,
        { lineNumber: index + 1 },
      );
    }
    events.push(verifyEvent(parsed));
  }
  return Object.freeze(events);
}

function deriveEvaluationStates(events) {
  if (!Array.isArray(events)) {
    throw createError('EVALUATION_EVENTS_INVALID', 'events 必須是陣列');
  }
  const states = {};
  for (const rawEvent of events) {
    const event = verifyEvent(rawEvent);
    const current = states[event.taskId] || {
      taskId: event.taskId,
      taskDigest: event.taskDigest,
      state: null,
      concerns: [],
      lastEventAt: null,
    };
    if (current.taskDigest !== event.taskDigest) {
      throw createError('EVALUATION_TASK_DIGEST_MISMATCH', '同一 Task 的 Digest 不一致');
    }

    assertTransition(event.eventType, current.state);

    let state = current.state;
    let concerns = [...current.concerns];
    if (event.eventType === 'EVALUATION_PREPARED') state = 'PREPARED';
    if (event.eventType === 'WORKSPACE_SCANNED') state = 'EVALUATING';
    if (event.eventType === 'EVIDENCE_RECORDED') {
      concerns = [...new Set(event.payload.concerns || [])];
      state = concerns.length > 0 || event.payload.sandboxStatus === 'SKIPPED_UNAVAILABLE'
        ? 'REVIEW_READY_WITH_CONCERNS'
        : 'REVIEW_READY';
    }
    if (event.eventType === 'REVIEW_READY') state = 'AWAITING_APPROVAL';
    if (event.eventType === 'APPROVAL_RECORDED') state = event.payload.resultState;

    states[event.taskId] = {
      taskId: event.taskId,
      taskDigest: event.taskDigest,
      state,
      concerns,
      lastEventAt: event.eventAt,
    };
  }
  return deepFreeze(states);
}

function assertTransition(eventType, currentState) {
  const allowedPrevious = {
    EVALUATION_PREPARED: [null],
    WORKSPACE_SCANNED: ['PREPARED'],
    EVIDENCE_RECORDED: ['EVALUATING'],
    REVIEW_READY: ['REVIEW_READY', 'REVIEW_READY_WITH_CONCERNS'],
    APPROVAL_RECORDED: ['AWAITING_APPROVAL'],
  };
  if (!allowedPrevious[eventType].includes(currentState)) {
    throw createError(
      'EVALUATION_STATE_TRANSITION_INVALID',
      `${currentState || 'NONE'} 不可追加 ${eventType}`,
    );
  }
}

async function appendRawEvent({ ledgerPath, event }) {
  if (typeof ledgerPath !== 'string' || ledgerPath.trim() === '') {
    throw createError('EVALUATION_LEDGER_PATH_REQUIRED', 'ledgerPath 不可為空');
  }
  await mkdir(path.dirname(path.resolve(ledgerPath)), { recursive: true });
  await appendFile(ledgerPath, `${JSON.stringify(event)}\n`, 'utf8');
  return event;
}

async function appendEvaluationEvent({ ledgerPath, task: inputTask, eventType, eventAt, payload = {} } = {}) {
  const task = verifyEvaluationTask(inputTask);
  const events = await readEvaluationLedger(ledgerPath);
  const states = deriveEvaluationStates(events);
  const current = states[task.taskId];
  if (current && current.taskDigest !== task.integrity.value) {
    throw createError('EVALUATION_TASK_DIGEST_MISMATCH', '同一 Task 的 Digest 不一致');
  }
  assertTransition(eventType, current?.state || null);
  const event = createEvent({
    taskId: task.taskId,
    taskDigest: task.integrity.value,
    eventType,
    eventAt,
    payload,
  });
  return appendRawEvent({ ledgerPath, event });
}

async function recordHumanApproval({
  ledgerPath,
  taskId,
  decision,
  actor,
  comment,
  decidedAt,
} = {}) {
  if (!Object.hasOwn(APPROVAL_RESULTS, decision)) {
    throw createError('APPROVAL_DECISION_INVALID', 'decision 只允許 approve-plan、defer 或 reject');
  }
  if (typeof actor !== 'string' || !actor.startsWith('human:') || actor.length <= 'human:'.length) {
    throw createError('APPROVAL_HUMAN_REQUIRED', '人工核准 actor 必須以 human: 開頭');
  }
  if (typeof comment !== 'string' || comment.trim() === '') {
    throw createError('APPROVAL_COMMENT_REQUIRED', '人工核准 comment 不可為空');
  }

  const events = await readEvaluationLedger(ledgerPath);
  const states = deriveEvaluationStates(events);
  const current = states[taskId];
  if (!current || current.state !== 'AWAITING_APPROVAL') {
    throw createError('APPROVAL_STATE_INVALID', '只有 AWAITING_APPROVAL 可進行人工核准');
  }
  const event = createEvent({
    taskId,
    taskDigest: current.taskDigest,
    eventType: 'APPROVAL_RECORDED',
    eventAt: decidedAt,
    payload: {
      decision,
      resultState: APPROVAL_RESULTS[decision],
      actor,
      comment: comment.trim(),
    },
  });
  return appendRawEvent({ ledgerPath, event });
}

module.exports = {
  appendEvaluationEvent,
  deriveEvaluationStates,
  readEvaluationLedger,
  recordHumanApproval,
};
