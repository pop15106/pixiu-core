'use strict';

// CR 測試執行狀態投影：不是第二份任務帳本，也不是測試成功證據。
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { setInterval, clearInterval } = require('node:timers');

const SCHEMA = 'pixiu.cr-run-status.v1';
const RUN_ID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const COMMAND_ID = /^[a-z][a-z0-9-]{0,79}$/;
const STATUSES = new Set(['RUNNING', 'PASS', 'FAIL', 'SOURCE_CHANGED', 'CANCELLED', 'TIMEOUT', 'INTERRUPTED', 'ENV_BLOCKED']);
const DEFAULT_HEARTBEAT_MS = 15_000;
const DEFAULT_STALE_MS = 45_000;
const MAX_STATUS_BYTES = 32 * 1024;

function assertRunId(runId) {
  if (typeof runId !== 'string' || !RUN_ID.test(runId)) throw new Error('CR_STATUS_INVALID_RUN_ID');
  return runId;
}

function checkedPath(root, ...parts) {
  const base = fs.realpathSync(root);
  let target = base;
  for (const part of parts) {
    if (typeof part !== 'string' || !part || part === '.' || part === '..' || part.includes('/') || part.includes('\\')) {
      throw new Error('CR_STATUS_UNSAFE_PATH');
    }
    target = path.join(target, part);
    try {
      if (fs.lstatSync(target).isSymbolicLink()) throw new Error('CR_STATUS_LINK_BLOCKED');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return target;
}
function statusFile(root, runId) {
  return checkedPath(root, '.cr', 'runs', assertRunId(runId), 'status.json');
}
function latestFile(root) { return checkedPath(root, '.cr', 'latest-run.json'); }
function atomicWrite(file, document) {
  const content = JSON.stringify(document, null, 2) + '\n';
  if (Buffer.byteLength(content) > MAX_STATUS_BYTES) throw new Error('CR_STATUS_TOO_LARGE');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.' + randomUUID() + '.tmp';
  const fd = fs.openSync(temp, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, content, 'utf8');
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  try { fs.renameSync(temp, file); }
  catch (error) { try { fs.unlinkSync(temp); } catch { /* retained for diagnosis */ } throw error; }
}
function readJson(file, maxBytes = MAX_STATUS_BYTES) {
  const info = fs.statSync(file);
  if (!info.isFile() || info.size > maxBytes) throw new Error('CR_STATUS_FILE_INVALID');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function assertStatus(value, runId) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== SCHEMA ||
      value.runId !== runId || !STATUSES.has(value.outcome) || !Number.isInteger(value.heartbeatSeq) || value.heartbeatSeq < 1 ||
      !Number.isInteger(value.totalCommands) || value.totalCommands < 1 ||
      !Number.isInteger(value.completedCommands) || value.completedCommands < 0 || value.completedCommands > value.totalCommands ||
      !Number.isFinite(Date.parse(value.startedAt)) || !Number.isFinite(Date.parse(value.lastHeartbeatAt)) ||
      !Number.isFinite(Date.parse(value.lastProgressAt)) || !Number.isInteger(value.pid) || value.pid <= 0 ||
      (value.currentCommandId != null && !COMMAND_ID.test(value.currentCommandId))) {
    throw new Error('CR_STATUS_CORRUPT');
  }
  return value;
}

function startRunHeartbeat(root, { runId, totalCommands, intervalMs = DEFAULT_HEARTBEAT_MS,
  now = () => new Date(), pid = process.pid, planDigest = null } = {}) {
  assertRunId(runId);
  if (!Number.isInteger(totalCommands) || totalCommands < 1 || totalCommands > 10_000 ||
      !Number.isInteger(intervalMs) || intervalMs < 1000 || intervalMs > 60_000 ||
      !Number.isInteger(pid) || pid < 1) throw new Error('CR_STATUS_INVALID_OPTIONS');
  if (planDigest != null && (typeof planDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(planDigest))) {
    throw new Error('CR_STATUS_INVALID_PLAN_DIGEST');
  }
  const date = () => now().toISOString();
  const started = date();
  const status = { schemaVersion: SCHEMA, runId, planDigest, startedAt: started,
    lastHeartbeatAt: started, lastProgressAt: started, endedAt: null,
    pid, outcome: 'RUNNING', phase: 'TEST', currentCommandId: null,
    completedCommands: 0, totalCommands, heartbeatSeq: 0 };
  const target = statusFile(root, runId);
  // .cr/latest-run.json 只用於使用者查詢，結果檢驗不依賴它。
  function write(progress = false) {
    const timestamp = date();
    status.heartbeatSeq++;
    status.lastHeartbeatAt = timestamp;
    if (progress) status.lastProgressAt = timestamp;
    atomicWrite(target, status);
    return Object.freeze({ ...status });
  }
  let closed = false;
  let lastError = null;
  write(true);
  atomicWrite(latestFile(root), { schemaVersion: SCHEMA, runId });
  const timer = setInterval(() => {
    if (closed) return;
    try { write(false); } catch (error) { lastError = error; }
  }, intervalMs);
  timer.unref?.();
  return {
    runId,
    get error() { return lastError; },
    get snapshot() { return { ...status }; },
    progress({ commandId, status: eventStatus, doneCount } = {}) {
      if (closed) throw new Error('CR_STATUS_ALREADY_FINISHED');
      if (commandId != null && !COMMAND_ID.test(commandId)) throw new Error('CR_STATUS_INVALID_COMMAND_ID');
      if (!['RUNNING', 'PASS', 'FAIL', 'NOT_RUN', 'CANCELLED', 'ENV_BLOCKED', 'TIMEOUT', 'OUTPUT_LIMIT', 'SOURCE_CHANGED', 'INTERRUPTED',
        'PARSE_ERROR', 'ZERO_TESTS', 'JOURNAL_ERROR', 'IDENTITY_ERROR', 'LOCK_ERROR'].includes(eventStatus)) {
        throw new Error('CR_STATUS_INVALID_EVENT_STATUS');
      }
      if (doneCount !== undefined) {
        if (!Number.isInteger(doneCount) || doneCount < status.completedCommands || doneCount > status.totalCommands)
          throw new Error('CR_STATUS_INVALID_COUNT');
        status.completedCommands = doneCount;
      }
      status.currentCommandId = eventStatus === 'RUNNING' ? commandId : null;
      return write(true);
    },
    finish(outcome) {
      if (closed) throw new Error('CR_STATUS_ALREADY_FINISHED');
      if (!STATUSES.has(outcome) || outcome === 'RUNNING') throw new Error('CR_STATUS_INVALID_OUTCOME');
      status.outcome = outcome;
      status.currentCommandId = null;
      status.endedAt = date();
      closed = true;
      clearInterval(timer);
      return write(true);
    },
    close() { closed = true; clearInterval(timer); }
  };
}

function readRunStatus(root, runId, { nowMs = Date.now(), staleMs = DEFAULT_STALE_MS } = {}) {
  if (!Number.isFinite(nowMs) || !Number.isInteger(staleMs) || staleMs < 1000) throw new Error('CR_STATUS_INVALID_READ_OPTIONS');
  const status = assertStatus(readJson(statusFile(root, runId)), runId);
  const heartbeatAgeMs = Math.max(0, nowMs - Date.parse(status.lastHeartbeatAt));
  const progressAgeMs = Math.max(0, nowMs - Date.parse(status.lastProgressAt));
  // 只以原有 journal 的 checkpoint 呈現「有新測試事件」；不在此重複解析測試或宣稱 PASS。
  let journalEvents = null;
  let journalUpdatedAt = null;
  if (status.outcome === 'RUNNING' && status.currentCommandId) {
    const checkpoint = checkedPath(root, '.cr', 'runs', runId, status.currentCommandId + '.progress.json');
    try {
      const journal = readJson(checkpoint);
      if (journal.schemaVersion === 'pixiu.run-journal.v1' &&
          Number.isSafeInteger(journal.eventCount) && journal.eventCount >= 0) {
        journalEvents = journal.eventCount;
        journalUpdatedAt = fs.statSync(checkpoint).mtime.toISOString();
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let observed = status.outcome === 'RUNNING'
    ? (heartbeatAgeMs > staleMs ? 'HEARTBEAT_STALE' : 'RUNNING_HEARTBEAT_FRESH')
    : status.outcome === 'PASS' ? 'TESTS_PASS_GATE_NOT_CONFIRMED' : 'RUN_TERMINATED_UNSUCCESSFULLY';
  // 不能只相信 status.json 宣稱的 PASS。result.json 必須有正式終態。
  if (status.outcome !== 'RUNNING') {
    let result;
    try { result = readJson(checkedPath(root, '.cr', 'runs', runId, 'result.json'), 8 * 1024 * 1024); }
    catch { observed = 'TERMINAL_RESULT_UNVERIFIED'; }
    if (result && (result.runId !== runId || result.outcome !== status.outcome || !result.endedAt)) observed = 'TERMINAL_RESULT_UNVERIFIED';
  }
  return { schemaVersion: SCHEMA, runId, observed, outcome: status.outcome,
    phase: status.phase, currentCommandId: status.currentCommandId,
    completedCommands: status.completedCommands, totalCommands: status.totalCommands,
    journalEvents, journalUpdatedAt,
    lastHeartbeatAt: status.lastHeartbeatAt, lastProgressAt: status.lastProgressAt,
    heartbeatAgeMs, progressAgeMs, heartbeatSeq: status.heartbeatSeq,
    notice: observed === 'HEARTBEAT_STALE' ? '心跳中斷或本機程序停滯；需確認程序，不能視為失敗或成功。'
      : observed === 'RUNNING_HEARTBEAT_FRESH' && progressAgeMs > staleMs ? '程序仍有心跳，但目前沒有新的測試進度。'
        : observed === 'TESTS_PASS_GATE_NOT_CONFIRMED' ? '測試程序完成；仍需原始證據回讀及 CR completion gate。'
          : observed === 'TERMINAL_RESULT_UNVERIFIED' ? '狀態與實際結果不一致，必須重新檢查。' : null };
}
function readLifecycleStage(root, { nowMs = Date.now() } = {}) {
  const target = checkedPath(root, '.cr', 'state.json');
  const state = readJson(target, 8 * 1024 * 1024);
  if (!state || state.schemaVersion !== 'pixiu.critical-relay.v1' ||
      typeof state.phase !== 'string' || typeof state.status !== 'string') {
    throw new Error('CR_STATUS_CANONICAL_STATE_INVALID');
  }
  const checkpointTime = fs.statSync(target).mtime.toISOString();
  return { schemaVersion: SCHEMA, observed: 'CHECKPOINT_ONLY_NOT_LIVENESS_PROOF',
    phase: state.phase, lifecycleStage: typeof state.lifecycle?.stage === 'string' ? state.lifecycle.stage : null,
    taskStatus: state.status, iteration: Number.isSafeInteger(state.iteration) ? state.iteration : null,
    checkpointAt: checkpointTime, checkpointAgeMs: Math.max(0, nowMs - Date.parse(checkpointTime)),
    notice: '來自既有 CR state 的上次保存階段；不代表此刻有程序仍在執行。' };
}

function latestRunId(root) {
  const pointer = readJson(latestFile(root));
  if (pointer.schemaVersion !== SCHEMA) throw new Error('CR_STATUS_LATEST_INVALID');
  return assertRunId(pointer.runId);
}

module.exports = { SCHEMA, DEFAULT_HEARTBEAT_MS, DEFAULT_STALE_MS,
  assertRunId, startRunHeartbeat, readRunStatus, readLifecycleStage, latestRunId };
