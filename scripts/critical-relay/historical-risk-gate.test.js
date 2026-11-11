'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('歷史帳本的 accepted 標記不能代替本次風險接受證據', () => {
  const root = path.resolve(__dirname, '../..');
  const file = path.join(root, 'docs/validation/20260923-same-chat-reviewer-runtime-cr-state.json');
  const before = fs.readFileSync(file);
  const state = JSON.parse(before.toString('utf8').replace(/^\uFEFF/, ''));
  const risk = state.remainingRisks.find(item => item.id === 'risk-real-host-e2e');
  assert.equal(risk.status, 'accepted');
  assert.equal(risk.approval, undefined);

  // 執行同一個公開 CLI；保留舊紀錄並驗證新版 Gate 確實拒絕未綁定的接受標記。
  const result = spawnSync(process.execPath, [path.join(__dirname, 'critical-relay.js'), 'check', file],
    { cwd: root, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.evaluation.canComplete, false);
  assert.ok(report.evaluation.blockingReasons.some(reason =>
    reason.startsWith('risk-real-host-e2e RISK_CONTEXT_MISSING')));
  assert.deepEqual(fs.readFileSync(file), before);
});
