#!/usr/bin/env node
'use strict';

const { createArtifactStore } = require('./artifact-store');
const { createSyntheticArtifacts } = require('./fixture-factory');
const { createOfflineRunner } = require('./offline-runner');
const { createProjectValidator } = require('./project-validator');
const { createRedactor } = require('./redaction');
const { normalizeWorkflowRequest } = require('./request-validator');
const { createWorkflowRunManager } = require('./run-manager');
const { createTaskPackageBuilder } = require('./task-package');
const { createWorkflowCatalog } = require('./workflow-catalog');
const { createWorktreeManager } = require('./worktree-manager');

class WorkflowEngineError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WorkflowEngineError';
    this.code = code;
  }
}

function createWorkflowEngine(options = {}) {
  const catalog = options.catalog || createWorkflowCatalog();
  const now = options.now || (() => new Date().toISOString());
  const runManager = options.runManager || createWorkflowRunManager({
    idFactory: options.idFactory,
    now,
    maxLogChars: options.maxLogChars
  });
  const offlineRunner = options.offlineRunner || createOfflineRunner({ now });
  const liveExecutor = options.liveExecutor || null;
  const projectValidator = options.projectValidator || createProjectValidator(options.projectValidatorOptions);
  const worktreeManager = options.worktreeManager || createWorktreeManager(options.worktreeManagerOptions);
  const taskBuilder = options.taskBuilder || createTaskPackageBuilder({ catalog });
  const contexts = new Map();

  function createContext(request, runId) {
    const redactor = createRedactor({ sensitiveTerms: request.sensitiveTerms });
    const canary = redactor.createCanary();
    const protectedLogTerms = [...new Set([
      ...request.sensitiveTerms,
      request.requirement,
      request.businessLogic
    ].filter(Boolean))];
    const logRedactor = createRedactor({
      sensitiveTerms: protectedLogTerms,
      canaryFactory: () => canary
    });
    logRedactor.createCanary();
    const suppliedArtifacts = request.inputMode === 'need-to-know'
      ? redactor.redactValue(request.inputArtifacts)
      : JSON.parse(JSON.stringify(request.inputArtifacts));
    const assistedArtifacts = request.fixtureMode === 'assisted-fixture'
      ? createSyntheticArtifacts({ request, redactor })
      : {};
    const artifactStore = createArtifactStore({
      redactor,
      idFactory: options.artifactIdFactory,
      now,
      maxArtifactBytes: options.maxArtifactBytes
    });
    return {
      runId,
      request,
      redactor,
      logRedactor,
      artifactStore,
      artifacts: { ...assistedArtifacts, ...suppliedArtifacts },
      canaryTokens: [canary],
      redResolved: false,
      nextIndex: 0,
      currentAbortController: null,
      worktree: null,
      project: null
    };
  }

  function refreshArtifacts(context) {
    runManager.setArtifacts(
      context.runId,
      context.artifactStore.snapshot(context.runId).artifacts
    );
  }

  function buildApproval(request) {
    if (!request.requiresApproval.length) {
      return null;
    }
    const first = request.requiresApproval[0];
    return {
      kind: first.kind,
      message: first.message,
      recommendedModuleId: null,
      options: ['approve', 'reject']
    };
  }

  async function executeModule(context, moduleId) {
    const taskPackage = taskBuilder.build({
      runId: context.runId,
      moduleId,
      request: context.request,
      artifacts: context.artifacts,
      canaryTokens: context.canaryTokens
    });

    const module = catalog.get(moduleId);
    const shouldUseLive = context.request.mode === 'live'
      && module.liveAccess !== 'none'
      && moduleId !== 'translator';
    if (shouldUseLive) {
      if (!liveExecutor || typeof liveExecutor.execute !== 'function') {
        throw new WorkflowEngineError(
          'LIVE_EXECUTOR_UNAVAILABLE',
          '本機 Live Executor 尚未可用'
        );
      }
      context.currentAbortController = new AbortController();
      try {
        return await liveExecutor.execute({
          moduleId,
          taskPackage,
          project: context.project,
          worktree: context.worktree,
          onOutput: (text) => runManager.appendLog(context.runId, text),
          signal: context.currentAbortController.signal
        });
      } finally {
        context.currentAbortController = null;
      }
    }

    context.currentAbortController = new AbortController();
    try {
      return await offlineRunner.execute({
        moduleId,
        taskPackage,
        context: {
          request: context.request,
          redactor: context.redactor,
          artifacts: context.artifacts,
          canaryTokens: context.canaryTokens,
          redResolved: context.redResolved,
          signal: context.currentAbortController.signal
        }
      });
    } finally {
      context.currentAbortController = null;
    }
  }

  async function executeFrom(context, startIndex) {
    const { runId, request } = context;
    const current = runManager.getSnapshot(runId);
    if (current.status === 'queued' || current.status === 'paused') {
      runManager.transition(runId, 'running');
    }
    runManager.clearPendingApproval(runId);

    try {
      for (let index = startIndex; index < request.moduleSequence.length; index += 1) {
        const moduleId = request.moduleSequence[index];
        context.nextIndex = index;
        if (request.mode === 'live' && moduleId === 'pg' && !context.worktree) {
          runManager.setPendingApproval(runId, {
            kind: 'live-worktree',
            message: 'Live PG 將建立隔離 Worktree，禁止修改原 checkout、Push、Merge 或 Deploy',
            moduleId: 'pg',
            moduleIndex: index,
            recommendedModuleId: 'pg',
            options: ['approve', 'reject']
          });
          runManager.transition(runId, 'paused');
          return runManager.getSnapshot(runId);
        }
        runManager.setCurrentModule(runId, moduleId);
        const stepIndex = runManager.addStep(runId, {
          moduleId,
          name: catalog.get(moduleId).name,
          iteration: runManager.getSnapshot(runId).iteration,
          status: 'RUNNING',
          startedAt: now(),
          finishedAt: null,
          artifactId: null,
          reason: null
        });
        runManager.appendLog(runId, `\n=== ${catalog.get(moduleId).name} ===\n`);

        const result = await executeModule(context, moduleId);
        let artifactId = null;
        const hasCanaryLeak = result.exposureReport?.canaryLeaks?.length > 0;
        if (result.artifact && !hasCanaryLeak) {
          const persistence = request.inputMode === 'raw-pass-through' ? 'memory' : 'durable';
          const saved = context.artifactStore.save({
            runId,
            moduleId,
            type: result.artifact.type,
            value: result.artifact.value,
            persistence
          });
          artifactId = saved.id;
          context.artifacts[result.artifact.type] = result.artifact.value;
          refreshArtifacts(context);
        }

        runManager.updateStep(runId, stepIndex, {
          status: result.status,
          finishedAt: result.finishedAt || now(),
          artifactId,
          reason: result.reason,
          recommendedModuleId: result.recommendedModuleId,
          warnings: result.warnings,
          exposureReport: result.exposureReport
        });
        runManager.appendLog(runId, `${moduleId}: ${result.status}\n`);

        if (result.status === 'RED') {
          const recommendedModuleId = result.recommendedModuleId || moduleId;
          runManager.setPendingApproval(runId, {
            kind: 'red-return',
            message: result.reason || `${moduleId} 判定 RED`,
            failedModuleId: moduleId,
            failedIndex: index,
            recommendedModuleId,
            options: ['return', 'reject']
          });
          runManager.transition(runId, 'paused');
          return runManager.getSnapshot(runId);
        }
        if (result.status !== 'GREEN') {
          throw new WorkflowEngineError(
            'MODULE_EXECUTION_FAILED',
            `${moduleId} 回傳不支援狀態：${result.status}`
          );
        }
      }

      runManager.setCurrentModule(runId, null);
      runManager.transition(runId, 'green');
      return runManager.getSnapshot(runId);
    } catch (error) {
      const snapshot = runManager.getSnapshot(runId);
      if (snapshot.status === 'cancelled') {
        return snapshot;
      }
      runManager.setError(runId, error);
      runManager.appendLog(runId, `工作流失敗：${error.message}\n`);
      if (!['green', 'red', 'failed'].includes(snapshot.status)) {
        runManager.transition(runId, 'failed');
      }
      return runManager.getSnapshot(runId);
    }
  }

  function prepareStart(rawRequest) {
    const request = normalizeWorkflowRequest(rawRequest, { catalog });
    const created = runManager.create({
      mode: request.mode,
      inputMode: request.inputMode,
      selectionMode: request.selectionMode,
      moduleSequence: request.moduleSequence
    });
    const context = createContext(request, created.id);
    contexts.set(created.id, context);
    runManager.setRedactor(created.id, context.logRedactor);

    if (request.mode === 'live') {
      if (!liveExecutor || typeof liveExecutor.isAvailable !== 'function' || !liveExecutor.isAvailable()) {
        runManager.setError(created.id, new WorkflowEngineError(
          'LIVE_EXECUTOR_UNAVAILABLE',
          '本機 Codex Live Executor 不可用'
        ));
        runManager.transition(created.id, 'failed');
        return { context, ready: false, snapshot: runManager.getSnapshot(created.id) };
      }
      try {
        context.project = projectValidator.validate(request.project, {
          requireGit: request.moduleSequence.includes('pg')
        });
      } catch (error) {
        runManager.setError(created.id, error);
        runManager.transition(created.id, 'failed');
        return { context, ready: false, snapshot: runManager.getSnapshot(created.id) };
      }
    }

    const approval = buildApproval(request);
    if (approval) {
      runManager.setPendingApproval(created.id, approval);
      runManager.transition(created.id, 'paused');
      return { context, ready: false, snapshot: runManager.getSnapshot(created.id) };
    }
    return { context, ready: true, snapshot: runManager.getSnapshot(created.id) };
  }

  function handleDetachedFailure(context, error) {
    const snapshot = runManager.getSnapshot(context.runId);
    if (['green', 'red', 'failed', 'cancelled'].includes(snapshot.status)) {
      return;
    }
    runManager.setError(context.runId, error);
    runManager.appendLog(context.runId, `工作流失敗：${error.message}\n`);
    runManager.transition(context.runId, 'failed');
  }

  async function start(rawRequest) {
    const prepared = prepareStart(rawRequest);
    if (!prepared.ready) {
      return prepared.snapshot;
    }
    return executeFrom(prepared.context, 0);
  }

  function startDetached(rawRequest) {
    const prepared = prepareStart(rawRequest);
    if (prepared.ready) {
      queueMicrotask(() => {
        executeFrom(prepared.context, 0).catch((error) => handleDetachedFailure(prepared.context, error));
      });
    }
    return prepared.snapshot;
  }

  async function resume(runId, decision = {}) {
    const context = contexts.get(runId);
    if (!context) {
      throw new WorkflowEngineError('UNKNOWN_RUN', `找不到 Workflow Run：${runId}`);
    }
    const snapshot = runManager.getSnapshot(runId);
    if (snapshot.status !== 'paused' || !snapshot.pendingApproval) {
      throw new WorkflowEngineError('RUN_NOT_PAUSED', 'Workflow Run 目前不是等待核准狀態');
    }

    if (decision.action === 'reject') {
      runManager.transition(runId, 'red');
      return runManager.getSnapshot(runId);
    }

    if (snapshot.pendingApproval.kind === 'live-worktree') {
      if (decision.action !== 'approve') {
        throw new WorkflowEngineError('INVALID_APPROVAL_DECISION', 'Worktree 核准點必須選擇 approve 或 reject');
      }
      try {
        context.worktree = await worktreeManager.create({
          sourcePath: context.project.sourcePath,
          runId,
          baseRef: 'HEAD'
        });
      } catch (error) {
        runManager.setError(runId, error);
        runManager.transition(runId, 'failed');
        return runManager.getSnapshot(runId);
      }
      runManager.clearPendingApproval(runId);
      return executeFrom(context, snapshot.pendingApproval.moduleIndex);
    }

    if (snapshot.pendingApproval.kind === 'red-return') {
      if (decision.action !== 'return') {
        throw new WorkflowEngineError('INVALID_APPROVAL_DECISION', 'RED 必須選擇 return 或 reject');
      }
      const moduleId = decision.moduleId || snapshot.pendingApproval.recommendedModuleId;
      const startIndex = context.request.moduleSequence.indexOf(moduleId);
      if (startIndex < 0) {
        throw new WorkflowEngineError('INVALID_RETURN_MODULE', `退回模組不在流程中：${moduleId}`);
      }
      context.redResolved = true;
      const nextIteration = snapshot.iteration + 1;
      runManager.setIteration(runId, nextIteration);
      runManager.clearPendingApproval(runId);
      return executeFrom(context, startIndex);
    }

    if (decision.action !== 'approve') {
      throw new WorkflowEngineError('INVALID_APPROVAL_DECISION', '核准點必須選擇 approve 或 reject');
    }
    runManager.clearPendingApproval(runId);
    return executeFrom(context, 0);
  }

  function resumeDetached(runId, decision = {}) {
    const current = runManager.getSnapshot(runId);
    queueMicrotask(() => {
      resume(runId, decision).catch((error) => {
        const context = contexts.get(runId);
        if (context) {
          handleDetachedFailure(context, error);
        }
      });
    });
    return current;
  }

  function cancel(runId) {
    const context = contexts.get(runId);
    if (context?.currentAbortController) {
      context.currentAbortController.abort();
    }
    return runManager.cancel(runId);
  }

  function getSnapshot(runId) {
    return runManager.getSnapshot(runId);
  }

  function getArtifact(runId, artifactId) {
    const context = contexts.get(runId);
    const artifact = context?.artifactStore.get(artifactId);
    if (!artifact || artifact.persistence !== 'durable') {
      return undefined;
    }
    return artifact;
  }

  function getActiveRun() {
    return runManager.getActiveRun();
  }

  function getLatestRun() {
    return runManager.getLatestRun();
  }

  return Object.freeze({
    cancel,
    getActiveRun,
    getArtifact,
    getLatestRun,
    getSnapshot,
    resume,
    resumeDetached,
    start,
    startDetached
  });
}

module.exports = {
  WorkflowEngineError,
  createWorkflowEngine
};
