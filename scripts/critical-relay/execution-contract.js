'use strict';

// 執行契約只驗證交付證據；不啟動模型、不修改推理設定，也不授予外部操作權限。
const SCHEMA_VERSION = 'pixiu.cr-execution.v1';
const EVIDENCE_SCHEMA_VERSION = 'pixiu.cr-execution.v2';
const DELIVERY_MODE = 'FULL_AUTOMATIC_RELAY';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const sha = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const outputLocation = value => typeof value === 'string' &&
  /^(?:https?:\/\/|repo:|git:|file:)\S+$/u.test(value);

function createExecutionContract({ baseSha, headSha = baseSha, scope, workUnits } = {}) {
  if (!sha(baseSha) || !sha(headSha)) throw new Error('baseSha 與 headSha 必須是完整 Git SHA');
  if (!Array.isArray(scope) || !scope.length || !scope.every(text)) {
    throw new Error('scope 必須列出已授權的修改範圍');
  }
  if (!Array.isArray(workUnits) || !workUnits.length || !workUnits.every(unit =>
    object(unit) && text(unit.id) && Array.isArray(unit.criterionRefs) &&
    unit.criterionRefs.length > 0 && unit.criterionRefs.every(text))) {
    throw new Error('workUnits 必須包含 id 與 criterionRefs');
  }
  if (new Set(workUnits.map(unit => unit.id)).size !== workUnits.length) {
    throw new Error('workUnits id 必須唯一');
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    agentPolicy: 'single',
    scope: [...scope],
    source: { baseSha, headSha, changeDigest: null },
    verification: null,
    workUnits: workUnits.map(unit => ({
      id: unit.id, criterionRefs: [...unit.criterionRefs], status: 'pending', testRefs: []
    })),
    failures: [],
    nextAction: '完成一個最小可驗收工作單位，立即驗證並保存 checkpoint'
  };
}

function evaluateExecutionContract(contract, state) {
  const reasons = [];
  const fail = message => reasons.push(`executionContract: ${message}`);
  if (!object(contract)) return ['executionContract 必須是物件'];
  if (![SCHEMA_VERSION, EVIDENCE_SCHEMA_VERSION].includes(contract.schemaVersion)) fail('schemaVersion 不支援');
  if (contract.schemaVersion === EVIDENCE_SCHEMA_VERSION) {
    const binding = contract.verificationBinding;
    const run = contract.verificationRun;
    if (!object(binding) || binding.profile !== 'local-evidence-v1' || !text(binding.planPath) || !digest(binding.planDigest)) {
      fail('v2 缺少固定的驗證計劃 binding');
    }
    if (!object(run) || !text(run.runId) || !text(run.resultPath)) fail('v2 缺少可回讀的執行證據');
  }
  if (contract.agentPolicy !== 'single') fail('此交付模式使用 single Agent');
  if (!Array.isArray(contract.scope) || !contract.scope.length || !contract.scope.every(text)) {
    fail('scope 必須列出已授權範圍');
  }
  if (!text(contract.nextAction)) fail('缺少可接續的 nextAction');

  const source = object(contract.source) ? contract.source : {};
  const verification = object(contract.verification) ? contract.verification : {};
  if (!sha(source.baseSha) || !sha(source.headSha) || !digest(source.changeDigest)) {
    fail('source 缺少完整 baseSha、headSha 或 changeDigest');
  }
  if (!sha(verification.headSha) || !digest(verification.changeDigest) ||
      verification.headSha !== source.headSha || verification.changeDigest !== source.changeDigest) {
    fail('驗證 checkpoint 與目前程式版本不一致，必須重驗');
  }

  const criteria = new Set((Array.isArray(state.completionCriteria) ? state.completionCriteria : [])
    .filter(object).map(item => item.id));
  const tests = new Map((Array.isArray(state.tests) ? state.tests : [])
    .filter(object).map(item => [item.id, item]));
  const evidence = new Set((Array.isArray(state.evidence) ? state.evidence : [])
    .filter(object).map(item => item.id));
  // 必要測試即使沒有被 unit 引用，也不能沿用其他版本或缺少輸出的結果。
  for (const test of tests.values()) {
    if (test.required !== false && (test.status !== 'passed' || test.exitCode !== 0 ||
        !text(test.command) || !outputLocation(test.outputRef) ||
        test.headSha !== source.headSha || test.changeDigest !== source.changeDigest)) {
      fail(`必要測試缺少目前 checkpoint 的成功證據：${test.id}`);
    }
  }
  const covered = new Set();
  const seen = new Set();
  const units = Array.isArray(contract.workUnits) ? contract.workUnits : [];
  if (!units.length) fail('workUnits 至少需要一項');
  if (units.filter(unit => object(unit) && unit.status === 'in_progress').length > 1) {
    fail('同時只能有一個 in_progress 工作單位');
  }
  for (const unit of units) {
    if (!object(unit) || !text(unit.id)) { fail('工作單位缺少有效 id'); continue; }
    if (seen.has(unit.id)) fail(`工作單位 id 重複：${unit.id}`);
    seen.add(unit.id);
    if (unit.status !== 'passed') fail(`${unit.id} 尚未通過驗收`);
    if (!Array.isArray(unit.criterionRefs) || !unit.criterionRefs.length) {
      fail(`${unit.id} 缺少 criterionRefs`);
    } else {
      for (const ref of unit.criterionRefs) {
        if (!criteria.has(ref)) fail(`${unit.id} 引用不存在的完成條件：${ref}`);
        else covered.add(ref);
      }
    }
    if (!Array.isArray(unit.testRefs) || !unit.testRefs.length) {
      fail(`${unit.id} 缺少實際驗證 testRefs`);
    } else {
      for (const ref of unit.testRefs) {
        const test = tests.get(ref);
        if (!test || test.status !== 'passed' || test.exitCode !== 0 || !text(test.command) ||
            !outputLocation(test.outputRef)) {
          fail(`${unit.id} 引用的驗證缺少成功命令、exitCode=0 或輸出定位：${ref}`);
        }
        if (test && (test.headSha !== source.headSha || test.changeDigest !== source.changeDigest)) {
          fail(`${unit.id} 引用的測試屬於其他 checkpoint：${ref}`);
        }
      }
    }
  }
  for (const id of criteria) if (!covered.has(id)) fail(`完成條件未對應工作單位：${id}`);

  if (!Array.isArray(contract.failures)) fail('failures 必須是陣列');
  const failureIds = new Set();
  for (const failure of Array.isArray(contract.failures) ? contract.failures : []) {
    if (!object(failure) || !text(failure.id)) { fail('failure 缺少有效 id'); continue; }
    if (failureIds.has(failure.id)) fail(`failure id 重複：${failure.id}`);
    failureIds.add(failure.id);
    if (!text(failure.fingerprint) || !Number.isSafeInteger(failure.attempts) || failure.attempts < 1) {
      fail(`${failure.id} 缺少錯誤 fingerprint 或有效 attempts`);
    }
    if (failure.status !== 'resolved') fail(`${failure.id} 失敗尚未解決`);
    if (!evidence.has(failure.resolutionEvidenceRef)) fail(`${failure.id} 缺少修復證據`);
    if (failure.attempts >= 2 && !text(failure.changedApproach)) {
      fail(`${failure.id} 重複失敗必須記錄診斷或換路，不得原樣重試`);
    }
  }
  return reasons;
}

function decideRecovery({ authorized = false, hardBlocker = false,
  consecutiveFailures = 0, newEvidence = false } = {}) {
  if (![authorized, hardBlocker, newEvidence].every(value => typeof value === 'boolean') ||
      !Number.isSafeInteger(consecutiveFailures) || consecutiveFailures < 0) {
    throw new Error('修復決策參數格式錯誤');
  }
  if (!authorized || hardBlocker) return 'BLOCKED';
  if (consecutiveFailures === 0) return 'VERIFY';
  // 第二次相同失敗後改做診斷；這不是略過驗收，也不是無限重試。
  return consecutiveFailures >= 2 && !newEvidence ? 'REASSESS' : 'REPAIR';
}

module.exports = { SCHEMA_VERSION, EVIDENCE_SCHEMA_VERSION, DELIVERY_MODE, createExecutionContract,
  evaluateExecutionContract, decideRecovery };
