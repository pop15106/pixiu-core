#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

class ActiveRunError extends Error {
  constructor(activeRunId) {
    super(`已有測試工作執行中：${activeRunId}`);
    this.name = 'ActiveRunError';
    this.activeRunId = activeRunId;
  }
}

class UnknownModuleError extends Error {
  constructor(moduleId) {
    super(`找不到測試模組：${moduleId}`);
    this.name = 'UnknownModuleError';
    this.moduleId = moduleId;
  }
}

class UnknownRunError extends Error {
  constructor(runId) {
    super(`找不到測試工作：${runId}`);
    this.name = 'UnknownRunError';
    this.runId = runId;
  }
}

function createProcessExecutor(step, { onOutput }) {
  let settled = false;
  const child = spawn(step.executable, step.args, {
    cwd: step.cwd,
    env: process.env,
    shell: false,
    windowsHide: true
  });

  child.stdout.on('data', (chunk) => onOutput(chunk.toString('utf8')));
  child.stderr.on('data', (chunk) => onOutput(chunk.toString('utf8')));

  const promise = new Promise((resolve) => {
    child.once('error', (error) => {
      if (settled) {
        return;
      }
      settled = true;
      onOutput(`無法啟動測試程序：${error.message}\n`);
      resolve({ exitCode: 1, signal: null, cancelled: false });
    });
    child.once('close', (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({
        exitCode: Number.isInteger(code) ? code : null,
        signal: signal || null,
        cancelled: false
      });
    });
  });

  return {
    promise,
    cancel() {
      if (!settled) {
        child.kill('SIGTERM');
      }
    }
  };
}

function cloneRun(run) {
  return {
    id: run.id,
    moduleId: run.moduleId,
    moduleName: run.moduleName,
    status: run.status,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    currentStep: run.currentStep,
    exitCode: run.exitCode,
    signal: run.signal,
    log: run.log,
    steps: run.steps.map((step) => ({
      id: step.id,
      moduleId: step.moduleId,
      label: step.label,
      status: step.status,
      startedAt: step.startedAt,
      finishedAt: step.finishedAt,
      exitCode: step.exitCode,
      signal: step.signal
    }))
  };
}

function createRunManager(options) {
  const {
    registry,
    executeStep = createProcessExecutor,
    maxLogChars = 200000,
    idFactory = () => crypto.randomUUID(),
    now = () => new Date().toISOString()
  } = options || {};

  if (!registry || typeof registry.get !== 'function' || typeof registry.resolveSteps !== 'function') {
    throw new TypeError('registry 必須提供 get 與 resolveSteps');
  }
  if (!Number.isInteger(maxLogChars) || maxLogChars < 1) {
    throw new TypeError('maxLogChars 必須是正整數');
  }

  const runs = new Map();
  const completions = new Map();
  let activeRunId = null;

  function getInternalRun(runId) {
    const run = runs.get(runId);
    if (!run) {
      throw new UnknownRunError(runId);
    }
    return run;
  }

  function appendLog(runId, text) {
    const run = getInternalRun(runId);
    const normalized = String(text || '');
    const combined = `${run.log}${normalized}`;
    run.log = combined.length > maxLogChars
      ? combined.slice(combined.length - maxLogChars)
      : combined;
  }

  async function executeRun(run) {
    run.status = 'running';
    run.startedAt = now();

    try {
      for (const stepState of run.steps) {
        if (run.cancelRequested) {
          run.status = 'cancelled';
          break;
        }

        stepState.status = 'running';
        stepState.startedAt = now();
        run.currentStep = stepState.id;
        appendLog(run.id, `\n=== ${stepState.label} ===\n`);

        let handle;
        try {
          handle = executeStep(stepState.definition, {
            onOutput: (chunk) => appendLog(run.id, chunk)
          });
          if (!handle || !handle.promise || typeof handle.cancel !== 'function') {
            throw new TypeError('executeStep 必須回傳 { promise, cancel }');
          }
          run.currentHandle = handle;
          const result = await handle.promise;
          run.currentHandle = null;

          stepState.finishedAt = now();
          stepState.exitCode = result.exitCode;
          stepState.signal = result.signal;

          if (run.cancelRequested || result.cancelled) {
            stepState.status = 'cancelled';
            run.status = 'cancelled';
            run.signal = result.signal || 'SIGTERM';
            break;
          }

          if (result.exitCode !== 0) {
            stepState.status = 'failed';
            run.status = 'failed';
            run.exitCode = result.exitCode;
            run.signal = result.signal;
            appendLog(run.id, `\n測試失敗，exit code：${result.exitCode}\n`);
            break;
          }

          stepState.status = 'passed';
        } catch (error) {
          run.currentHandle = null;
          stepState.status = run.cancelRequested ? 'cancelled' : 'failed';
          stepState.finishedAt = now();
          run.status = run.cancelRequested ? 'cancelled' : 'failed';
          run.exitCode = run.cancelRequested ? null : 1;
          appendLog(run.id, `\n執行錯誤：${error.message}\n`);
          break;
        }
      }

      if (run.status === 'running') {
        run.status = 'passed';
        run.exitCode = 0;
      }
      if (run.status === 'cancelled') {
        appendLog(run.id, '\n測試已取消。\n');
      }
    } finally {
      run.currentStep = null;
      run.currentHandle = null;
      run.finishedAt = now();
      if (activeRunId === run.id) {
        activeRunId = null;
      }
      const completion = completions.get(run.id);
      if (completion) {
        completion.resolve(cloneRun(run));
      }
    }
  }

  function start(moduleId) {
    const module = registry.get(moduleId);
    if (!module) {
      throw new UnknownModuleError(moduleId);
    }
    if (activeRunId) {
      throw new ActiveRunError(activeRunId);
    }

    const definitions = registry.resolveSteps(moduleId);
    const run = {
      id: idFactory(),
      moduleId,
      moduleName: module.name,
      status: 'queued',
      createdAt: now(),
      startedAt: null,
      finishedAt: null,
      currentStep: null,
      currentHandle: null,
      cancelRequested: false,
      exitCode: null,
      signal: null,
      log: '',
      steps: definitions.map((definition) => ({
        id: definition.id,
        moduleId: definition.moduleId,
        label: definition.label,
        status: 'pending',
        startedAt: null,
        finishedAt: null,
        exitCode: null,
        signal: null,
        definition
      }))
    };

    let resolveCompletion;
    const promise = new Promise((resolve) => {
      resolveCompletion = resolve;
    });
    runs.set(run.id, run);
    completions.set(run.id, { promise, resolve: resolveCompletion });
    activeRunId = run.id;
    queueMicrotask(() => executeRun(run));
    return cloneRun(run);
  }

  function getRun(runId) {
    return cloneRun(getInternalRun(runId));
  }

  function getActiveRun() {
    return activeRunId ? getRun(activeRunId) : null;
  }

  function cancel(runId) {
    const run = getInternalRun(runId);
    if (!['queued', 'running'].includes(run.status)) {
      return cloneRun(run);
    }
    run.cancelRequested = true;
    if (run.currentHandle) {
      run.currentHandle.cancel();
    }
    return cloneRun(run);
  }

  function cancelActive() {
    if (!activeRunId) {
      return null;
    }
    return cancel(activeRunId);
  }

  function waitForCompletion(runId) {
    const run = getInternalRun(runId);
    if (['passed', 'failed', 'cancelled'].includes(run.status)) {
      return Promise.resolve(cloneRun(run));
    }
    return completions.get(runId).promise;
  }

  return Object.freeze({
    appendLog,
    cancel,
    cancelActive,
    getActiveRun,
    getRun,
    start,
    waitForCompletion
  });
}

module.exports = {
  ActiveRunError,
  UnknownModuleError,
  UnknownRunError,
  createProcessExecutor,
  createRunManager
};
