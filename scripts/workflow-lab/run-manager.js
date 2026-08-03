#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');

const TERMINAL_STATUSES = new Set(['green', 'red', 'failed', 'cancelled']);
const ALLOWED_TRANSITIONS = Object.freeze({
  queued: new Set(['running', 'paused', 'cancelled']),
  running: new Set(['green', 'paused', 'red', 'failed', 'cancelled']),
  paused: new Set(['running', 'red', 'failed', 'cancelled']),
  green: new Set(),
  red: new Set(),
  failed: new Set(),
  cancelled: new Set()
});

class RunStateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RunStateError';
    this.code = code;
  }
}

function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function createWorkflowRunManager(options = {}) {
  const {
    idFactory = () => crypto.randomUUID(),
    now = () => new Date().toISOString(),
    maxLogChars = 200000
  } = options;
  if (!Number.isInteger(maxLogChars) || maxLogChars < 1) {
    throw new TypeError('maxLogChars 必須是正整數');
  }

  const runs = new Map();
  const redactors = new Map();
  let activeRunId = null;
  let latestRunId = null;

  function getInternal(runId) {
    const run = runs.get(runId);
    if (!run) {
      throw new RunStateError('UNKNOWN_RUN', `找不到 Workflow Run：${runId}`);
    }
    return run;
  }

  function create(metadata = {}, context = {}) {
    if (activeRunId) {
      throw new RunStateError('ACTIVE_RUN_EXISTS', `已有 Workflow Run 執行中：${activeRunId}`);
    }
    const id = String(idFactory());
    const run = {
      id,
      status: 'queued',
      mode: metadata.mode || 'offline',
      inputMode: metadata.inputMode || 'need-to-know',
      selectionMode: metadata.selectionMode || 'partial',
      moduleSequence: cloneValue(metadata.moduleSequence || []),
      createdAt: now(),
      startedAt: null,
      finishedAt: null,
      currentModuleId: null,
      pendingApproval: null,
      iteration: 1,
      steps: [],
      artifacts: [],
      log: '',
      error: null
    };
    runs.set(id, run);
    latestRunId = id;
    if (context.redactor) {
      redactors.set(id, context.redactor);
    }
    activeRunId = id;
    return getSnapshot(id);
  }

  function transition(runId, nextStatus) {
    const run = getInternal(runId);
    if (!ALLOWED_TRANSITIONS[run.status] || !ALLOWED_TRANSITIONS[run.status].has(nextStatus)) {
      throw new RunStateError(
        'INVALID_RUN_TRANSITION',
        `Run 狀態不可由 ${run.status} 轉為 ${nextStatus}`
      );
    }
    run.status = nextStatus;
    if (nextStatus === 'running' && !run.startedAt) {
      run.startedAt = now();
    }
    if (TERMINAL_STATUSES.has(nextStatus)) {
      run.finishedAt = now();
      run.currentModuleId = null;
      run.pendingApproval = null;
      if (activeRunId === run.id) {
        activeRunId = null;
      }
    }
    return getSnapshot(runId);
  }

  function setRedactor(runId, redactor) {
    getInternal(runId);
    if (!redactor
      || typeof redactor.redactText !== 'function'
      || typeof redactor.redactValue !== 'function') {
      throw new TypeError('redactor 必須提供 redactText() 與 redactValue()');
    }
    redactors.set(runId, redactor);
  }

  function redactVisibleValue(runId, value) {
    const redactor = redactors.get(runId);
    return redactor ? redactor.redactValue(value) : cloneValue(value);
  }

  function appendLog(runId, text) {
    const run = getInternal(runId);
    const redactor = redactors.get(runId);
    const safeText = redactor && typeof redactor.redactText === 'function'
      ? redactor.redactText(String(text || ''))
      : String(text || '');
    const combined = `${run.log}${safeText}`;
    run.log = combined.length > maxLogChars
      ? combined.slice(combined.length - maxLogChars)
      : combined;
  }

  function addStep(runId, step) {
    const run = getInternal(runId);
    run.steps.push(redactVisibleValue(runId, step));
    return run.steps.length - 1;
  }

  function updateStep(runId, stepIndex, patch) {
    const run = getInternal(runId);
    if (!run.steps[stepIndex]) {
      throw new RunStateError('UNKNOWN_RUN_STEP', `找不到 Run Step：${stepIndex}`);
    }
    Object.assign(run.steps[stepIndex], redactVisibleValue(runId, patch));
  }

  function setCurrentModule(runId, moduleId) {
    getInternal(runId).currentModuleId = moduleId || null;
  }

  function setPendingApproval(runId, approval) {
    getInternal(runId).pendingApproval = redactVisibleValue(runId, approval);
  }

  function clearPendingApproval(runId) {
    getInternal(runId).pendingApproval = null;
  }

  function setArtifacts(runId, artifacts) {
    getInternal(runId).artifacts = cloneValue(artifacts || []);
  }

  function setIteration(runId, iteration) {
    getInternal(runId).iteration = iteration;
  }

  function setError(runId, error) {
    const run = getInternal(runId);
    const redactor = redactors.get(runId);
    const message = error ? (error.message || String(error)) : null;
    run.error = error
      ? {
          code: error.code || 'WORKFLOW_FAILED',
          message: redactor ? redactor.redactText(message) : message
        }
      : null;
  }

  function cancel(runId) {
    const run = getInternal(runId);
    if (TERMINAL_STATUSES.has(run.status)) {
      return getSnapshot(runId);
    }
    return transition(runId, 'cancelled');
  }

  function getSnapshot(runId) {
    return cloneValue(getInternal(runId));
  }

  function getActiveRun() {
    return activeRunId ? getSnapshot(activeRunId) : null;
  }

  function getLatestRun() {
    return latestRunId ? getSnapshot(latestRunId) : null;
  }

  return Object.freeze({
    addStep,
    appendLog,
    cancel,
    clearPendingApproval,
    create,
    getActiveRun,
    getLatestRun,
    getSnapshot,
    setArtifacts,
    setCurrentModule,
    setError,
    setIteration,
    setPendingApproval,
    setRedactor,
    transition,
    updateStep
  });
}

module.exports = {
  RunStateError,
  TERMINAL_STATUSES,
  createWorkflowRunManager
};
