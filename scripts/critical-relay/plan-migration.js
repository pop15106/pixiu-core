#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { loadPlan, validatePlan, readJson, digestObject, atomicJson, boundedPath, sourceSnapshot, isDigest } = require('./test-plan');
const { withControl } = require('./run-recovery');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value);

function previousPlan(root, state, binding) {
  const contract = state.executionContract;
  let plan = contract.verificationPlanSnapshot;
  if (!plan && contract.verificationRun) {
    const runId = contract.verificationRun.runId;
    if (!uuid(runId)) throw new Error('MIGRATION_PREVIOUS_RUN_INVALID');
    plan = readJson(root, `.cr/runs/${runId}/plan.json`);
  }
  if (!plan) plan = loadPlan(root, binding.planPath);
  validatePlan(plan);
  if (digestObject(plan) !== binding.planDigest) throw new Error('MIGRATION_PREVIOUS_PLAN_MISSING_OR_CHANGED');
  return plan;
}

function prepareMigration(root, state, binding, options = {}) {
  assertIdle(root);
  const { authorized, approvalRef, reason, newPlanPath, expectedOldDigest, expectedNewDigest,
    approvedRequiredRemovals = [], approvedEvidenceReductions = [] } = options;
  if (authorized !== true || typeof approvalRef !== 'string' || !approvalRef.trim() || typeof reason !== 'string' || !reason.trim()) {
    throw new Error('MIGRATION_EXPLICIT_AUTHORIZATION_REQUIRED');
  }
  if (!binding || state.mode !== 'FULL_AUTOMATIC_RELAY' || state.executionContract?.schemaVersion !== 'pixiu.cr-execution.v2' ||
      digestObject(state.executionContract.verificationBinding) !== digestObject(binding) || binding.planDigest !== expectedOldDigest || !isDigest(expectedNewDigest)) {
    throw new Error('MIGRATION_BINDING_CHANGED');
  }
  if (typeof newPlanPath !== 'string' || newPlanPath.startsWith('.cr/')) throw new Error('MIGRATION_PLAN_PATH_INVALID');
  const before = previousPlan(root, state, binding);
  const after = loadPlan(root, newPlanPath);
  if (after.id !== before.id || after.revision !== before.revision + 1 || after.parentDigest !== binding.planDigest ||
      digestObject(after) !== expectedNewDigest) throw new Error('MIGRATION_REVISION_CHAIN_INVALID');
  if (!Array.isArray(approvedRequiredRemovals) || !Array.isArray(approvedEvidenceReductions)) throw new Error('MIGRATION_APPROVAL_LIST_INVALID');
  const removed = before.commands.filter(item => item.required && !after.commands.some(next => next.id === item.id && next.required)).map(item => item.id);
  const reduced = before.criteria.filter(item => !after.criteria.some(next => next.id === item.id &&
    item.requiredEvidenceKinds.every(kind => next.requiredEvidenceKinds.includes(kind)))).map(item => item.id);
  if (removed.some(id => !approvedRequiredRemovals.includes(id)) || reduced.some(id => !approvedEvidenceReductions.includes(id))) {
    throw new Error('MIGRATION_UNAPPROVED_SCOPE_REDUCTION');
  }
  const next = structuredClone(state);
  const contract = next.executionContract;
  const nextBinding = { profile: binding.profile, planPath: newPlanPath, planDigest: expectedNewDigest };
  const receipt = { schemaVersion: 'pixiu.plan-migration.v1', migrationId: randomUUID(), migratedAt: new Date().toISOString(),
    beforeBinding: binding, afterBinding: nextBinding, beforeRevision: before.revision, afterRevision: after.revision,
    reason: reason.trim(), approvalRef: approvalRef.trim(), approvedRequiredRemovals: [...approvedRequiredRemovals],
    approvedEvidenceReductions: [...approvedEvidenceReductions], removedRequired: removed, reducedEvidence: reduced,
    addedCommands: after.commands.filter(item => !before.commands.some(old => old.id === item.id)).map(item => item.id),
    changedCommands: after.commands.filter(item => before.commands.some(old => old.id === item.id && digestObject(old) !== digestObject(item))).map(item => item.id) };
  contract.verificationMigrations = [...(contract.verificationMigrations || []), { ...receipt,
    previousRun: contract.verificationRun || null, previousVerification: contract.verification || null }];
  contract.verificationBinding = nextBinding;
  contract.verificationPlanSnapshot = structuredClone(after);
  contract.verification = null;
  contract.verificationRun = null;
  const source = sourceSnapshot(root);
  contract.source.headSha = source.headSha;
  contract.source.changeDigest = source.changeDigest;
  next.tests = [];
  next.completionCriteria = after.criteria.map(item => ({ id: item.id, criterion: item.criterion || item.id, satisfied: false, evidenceRefs: [] }));
  contract.workUnits = after.criteria.map((item, index) => ({ id: `unit-${index + 1}`, criterionRefs: [item.id], status: 'pending', testRefs: [] }));
  // 舊測試結果保留於歷史 run；失敗軌跡與反證不能因計劃升版而消失。
  for (const claim of next.claims || []) if (claim.status === 'supported') claim.status = 'open';
  for (const challenge of next.challenges || []) if (challenge.status === 'resolved') challenge.status = 'open';
  next.status = 'active'; next.phase = 'REASSESS'; next.phaseHistory.push('REASSESS');
  next.nextAction = '依新計劃重新測試，處理保留的失敗與反證，再進 VERIFY／RECHALLENGE';
  contract.nextAction = next.nextAction;
  return { state: next, binding: nextBinding, receipt, beforePlan: before, afterPlan: after };
}

function assertIdle(root) {
  if (fs.existsSync(boundedPath(root, '.cr/runner.lock', { mustExist: false }))) throw new Error('MIGRATION_RUN_ACTIVE_OR_RECOVERY_REQUIRED');
}
function finishTransaction(root, marker, onStep = () => {}) {
  if (!uuid(marker.migrationId)) throw new Error('MIGRATION_MARKER_INVALID');
  const dir = `.cr/migrations/${marker.migrationId}`;
  const before = readJson(root, `${dir}/before.json`);
  const after = readJson(root, `${dir}/after.json`);
  if (digestObject(before) !== marker.beforeDigest || digestObject(after) !== marker.afterDigest) throw new Error('MIGRATION_TRANSACTION_CHANGED');
  if (digestObject(loadPlan(root, after.binding.planPath)) !== after.binding.planDigest) throw new Error('MIGRATION_TARGET_PLAN_CHANGED');
  const currentBinding = readJson(root, '.cr/verification-binding.json');
  const currentState = readJson(root, '.cr/state.json');
  if (![before.binding, after.binding].some(value => digestObject(value) === digestObject(currentBinding)) ||
      ![before.state, after.state].some(value => digestObject(value) === digestObject(currentState))) throw new Error('MIGRATION_CONCURRENT_STATE_CHANGE');
  atomicJson(root, '.cr/verification-binding.json', after.binding);
  onStep('binding-written');
  atomicJson(root, '.cr/state.json', after.state);
  onStep('state-written');
  atomicJson(root, `${dir}/committed.json`, { migrationId: marker.migrationId, committedAt: new Date().toISOString(), afterDigest: marker.afterDigest });
  fs.unlinkSync(boundedPath(root, '.cr/migration-pending.json'));
  return { migrationId: marker.migrationId, binding: after.binding, nextAction: after.state.nextAction };
}

function migrateFallback(root, options = {}, onStep) {
  return withControl(root, () => {
    assertIdle(root);
    if (fs.existsSync(boundedPath(root, '.cr/migration-pending.json', { mustExist: false }))) throw new Error('MIGRATION_INCOMPLETE');
    const state = readJson(root, '.cr/state.json');
    const binding = readJson(root, '.cr/verification-binding.json');
    const changed = prepareMigration(root, state, binding, options);
    const before = { state, binding }, after = { state: changed.state, binding: changed.binding };
    const dir = `.cr/migrations/${changed.receipt.migrationId}`;
    atomicJson(root, `${dir}/before.json`, before);
    atomicJson(root, `${dir}/after.json`, after);
    atomicJson(root, `${dir}/receipt.json`, changed.receipt);
    atomicJson(root, `${dir}/before-plan.json`, changed.beforePlan);
    atomicJson(root, `${dir}/after-plan.json`, changed.afterPlan);
    const marker = { migrationId: changed.receipt.migrationId, beforeDigest: digestObject(before), afterDigest: digestObject(after) };
    atomicJson(root, '.cr/migration-pending.json', marker);
    return finishTransaction(root, marker, onStep);
  });
}

function resumeMigration(root, { authorized = false, migrationId } = {}) {
  if (authorized !== true || !uuid(migrationId)) throw new Error('MIGRATION_EXPLICIT_AUTHORIZATION_REQUIRED');
  return withControl(root, () => {
    assertIdle(root);
    const marker = readJson(root, '.cr/migration-pending.json');
    if (marker.migrationId !== migrationId) throw new Error('MIGRATION_ID_MISMATCH');
    return finishTransaction(root, marker);
  });
}

if (require.main === module) {
  try {
    const [action, optionsPath, authorization] = process.argv.slice(2);
    if (authorization !== '--authorized') throw new Error('用法：plan-migration.js migrate <approval.json> --authorized 或 resume <migrationId> --authorized');
    const result = action === 'migrate' ? migrateFallback(process.cwd(), { ...readJson(process.cwd(), optionsPath), authorized: true })
      : action === 'resume' ? resumeMigration(process.cwd(), { migrationId: optionsPath, authorized: true })
        : (() => { throw new Error('MIGRATION_ACTION_INVALID'); })();
    console.log(JSON.stringify(result));
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
module.exports = { prepareMigration, migrateFallback, resumeMigration };
