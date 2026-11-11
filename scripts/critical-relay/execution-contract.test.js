'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createExecutionContract, decideRecovery, DELIVERY_MODE } = require('./execution-contract');
const { createCriticalRelay, recordCriticalRelayPhase, evaluateCriticalRelay,
  buildHandoffSnapshot, verifyHandoffSnapshot } = require('./critical-relay');
const SHA = 'a'.repeat(40);
const DIGEST = 'b'.repeat(64);

function completed() {
  const executionContract = createExecutionContract({ baseSha: SHA, scope: ['src/'],
    workUnits: [{ id: 'unit-1', criterionRefs: ['criterion-1'] }] });
  const state = createCriticalRelay({ objective: '驗證交付契約', mode: DELIVERY_MODE,
    executionContract, completionCriteria: ['功能通過實測'] });
  state.claims = [{ id: 'claim-1', status: 'supported', evidenceRefs: ['evidence-1'],
    challengeRefs: ['challenge-1'] }];
  state.evidence = [{ id: 'evidence-1', source: 'repo:src/example.js' }];
  state.challenges = [{ id: 'challenge-1', claimRefs: ['claim-1'], status: 'resolved',
    method: '反例測試', result: '已驗證失敗狀態會阻擋完成' }];
  state.tests = [{ id: 'test-1', status: 'passed', required: true, command: 'node --test',
    exitCode: 0, outputRef: 'repo:artifacts/test.log', headSha: SHA, changeDigest: DIGEST }];
  state.completionCriteria[0].satisfied = true;
  state.completionCriteria[0].evidenceRefs = ['test-1'];
  state.executionContract.source.changeDigest = DIGEST;
  state.executionContract.verification = { headSha: SHA, changeDigest: DIGEST };
  Object.assign(state.executionContract.workUnits[0], { status: 'passed', testRefs: ['test-1'] });
  recordCriticalRelayPhase(state, 'VERIFY');
  recordCriticalRelayPhase(state, 'RECHALLENGE');
  return state;
}

function blocked(mutate) {
  const state = completed();
  mutate(state);
  assert.equal(evaluateCriticalRelay(state).canComplete, false);
}

test('完整交付模式的有效證據可通過 CR', () => {
  assert.equal(evaluateCriticalRelay(completed()).canComplete, true);
});

test('建立契約時複製輸入且初始狀態保持未驗證', () => {
  const scope = ['src/'];
  const units = [{ id: 'unit-1', criterionRefs: ['criterion-1'] }];
  const contract = createExecutionContract({ baseSha: SHA, scope, workUnits: units });
  scope.push('secrets/');
  units[0].criterionRefs.push('unknown');
  assert.deepEqual(contract.scope, ['src/']);
  assert.deepEqual(contract.workUnits[0].criterionRefs, ['criterion-1']);
  assert.equal(contract.verification, null);
});

test('無效建立參數會被拒絕', () => {
  for (const input of [undefined, {}, { baseSha: 'short' },
    { baseSha: SHA, scope: ['src/'], workUnits: [] },
    { baseSha: SHA, scope: [true], workUnits: [] },
    { baseSha: SHA, scope: ['src/'], workUnits: [null] },
    { baseSha: SHA, scope: ['src/'], workUnits: [
      { id: 'x', criterionRefs: ['c'] }, { id: 'x', criterionRefs: ['c'] }] }]) {
    assert.throws(() => createExecutionContract(input));
  }
});

const cases = [
  ['交付模式缺少契約', s => { delete s.executionContract; }],
  ['刪除 required 仍無法略過交付模式契約', s => {
    delete s.executionContractRequired; delete s.executionContract;
  }],
  ['將 required 改為 false 仍無法略過交付模式契約', s => {
    s.executionContractRequired = false; delete s.executionContract;
  }],
  ['required 型別錯誤', s => { s.executionContractRequired = 'true'; }],
  ['null 契約', s => { s.executionContract = null; }],
  ['陣列契約', s => { s.executionContract = []; }],
  ['不支援的契約版本', s => { s.executionContract.schemaVersion = 'future'; }],
  ['隱含多 Agent', s => { s.executionContract.agentPolicy = 'parallel'; }],
  ['空範圍', s => { s.executionContract.scope = []; }],
  ['缺少下一步', s => { s.executionContract.nextAction = ''; }],
  ['來源 SHA 錯誤', s => { s.executionContract.source.baseSha = 'short'; }],
  ['缺少驗證 checkpoint', s => { s.executionContract.verification = null; }],
  ['驗證 SHA 過期', s => { s.executionContract.verification.headSha = 'c'.repeat(40); }],
  ['驗證 diff 過期', s => { s.executionContract.source.changeDigest = 'd'.repeat(64); }],
  ['工作單位空白', s => { s.executionContract.workUnits = []; }],
  ['工作單位型別錯誤', s => { s.executionContract.workUnits = [null]; }],
  ['工作單位 id 重複', s => { s.executionContract.workUnits.push(s.executionContract.workUnits[0]); }],
  ['多項工作同時進行', s => {
    s.executionContract.workUnits[0].status = 'in_progress';
    s.executionContract.workUnits.push({ ...s.executionContract.workUnits[0], id: 'unit-2' });
  }],
  ['尚未驗收', s => { s.executionContract.workUnits[0].status = 'pending'; }],
  ['引用不存在的條件', s => { s.executionContract.workUnits[0].criterionRefs = ['missing']; }],
  ['完成條件未覆蓋', s => {
    s.completionCriteria.push({ id: 'criterion-2', satisfied: true, evidenceRefs: ['test-1'] });
  }],
  ['沒有實測定位', s => { s.executionContract.workUnits[0].testRefs = []; }],
  ['引用不存在的測試', s => { s.executionContract.workUnits[0].testRefs = ['missing']; }],
  ['只有 passed 宣告而沒有命令', s => { delete s.tests[0].command; }],
  ['測試失敗但宣告 passed', s => { s.tests[0].exitCode = 1; }],
  ['缺少輸出定位', s => { s.tests[0].outputRef = ''; }],
  ['無法追溯的成功宣告', s => { s.tests[0].outputRef = '全部綠燈'; }],
  ['未被 unit 引用的必要測試版本過期', s => {
    s.tests.push({ ...s.tests[0], id: 'test-2', headSha: 'd'.repeat(40) });
  }],
  ['未被 unit 引用的必要測試缺少命令', s => {
    s.tests.push({ ...s.tests[0], id: 'test-2', command: '' });
  }],
  ['測試版本過期', s => { s.tests[0].headSha = 'f'.repeat(40); }],
  ['測試內容過期', s => { s.tests[0].changeDigest = 'e'.repeat(64); }],
  ['失敗紀錄型別錯誤', s => { s.executionContract.failures = {}; }],
  ['空白失敗紀錄', s => { s.executionContract.failures = [null]; }],
  ['舊 CR 未解決反證仍阻擋', s => { s.claims[0].status = 'contested'; }],
  ['舊 CR 缺少 RECHALLENGE 仍阻擋', s => { s.phaseHistory = ['UNDERSTAND', 'VERIFY']; }]
];
for (const [name, mutate] of cases) test(name, () => blocked(mutate));

test('重複失敗需要換路與解決證據', () => {
  const state = completed();
  const failure = { id: 'failure-1', fingerprint: 'assertion:expected-exit-code',
    attempts: 2, status: 'open' };
  state.executionContract.failures.push(failure);
  assert.equal(evaluateCriticalRelay(state).canComplete, false);
  Object.assign(failure, { status: 'resolved', resolutionEvidenceRef: 'evidence-1' });
  assert.equal(evaluateCriticalRelay(state).canComplete, false);
  failure.changedApproach = '先做最小重現，再確認實際 exit code';
  assert.equal(evaluateCriticalRelay(state).canComplete, true);
  state.executionContract.failures.push({ ...failure });
  assert.equal(evaluateCriticalRelay(state).canComplete, false);
});

test('失敗紀錄必須有有效次數與真實修復證據', () => {
  for (const override of [{ attempts: 0 }, { attempts: 1.5 }, { attempts: '1' },
    { fingerprint: '' }, { resolutionEvidenceRef: 'missing' }]) {
    blocked(s => { s.executionContract.failures = [{ id: 'f', fingerprint: 'error',
      attempts: 1, status: 'resolved', resolutionEvidenceRef: 'evidence-1', ...override }]; });
  }
});

test('未被引用的非必要測試可如實保留 NOT_RUN', () => {
  const state = completed();
  state.tests.push({ id: 'optional', required: false, status: 'not_run' });
  assert.equal(evaluateCriticalRelay(state).canComplete, true);
});

test('授權修復決策在第二次相同失敗後轉診斷', () => {
  assert.equal(decideRecovery(), 'BLOCKED');
  assert.equal(decideRecovery({ authorized: true }), 'VERIFY');
  assert.equal(decideRecovery({ authorized: true, consecutiveFailures: 1 }), 'REPAIR');
  assert.equal(decideRecovery({ authorized: true, consecutiveFailures: 2 }), 'REASSESS');
  assert.equal(decideRecovery({ authorized: true, consecutiveFailures: 3, newEvidence: true }), 'REPAIR');
  assert.equal(decideRecovery({ authorized: true, hardBlocker: true }), 'BLOCKED');
  assert.throws(() => decideRecovery({ authorized: 'yes' }));
  assert.throws(() => decideRecovery({ consecutiveFailures: -1 }));
});

test('handoff 保留交付契約並偵測竄改', () => {
  const state = completed();
  const snapshot = buildHandoffSnapshot(state);
  assert.equal(verifyHandoffSnapshot(snapshot).canAccept, true);
  state.executionContract.scope.push('other/');
  assert.deepEqual(snapshot.executionContract.scope, ['src/']);
  snapshot.executionContract.source.changeDigest = 'e'.repeat(64);
  assert.equal(verifyHandoffSnapshot(snapshot).canAccept, false);
});

test('舊模式仍可使用既有 schema，新增契約則會被檢查', () => {
  const state = completed();
  state.mode = 'general';
  delete state.executionContractRequired;
  delete state.executionContract;
  assert.equal(evaluateCriticalRelay(state).canComplete, true);
  state.executionContract = {};
  assert.equal(evaluateCriticalRelay(state).canComplete, false);
});

test('來源與 Codex 發布副本一致，入口不再要求隱含 Agent', () => {
  const root = path.resolve(__dirname, '../..');
  for (const name of ['critical-relay', 'pixiu-verify-loop', 'verification-loop']) {
    const source = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const published = fs.readFileSync(path.join(root, '.agents/skills', name, 'SKILL.md'), 'utf8');
    assert.equal(source.replace(/\r\n/g, '\n'), published.replace(/\r\n/g, '\n'), name);
    assert.ok(!source.includes('會啟動 3 個並行 review agents'));
  }
  const go = fs.readFileSync(path.join(root, 'commands/go.md'), 'utf8');
  assert.ok(go.includes('單一 Agent'));
  assert.ok(go.includes('本次授權'));
  assert.ok(!go.includes('不得憑推論自行擬定 criteria'));
});
