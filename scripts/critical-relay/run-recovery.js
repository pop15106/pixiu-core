#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { processIdentity, ownerIdentity, sameOwner, pidStatus } = require('./process-identity');
const { withAuxiliaryLock } = require('./auxiliary-lock');
const { randomUUID } = require('node:crypto');
const { boundedPath, readJson, atomicJson, digestObject, hash } = require('./test-plan');
const SCHEMA = 'pixiu.runner-lock.v2';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value);

function withControl(root, operation) {
  return withAuxiliaryLock(root, 'control', operation);
}

function acquireRunLock(root, runId) {
  if (!uuid(runId)) throw new Error('RECOVERY_INVALID_RUN_ID');
  const record = { schemaVersion: SCHEMA, runId, ...ownerIdentity(root), ...processIdentity(),
    children: [], launchPending: false, createdAt: new Date().toISOString() };
  return withControl(root, () => {
    if (fs.existsSync(boundedPath(root, '.cr/migration-pending.json', { mustExist: false }))) throw new Error('MIGRATION_INCOMPLETE');
    const lockPath = boundedPath(root, '.cr/runner.lock', { mustExist: false });
    const fd = fs.openSync(lockPath, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(record)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    const owned = () => {
      const current = readJson(root, '.cr/runner.lock');
      if (current.runId !== runId || current.pid !== process.pid || current.birth !== record.birth) throw new Error('RECOVERY_LOCK_OWNERSHIP_CHANGED');
    };
    return {
      identity: structuredClone(record),
      launching() { owned(); record.launchPending = true; atomicJson(root, '.cr/runner.lock', record); },
      spawned(pid) {
        owned();
        // 若程序在取得建立時間前結束，記錄死程序；活程序但讀不到身分時保持待確認。
        try { record.children.push(processIdentity(pid)); record.launchPending = false; }
        catch (error) { if (pidStatus(pid) === 'DEAD') { record.children.push({ pid, birth: 'exited-before-observation' }); record.launchPending = false; } else throw error; }
        atomicJson(root, '.cr/runner.lock', record);
      },
      exited(pid) {
        owned(); record.children = record.children.filter(item => item.pid !== pid); record.launchPending = false;
        atomicJson(root, '.cr/runner.lock', record);
      },
      release() {
        return withControl(root, () => { owned(); fs.unlinkSync(lockPath); });
      }
    };
  });
}

function validateDeadLock(root, record, expectedRunId) {
  if (record.schemaVersion !== SCHEMA || !uuid(record.runId) || record.runId !== expectedRunId || !sameOwner(root, record) ||
      !Number.isSafeInteger(record.pid) || record.pid < 1 || typeof record.birth !== 'string' || !record.birth ||
      !Array.isArray(record.children) || typeof record.launchPending !== 'boolean') throw new Error('RECOVERY_LOCK_IDENTITY_MISMATCH');
  // 不以鎖齡刪鎖，也不終止 PID。PID 重用、權限不明或活程序一律保持阻擋。
  if (pidStatus(record.pid) !== 'DEAD') throw new Error('RECOVERY_OWNER_ALIVE_OR_UNKNOWN');
  if (record.launchPending) throw new Error('RECOVERY_UNCONFIRMED_CHILD');
  for (const child of record.children) {
    if (!Number.isSafeInteger(child.pid) || typeof child.birth !== 'string' || pidStatus(child.pid) !== 'DEAD') {
      throw new Error('RECOVERY_CHILD_ALIVE_OR_UNKNOWN');
    }
  }
}

function recoverRun(root, { runId, authorized = false } = {}) {
  if (authorized !== true || !uuid(runId)) throw new Error('RECOVERY_EXPLICIT_AUTHORIZATION_REQUIRED');
  return withControl(root, () => {
    const lockPath = boundedPath(root, '.cr/runner.lock');
    const original = fs.readFileSync(lockPath);
    const record = JSON.parse(original.toString('utf8'));
    validateDeadLock(root, record, runId);
    const runPath = `.cr/runs/${runId}`;
    const resultPath = `${runPath}/result.json`;
    const target = boundedPath(root, resultPath, { mustExist: false });
    let result = fs.existsSync(target) ? readJson(root, resultPath) : null;
    if (result && (result.runId !== runId || result.schemaVersion !== 'pixiu.test-run.v1' ||
        !result.executionOwner || result.executionOwner.birth !== record.birth || result.executionOwner.pid !== record.pid ||
        !sameOwner(root, result.executionOwner))) throw new Error('RECOVERY_RUN_IDENTITY_MISMATCH');
    const recoveryId = randomUUID();
    const receipt = { schemaVersion: 'pixiu.run-recovery.v1', recoveryId, runId,
      lockDigest: hash(original), originalResultDigest: result ? digestObject(result) : null,
      action: result?.outcome === 'PASS' ? 'RELEASE_STALE_COMPLETED_LOCK' : 'MARK_INTERRUPTED',
      recoveredAt: new Date().toISOString(), previousLock: record };
    // 先保存原始狀態與操作意圖；重啟後仍可查核，不偽造任何成功結果。
    fs.mkdirSync(boundedPath(root, `${runPath}/recoveries/${recoveryId}`, { mustExist: false }), { recursive: true });
    atomicJson(root, `${runPath}/recoveries/${recoveryId}/before.json`, result);
    atomicJson(root, `${runPath}/recoveries/${recoveryId}/receipt.json`, receipt);
    if (!result) result = { schemaVersion: 'pixiu.test-run.v1', runId, executionOwner: record, commands: [],
      outcome: 'INTERRUPTED', startedAt: record.createdAt, endedAt: receipt.recoveredAt,
      reason: '主控在初始化完整結果前已終止；保留缺失狀態並重新驗證' };
    else if (result.outcome !== 'PASS') {
      result = { ...result, outcome: 'INTERRUPTED', endedAt: receipt.recoveredAt,
        interruptedCommandId: result.currentCommandId || null,
        recoveryRef: `${runPath}/recoveries/${recoveryId}/receipt.json` };
    }
    atomicJson(root, resultPath, result);
    validateDeadLock(root, JSON.parse(fs.readFileSync(lockPath, 'utf8')), runId);
    if (!fs.readFileSync(lockPath).equals(original)) throw new Error('RECOVERY_LOCK_CHANGED');
    fs.renameSync(lockPath, boundedPath(root, `${runPath}/recoveries/${recoveryId}/runner.lock.json`, { mustExist: false }));
    return { runId, recoveryId, outcome: result.outcome, resultPath, nextAction: '以原測試計劃建立新 run；保留本輪歷史與失敗次數',
      processesKilled: 0 };
  });
}

if (require.main === module) {
  const [action, runId, authorization] = process.argv.slice(2);
  try {
    if (action !== 'recover' || authorization !== '--authorized') throw new Error('用法：run-recovery.js recover <runId> --authorized');
    console.log(JSON.stringify(recoverRun(process.cwd(), { runId, authorized: true })));
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
module.exports = { processIdentity, ownerIdentity, pidStatus, withControl, acquireRunLock, validateDeadLock, recoverRun };
