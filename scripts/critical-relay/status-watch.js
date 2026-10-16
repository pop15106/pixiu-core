#!/usr/bin/env node
'use strict';

const { readRunStatus, readLifecycleStage, latestRunId } = require('./status-heartbeat');

function statusOnce(root, runId, options) { return readRunStatus(root, runId || latestRunId(root), options); }
function output(snapshot) {
  // 日誌保持摘要：不列印來源密碼、任務全文或業務機密。
  process.stdout.write(JSON.stringify(snapshot) + '\n');
}
async function watch(root, runId, { intervalMs = 10_000, maxPolls = 120, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), emit = output, readOptions } = {}) {
  if (!Number.isInteger(intervalMs) || intervalMs < 1000 || intervalMs > 60_000 ||
      !Number.isInteger(maxPolls) || maxPolls < 1 || maxPolls > 1000) throw new Error('CR_STATUS_INVALID_POLL_OPTIONS');
  const id = runId || latestRunId(root);
  let lastSequence = 0;
  for (let attempt = 0; attempt < maxPolls; attempt++) {
    const status = statusOnce(root, id, readOptions);
    if (status.heartbeatSeq < lastSequence) throw new Error('CR_STATUS_HEARTBEAT_SEQUENCE_REGRESSED');
    lastSequence = status.heartbeatSeq;
    emit(status);
    if (status.observed !== 'RUNNING_HEARTBEAT_FRESH' && status.observed !== 'HEARTBEAT_STALE') return status;
    if (status.observed === 'HEARTBEAT_STALE') return status;
    if (attempt < maxPolls - 1) await sleep(intervalMs);
  }
  const final = statusOnce(root, id, readOptions);
  if (final.heartbeatSeq < lastSequence) throw new Error('CR_STATUS_HEARTBEAT_SEQUENCE_REGRESSED');
  if (final.observed === 'RUNNING_HEARTBEAT_FRESH') final.monitorStopped = 'MAX_POLLS_REACHED_NOT_COMPLETED';
  emit(final);
  return final;
}
function exitCodeFor(result) {
  if (result.observed === 'HEARTBEAT_STALE') return 4;
  if (result.monitorStopped === 'MAX_POLLS_REACHED_NOT_COMPLETED' || result.observed === 'RUNNING_HEARTBEAT_FRESH') return 3;
  return result.observed === 'TESTS_PASS_GATE_NOT_CONFIRMED' ? 0 : 1;
}
if (require.main === module) {
  const [mode = 'status', runId, intervalString, maxPollsString] = process.argv.slice(2);
  try {
    if (!['status', 'watch', 'task'].includes(mode)) throw new Error('用法：status-watch.js status [runId]、watch [runId] [intervalMs] 或 task');
    if (mode === 'task') output(readLifecycleStage(process.cwd()));
    else if (mode === 'status') output(statusOnce(process.cwd(), runId));
    else {
      watch(process.cwd(), runId, { intervalMs: intervalString === undefined ? 10_000 : Number(intervalString),
        maxPolls: maxPollsString === undefined ? 120 : Number(maxPollsString) })
        .then(result => { process.exitCode = exitCodeFor(result); })
        .catch(error => { console.error(error.message); process.exitCode = 2; });
    }
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
module.exports = { statusOnce, watch, exitCodeFor };
