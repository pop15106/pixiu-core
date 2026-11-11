#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createCriticalRelay, recordCriticalRelayPhase } = require('./critical-relay');
const { createLifecycle, lifecycleBinding, reopenLifecycle } = require('./lifecycle');
const { createExecutionContract, EVIDENCE_SCHEMA_VERSION } = require('./execution-contract');
const { bindPlan, loadPlan, sourceSnapshot, readJson, atomicJson, digestObject, boundedPath } = require('./test-plan');
const { validateBinding, verifyRun } = require('./evidence-verifier');
const { recoveryFor, RUN_SCHEMA } = require('./test-runner');

function createEvidenceState(root, planPath, { objective, scope = ['scripts/'], lifecycleOptions } = {}) {
  if (lifecycleOptions?.taskType === 'research')
    return require('./research-evidence').createResearchState(root, planPath, { objective, lifecycleOptions });
  const plan = loadPlan(root, planPath);
  const source = sourceSnapshot(root);
  const executionContract = createExecutionContract({ baseSha: source.headSha, scope,
    workUnits: plan.criteria.map((criterion, index) => ({ id: `unit-${index + 1}`, criterionRefs: [criterion.id] })) });
  executionContract.schemaVersion = EVIDENCE_SCHEMA_VERSION;
  executionContract.source = { baseSha: source.headSha, headSha: source.headSha, changeDigest: source.changeDigest };
  executionContract.verificationBinding = bindPlan(root, planPath);
  executionContract.verificationPlanSnapshot = structuredClone(plan);
  executionContract.verificationRun = null;
  executionContract.evidenceHistory = [];
  return createCriticalRelay({ objective: objective || '依事前計劃完成必要驗證，保留反證覆核',
    mode: 'FULL_AUTOMATIC_RELAY', executionContract,
    ...(lifecycleOptions ? { lifecycle: createLifecycle(lifecycleOptions) } : {}),
    completionCriteria: plan.criteria.map(item => ({ id: item.id, criterion: item.criterion || item.id,
      satisfied: false, evidenceRefs: [] })) });
}

function applyRunEvidence(root, state, runRef, { authorizedRepair = false, changedApproach = {} } = {}) {
  if (fs.existsSync(boundedPath(root, '.cr/migration-pending.json', { mustExist: false }))) throw new Error('MIGRATION_INCOMPLETE');
  const next = structuredClone(state);
  const contract = next.executionContract;
  validateBinding(root, contract?.verificationBinding);
  if (!runRef || !/^[a-f0-9-]{36}$/u.test(runRef.runId) || runRef.resultPath !== `.cr/runs/${runRef.runId}/result.json`) {
    throw new Error('不合法的執行證據定位');
  }
  const run = readJson(root, runRef.resultPath);
  if (run.schemaVersion !== RUN_SCHEMA || run.runId !== runRef.runId || run.planDigest !== contract.verificationBinding.planDigest ||
      !run.endedAt || run.outcome === 'RUNNING' || !Array.isArray(run.commands)) throw new Error('執行證據未完成或計劃不符');
  const history = contract.evidenceHistory || [];
  const previous = history.find(item => item.runId === run.runId);
  const resultDigest = digestObject(run);
  if (previous) {
    if (previous.resultDigest !== resultDigest) throw new Error('同一 run 的已回填內容遭到變更');
    return next;
  }
  const verified = verifyRun(root, contract.verificationBinding, runRef);
  const plan = loadPlan(root, contract.verificationBinding.planPath);
  const event = { ...recoveryFor(run, history, { authorizedRepair }), resultDigest, resultPath: runRef.resultPath };
  contract.evidenceHistory = [...history, event];
  contract.verificationRun = { runId: run.runId, resultPath: runRef.resultPath };
  const source = run.sourceAfter || run.sourceBefore;
  contract.source.headSha = source.headSha;
  contract.source.changeDigest = source.changeDigest;
  contract.verification = verified.canComplete ? { headSha: source.headSha, changeDigest: source.changeDigest } : null;
  const evidenceId = `run-${run.runId}`;
  next.evidence.push({ id: evidenceId, source: `file:${runRef.resultPath}`, provenance: 'runner 自動收集的本機執行結果；正式完成前另回讀核對' });
  if (next.lifecycle?.entries.some(item => item.cycle === next.lifecycle.cycle && item.stage === 'verification')) {
    next.lifecycle = reopenLifecycle(next.lifecycle, {
      reason: '新執行證據取代舊驗證；保留歷史並重新查核來源、取捨與反證', evidenceRef: evidenceId
    });
  }
  next.tests = plan.commands.map(command => {
    const result = run.commands.find(item => item.commandId === command.id);
    return { id: command.id, name: command.id, required: command.required,
      status: result?.outcome === 'PASS' ? 'passed' : result?.outcome === 'FAIL' ? 'failed' : 'not_run',
      command: command.adapter === 'node-test' ? `node --test ${command.file}` : `${command.adapter} ${command.file}`,
      exitCode: result?.exitCode ?? null,
      outputRef: result ? `file:${result.stdoutPath}` : '', headSha: source.headSha, changeDigest: source.changeDigest };
  });
  for (const command of plan.commands.filter(item => item.required)) {
    const result = run.commands.find(item => item.commandId === command.id);
    const fingerprint = digestObject({ commandId: command.id, outcome: result?.outcome, failures: result?.failures || [] });
    if (result?.outcome !== 'PASS') {
      const existing = contract.failures.find(item => item.fingerprint === fingerprint && item.status !== 'resolved');
      if (existing) { existing.attempts++; if (changedApproach[command.id]) existing.changedApproach = changedApproach[command.id]; }
      else contract.failures.push({ id: `failure-${contract.failures.length + 1}`, commandId: command.id, fingerprint,
        attempts: 1, status: 'open', changedApproach: changedApproach[command.id] || '' });
    } else if (verified.canComplete) {
      for (const failure of contract.failures.filter(item => item.commandId === command.id && item.status !== 'resolved')) {
        failure.status = 'resolved'; failure.resolutionEvidenceRef = evidenceId;
        if (changedApproach[command.id]) failure.changedApproach = changedApproach[command.id];
      }
    }
  }
  for (const criterion of next.completionCriteria) {
    const refs = plan.commands.filter(command => command.required && command.criterionRefs.includes(criterion.id)).map(command => command.id);
    criterion.satisfied = verified.canComplete;
    criterion.evidenceRefs = verified.canComplete ? refs : [];
    const unit = contract.workUnits.find(item => item.criterionRefs.includes(criterion.id));
    unit.testRefs = refs; unit.status = verified.canComplete ? 'passed' : 'pending';
  }
  const phase = verified.canComplete ? 'VERIFY' : event.nextAction === 'VERIFY' ? 'REASSESS' : event.nextAction;
  next.status = phase === 'BLOCKED' ? 'blocked' : 'active';
  recordCriticalRelayPhase(next, phase);
  next.nextAction = verified.canComplete ? '重新讀取最新 diff，處理反證並記錄 RECHALLENGE；尚未宣告完成'
    : `${phase}：${verified.blockingReasons.join(' | ') || '處理失敗測試並重新驗證'}`;
  contract.nextAction = next.nextAction;
  // 本函式只回填執行證據，不替代人工判斷或自動將 claims／challenges 標成已解決。
  return next;
}

function initializeFallback(root, planPath, options = {}) {
  const bindingPath = '.cr/verification-binding.json';
  const lifecyclePath = '.cr/lifecycle-binding.json';
  const statePath = '.cr/state.json';
  if (fs.existsSync(boundedPath(root, bindingPath, { mustExist: false })) ||
      fs.existsSync(boundedPath(root, lifecyclePath, { mustExist: false })) ||
      fs.existsSync(boundedPath(root, statePath, { mustExist: false }))) throw new Error('已有 CR fallback 任務，請恢復原狀態或明確遷移');
  const state = createEvidenceState(root, planPath, options);
  // 固定 binding 與可更新 state 分開保存；舊 general state 不能繞過本次交付門檻。
  atomicJson(root, bindingPath, state.researchBinding || state.executionContract.verificationBinding);
  if (state.lifecycleRequired) atomicJson(root, lifecyclePath, lifecycleBinding(state.lifecycle));
  atomicJson(root, statePath, state);
  return state;
}

if (require.main === module) {
  const [action, value] = process.argv.slice(2);
  try {
    if (action === 'init') initializeFallback(process.cwd(), value || 'scripts/critical-relay/public-core.plan.json');
    else if (action === 'init-research') {
      if (!value) throw Error('請提供 research-plan.json');
      initializeFallback(process.cwd(), value,
        { lifecycleOptions: { taskType: 'research', depth: process.argv[4] || 'standard', riskSignals: [] } });
    }
    else if (action === 'init-lifecycle') {
      const [taskType = 'development', depth = 'standard', riskCsv = ''] = process.argv.slice(4);
      initializeFallback(process.cwd(), value || 'scripts/critical-relay/public-core.plan.json',
        { lifecycleOptions: { taskType, depth, riskSignals: riskCsv ? riskCsv.split(',') : [] } });
    }
    else if (action === 'sources') {
      const state = readJson(process.cwd(), '.cr/state.json');
      const pinned = readJson(process.cwd(), '.cr/verification-binding.json');
      if (digestObject(pinned) !== digestObject(state.researchBinding)) throw Error('研究 binding 不符');
      const next = require('./research-evidence').captureResearchEvidence(process.cwd(), state);
      atomicJson(process.cwd(), '.cr/state.json', next);
    }
    else if (action === 'ingest') {
      const state = readJson(process.cwd(), '.cr/state.json');
      const run = readJson(process.cwd(), value);
      const pinned = readJson(process.cwd(), '.cr/verification-binding.json');
      if (digestObject(pinned) !== digestObject(state.executionContract?.verificationBinding)) throw new Error('fallback binding 不符');
      atomicJson(process.cwd(), '.cr/state.json', applyRunEvidence(process.cwd(), state, { runId: run.runId, resultPath: value }));
    } else throw new Error('用法：relay-evidence.js init [plan.json]，init-lifecycle [plan.json] [development|research] [quick|standard|deep] [risk1,risk2]，或 ingest <result.json>');
    console.log('已保存 CR state；完成仍需反證覆核與正式 gate。');
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
module.exports = { createEvidenceState, applyRunEvidence, initializeFallback };
