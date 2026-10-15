import fs from 'node:fs';
import path from 'node:path';
import { open } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import relay from '../critical-relay/critical-relay.js';
import verifier from '../critical-relay/evidence-verifier.js';
import planner from '../critical-relay/test-plan.js';
import identity from '../critical-relay/process-identity.js';

export const integrationProfile = 'session-workflow-v3-cr-v1';
const clone = value => structuredClone(value);
const fail = message => { throw new Error(`SESSION_CR: ${message}`); };
const has = (value, key) => Object.hasOwn(value ?? {}, key);
function canonicalRoot(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) fail('需要已解析的絕對工作區');
  return fs.realpathSync(root);
}
function sameRoot(left, right) {
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

// 保留原事件格式、hash 計算、schema 1～3 讀取器與專案權限判斷。
// 此橋接只在原本持有 ledger lock 的位置加入新任務的 CR 欄位及完成驗證。
export function enforceCriticalRelay(previous, next, input, projectRef, rootToProjectRef) {
  if (has(input, 'criticalRelayRequired') && typeof input.criticalRelayRequired !== 'boolean') fail('criticalRelayRequired 必須是布林值');
  if (previous?.criticalRelayRequired && input.criticalRelayRequired === false) fail('CR 不可降級');
  const required = previous?.criticalRelayRequired === true || next.criticalRelayRequired === true || input.criticalRelayRequired === true || has(input, 'criticalRelay');
  if (!required) return next;
  if (previous?.criticalRelayRequired && next.criticalRelayRequired !== true) fail('extension 不可移除必要 CR');
  const nextState = has(input, 'criticalRelay') ? clone(input.criticalRelay) : next.criticalRelay;
  if (!nextState || nextState.schemaVersion !== 'pixiu.critical-relay.v1' || nextState.mode !== 'FULL_AUTOMATIC_RELAY') fail('新 CR 任務需要完整 v2 執行契約');
  const proofChanged = previous?.criticalRelayRequired && planner.digestObject(nextState) !== planner.digestObject(previous.criticalRelay);
  if (previous?.currentOwner && (has(input, 'criticalRelay') || proofChanged || !previous.criticalRelayRequired) &&
      input.actor !== previous.currentOwner && !(input.action === 'acknowledge' && next.currentOwner === input.actor)) fail('只有目前持有者可以更新 CR 證據');
  if (next.status === 'completed' && previous?.currentOwner !== input.actor) fail('只有目前持有者可以完成 CR 任務');
  const oldRoot = previous?.verificationWorkspaceRoot;
  const root = canonicalRoot(input.workspaceRoot ?? oldRoot);
  if (rootToProjectRef(root) !== projectRef) fail('已解析專案與驗證根目錄不符');
  if (oldRoot && !sameRoot(root, oldRoot)) fail('工作區已改變，不能沿用其他來源證據');
  if (next.scope === 'cross_project' || (next.projectRefs?.length ?? 1) !== 1 || (next.projectRoots?.length ?? 1) !== 1) fail('多專案 CR 尚未支援；原有非 CR 跨專案任務維持原流程');
  if (previous?.verificationProjectRef && projectRef !== previous.verificationProjectRef) fail('驗證專案不可變更');
  const binding = verifier.latchBinding(root, nextState, previous?.verificationBinding);
  next.criticalRelayRequired = true;
  next.criticalRelay = nextState;
  next.verificationBinding = binding;
  next.verificationWorkspaceRoot = root;
  next.verificationProjectRef = projectRef;
  if (input.action === 'handoff' && !has(input, 'criticalRelay')) fail('CR 交接需包含最新的結構化狀態');
  if (input.action === 'acknowledge' && nextState.executionContract.verificationRun) {
    const check = verifier.verifyStateEvidence(nextState, root, binding);
    if (!check.canComplete) {
      nextState.executionContract.verification = null;
      nextState.status = 'active'; nextState.phase = 'REASSESS';
      nextState.phaseHistory.push('REASSESS');
      nextState.nextAction = `接手後重驗：${check.blockingReasons.join(' | ')}`;
    }
  }
  // 同時覆蓋 updateTask 與原有 extension mutation，避免其他寫入入口繞過 complete。
  if (next.status === 'completed') {
    const evaluation = relay.evaluateCriticalRelay(nextState);
    if (!evaluation.canComplete) fail(`完成閘門阻擋：${evaluation.blockingReasons.join(' | ')}`);
    const evidence = verifier.verifyStateEvidence(nextState, root, binding);
    if (!evidence.canComplete) fail(`原始證據阻擋：${evidence.blockingReasons.join(' | ')}`);
  }
  return next;
}

// 原 ledger 鎖名保持一致，但不再按 30 秒鎖齡刪除活操作。
// 證據回讀需要時間；非同步操作完全結束前不可讓另一位寫入者進入。
export async function withCompatibleLedgerLock(paths, operation) {
  fs.mkdirSync(paths.stateDirectory, { recursive: true });
  const target = planner.boundedPath(paths.stateDirectory, 'workflow.lock', { mustExist: false });
  const record = { schemaVersion: 'pixiu.session-cr-ledger-lock.v1', operationId: randomUUID(),
    ...identity.ownerIdentity(paths.stateDirectory), ...identity.processIdentity() };
  const bytes = Buffer.from(JSON.stringify(record));
  const started = Date.now();
  let handle;
  while (!handle) {
    try { handle = await open(target, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() - started >= 5000) fail('ledger 忙碌或需人工核對舊鎖；保留原鎖，不依鎖齡刪除');
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  let primaryError;
  try {
    await handle.writeFile(bytes); await handle.sync();
    return await operation();
  } catch (error) { primaryError = error; throw error; }
  finally {
    try {
      await handle.close();
      if (!fs.readFileSync(target).equals(bytes)) fail('ledger 鎖所有權已改變，保留目前檔案');
      fs.unlinkSync(target);
    } catch (error) {
      if (!primaryError) throw error;
      primaryError.cleanupError = error.message;
    }
  }
}
