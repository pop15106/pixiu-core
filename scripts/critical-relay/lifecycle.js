'use strict';

// CR 研究／設計／開發／驗證的結構化決策帳本，沿用 canonical CR state 而非建立第二個任務系統。
const { digestObject } = require('./test-plan');

const SCHEMA = 'pixiu.cr-lifecycle.v1';
const STAGES = Object.freeze(['research', 'design', 'development', 'verification']);
const TYPES = Object.freeze({
  research: ['source_check', 'countersearch', 'reassessment'],
  design: ['options_review', 'decision'],
  development: ['change_review', 'counterexample'],
  verification: ['evidence_review', 'rechallenge']
});
const HIGH_RISK = new Set(['production', 'financial', 'database-write', 'security', 'destructive']);
const MEDIUM_RISK = new Set(['cross-repo', 'unknown-framework', 'external-dependency', 'shared-library', 'api-contract']);
const DEPTH_ORDER = Object.freeze({ quick: 0, standard: 1, deep: 2 });
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const uniqueStrings = value => Array.isArray(value) && value.every(nonempty) && new Set(value).size === value.length;
const clone = value => JSON.parse(JSON.stringify(value));
const stageOrder = type => type === 'research' ? ['research', 'verification'] : STAGES;

function classifyDepth(signals = [], requested = 'standard') {
  if (!uniqueStrings(signals) || signals.some(item => !HIGH_RISK.has(item) && !MEDIUM_RISK.has(item) && item !== 'minor'))
    throw new Error('LIFECYCLE_RISK_SIGNALS_INVALID');
  if (!Object.hasOwn(DEPTH_ORDER, requested)) throw new Error('LIFECYCLE_DEPTH_INVALID');
  const minimum = signals.some(item => HIGH_RISK.has(item)) || signals.filter(item => MEDIUM_RISK.has(item)).length >= 2
    ? 'deep' : signals.some(item => MEDIUM_RISK.has(item)) ? 'standard' : 'quick';
  if (DEPTH_ORDER[requested] < DEPTH_ORDER[minimum]) throw new Error('LIFECYCLE_RISK_DOWNGRADE');
  return requested;
}

function createLifecycle({ taskType = 'development', depth = 'standard', riskSignals = [] } = {}) {
  if (!['research', 'development'].includes(taskType)) throw new Error('LIFECYCLE_TASK_TYPE_INVALID');
  return { schemaVersion: SCHEMA, taskType, depth: classifyDepth(riskSignals, depth),
    riskSignals: [...riskSignals], cycle: 1, stage: 'research', stageHistory: ['research'],
    entries: [], reopenHistory: [] };
}

function lifecycleBinding(lifecycle) {
  if (!isObject(lifecycle) || lifecycle.schemaVersion !== SCHEMA) throw new Error('LIFECYCLE_BINDING_INVALID');
  const policy = { schemaVersion: SCHEMA, taskType: lifecycle.taskType, depth: lifecycle.depth,
    riskSignals: [...lifecycle.riskSignals] };
  classifyDepth(policy.riskSignals, policy.depth);
  return { ...policy, policyDigest: digestObject(policy) };
}

function verifyLifecycleBinding(binding, lifecycle) {
  try { return isObject(binding) && digestObject(binding) === digestObject(lifecycleBinding(lifecycle)); }
  catch { return false; }
}

// 正式驗證事件必須指向同一次執行與來源，不能只重用測試 ID 或階段名稱。
function verificationContext(state) {
  if (state?.researchRequired === true) {
    if (!state.researchVerification?.digest) throw Error('LIFECYCLE_RESEARCH_NOT_READY');
    return { researchDigest: state.researchVerification.digest, planDigest: state.researchBinding?.planDigest };
  }
  const contract = state?.executionContract;
  if (contract?.schemaVersion !== 'pixiu.cr-execution.v2') return null;
  const run = contract.verificationRun, source = contract.source;
  if (!run?.runId || !source?.headSha || !source?.changeDigest || !contract.verification)
    throw new Error('LIFECYCLE_VERIFICATION_NOT_READY');
  return { runId: run.runId, headSha: source.headSha, changeDigest: source.changeDigest,
    planDigest: contract.verificationBinding?.planDigest };
}

function assertLifecycleTransition(previous, next) {
  if (!previous) return;
  if (!next || !verifyLifecycleBinding(lifecycleBinding(previous), next))
    throw new Error('LIFECYCLE_POLICY_CHANGED');
  if (!Number.isSafeInteger(next.cycle) || next.cycle < previous.cycle)
    throw new Error('LIFECYCLE_CYCLE_REGRESSED');
  for (const field of ['entries', 'stageHistory', 'reopenHistory']) {
    if (!Array.isArray(previous[field]) || !Array.isArray(next[field]) ||
        next[field].length < previous[field].length || previous[field].some((item, i) =>
          digestObject(item) !== digestObject(next[field][i])))
      throw new Error('LIFECYCLE_HISTORY_REWRITTEN: ' + field);
  }
  if (next.cycle !== next.reopenHistory.length + 1 || next.stageHistory.at(-1) !== next.stage)
    throw new Error('LIFECYCLE_HISTORY_INVALID');
}

const activeEntries = (lifecycle, stage) => lifecycle.entries.filter(item =>
  item.cycle === lifecycle.cycle && (!stage || item.stage === stage));
const byId = collection => new Map((Array.isArray(collection) ? collection : []).filter(isObject)
  .map(item => [item.id, item]));

function validateReferences(item, state, reasons) {
  const lists = { claimRefs: 'claims', evidenceRefs: 'evidence', counterEvidenceRefs: 'counterEvidence',
    challengeRefs: 'challenges', testRefs: 'tests' };
  for (const [field, table] of Object.entries(lists)) {
    if (item[field] === undefined) continue;
    if (!uniqueStrings(item[field])) {
      reasons.push(item.id + '.' + field + ' 無效或有重複');
      continue;
    }
    const index = byId(state?.[table]);
    for (const ref of item[field]) {
      const referenced = index.get(ref);
      if (!referenced) reasons.push(item.id + ' 引用不存在的 ' + table + ': ' + ref);
      else if (field === 'testRefs' && referenced.status !== 'passed')
        reasons.push(item.id + ' 必要測試尚未通過: ' + ref);
      else if (field === 'challengeRefs' && referenced.status !== 'resolved')
        reasons.push(item.id + ' 挑戰尚未解決: ' + ref);
      else if (field === 'counterEvidenceRefs' && !['addressed', 'resolved', 'accepted'].includes(referenced.status))
        reasons.push(item.id + ' 反證尚未處理: ' + ref);
    }
  }
}

function evaluateStage(lifecycle, state, stage) {
  const reasons = [];
  const entries = activeEntries(lifecycle, stage);
  const rs = kind => entries.filter(item => item.kind === kind);
  const has = (obj, key) => uniqueStrings(obj?.[key]) && obj[key].length > 0;
  const performed = item => nonempty(item?.method) && nonempty(item?.result);
  const firstIndex = kind => entries.findIndex(item => item.kind === kind);
  const reversed = (before, after) => firstIndex(after) >= 0 &&
    (firstIndex(before) < 0 || firstIndex(before) >= firstIndex(after));

  if (stage === 'research') {
    if (!rs('source_check').some(item => has(item, 'claimRefs') && has(item, 'evidenceRefs') && performed(item)))
      reasons.push('research 需要可追溯的主張、來源與核對方法');
    if (!rs('countersearch').some(item => has(item, 'queries') && performed(item) &&
       ['FOUND','NOT_FOUND'].includes(item.outcome) &&
       (item.outcome !== 'FOUND' || has(item,'counterEvidenceRefs'))))
      reasons.push('research 必須實際記錄反向查找，找不到不等於證明');
    const foundRefs = new Set(rs('countersearch').filter(item => item.outcome === 'FOUND')
      .flatMap(item => item.counterEvidenceRefs || []));
    const reassessed = new Set(rs('reassessment').filter(performed).flatMap(item => item.counterEvidenceRefs || []));
    if ([...foundRefs].some(ref => !reassessed.has(ref)))
      reasons.push('research 發現的反證必須逐項 REASSESS');
    if (reversed('source_check','countersearch') || reversed('countersearch','reassessment'))
      reasons.push('research 須先查來源，之後反向搜尋與重新評估');
    if (lifecycle.depth === 'deep') {
      const sources = byId(state.evidence);
      const locators = rs('source_check').flatMap(item => item.evidenceRefs || [])
        .map(ref => sources.get(ref)).filter(Boolean)
        .map(item => item.url || item.source || item.citation).filter(nonempty);
      if (new Set(locators).size < 2) reasons.push('Deep CR 至少要有兩個不同來源位置');
    }
  }
  if (stage === 'design') {
    const alternatives = rs('options_review').filter(item =>
      Array.isArray(item.options) && item.options.length >= (lifecycle.depth === 'quick' ? 1 : 2) &&
      new Set(item.options.map(option => option.id)).size === item.options.length &&
      item.options.every(option => isObject(option) && nonempty(option.id) &&
        nonempty(option.description) && nonempty(option.advantages) && nonempty(option.disadvantages)) && performed(item));
    if (!alternatives.length) reasons.push('design 尚未比較可行方案及取捨');
    if (!rs('decision').some(item => nonempty(item.selectedId) && nonempty(item.rationale) &&
      has(item,'evidenceRefs') && has(item,'challengeRefs') && performed(item) &&
      alternatives.some(row => row.options.some(option => option.id === item.selectedId))))
      reasons.push('design 決策缺少引用來源、反對觀點或不選原因');
    if (reversed('options_review','decision')) reasons.push('design 方案比較必須先於決策');
  }
  if (stage === 'development') {
    if (!rs('change_review').some(item => has(item,'changes') && has(item,'failureScenarios') &&
       has(item,'claimRefs') && has(item,'challengeRefs') && performed(item)))
      reasons.push('development 缺少改動清單、影響面和反例風險');
    if (!rs('counterexample').some(item => has(item,'challengeRefs') && performed(item)))
      reasons.push('development 缺少主動反例或故障驗證');
    if (reversed('change_review','counterexample')) reasons.push('development 需先核對變更後驗證反例');
  }
  if (stage === 'verification') {
    if (!rs('evidence_review').some(item => performed(item) &&
       (lifecycle.taskType === 'research' ? has(item,'evidenceRefs') : has(item,'testRefs'))))
      reasons.push('verification 缺少正式證據或已通過的測試結果回讀');
    if (!rs('rechallenge').some(item => has(item,'challengeRefs') && performed(item)))
      reasons.push('verification 缺少 VERIFY 之後的 RECHALLENGE');
    if (reversed('evidence_review','rechallenge')) reasons.push('verification 必須先回讀證據再重新挑戰');
    try {
      const context = verificationContext(state);
      if (context && entries.some(item => ['evidence_review', 'rechallenge'].includes(item.kind) &&
          (!isObject(item.verificationContext) || digestObject(item.verificationContext) !== digestObject(context))))
        reasons.push('LIFECYCLE_STALE_VERIFICATION: 覆核必須對應當次 run 與來源');
    } catch (error) { reasons.push(error.message); }
  }
  for (const item of entries) {
    validateReferences(item,state,reasons);
    if (!performed(item)) reasons.push(item.id + ' 缺少 method／result');
    if (item.kind === 'countersearch' && item.outcome === 'BLOCKED') reasons.push(item.id + ' 反向查找未執行');
    if (item.kind === 'evidence_review' && item.outcome !== 'PASS') reasons.push(item.id + ' 驗證仍未通過');
  }
  return reasons;
}

function evaluateLifecycle(lifecycle, state = {}) {
  const reasons = [];
  if (!isObject(lifecycle) || lifecycle.schemaVersion !== SCHEMA ||
    !['research','development'].includes(lifecycle.taskType) || !Array.isArray(lifecycle.entries) ||
    !Array.isArray(lifecycle.stageHistory) || !Array.isArray(lifecycle.reopenHistory) ||
    !Number.isSafeInteger(lifecycle.cycle) || lifecycle.cycle < 1)
    return { canComplete: false, blockingReasons: ['LIFECYCLE_SCHEMA_INVALID'] };
  try { classifyDepth(lifecycle.riskSignals,lifecycle.depth); }
  catch (error) { reasons.push(error.message); }
  const order = stageOrder(lifecycle.taskType);
  if (![...order,'complete'].includes(lifecycle.stage) ||
    lifecycle.stageHistory[0] !== 'research' || lifecycle.stageHistory.at(-1) !== lifecycle.stage)
    reasons.push('LIFECYCLE_STAGE_INVALID');
  const ids = new Set(); let lastCycle = 1, orderIndex = 0;
  for (const [index, item] of lifecycle.entries.entries()) {
    if (!isObject(item) || !nonempty(item.id) || ids.has(item.id) || item.seq !== index + 1 ||
        !Number.isSafeInteger(item.cycle) || item.cycle < lastCycle || item.cycle > lifecycle.cycle ||
        !order.includes(item.stage) || !TYPES[item.stage].includes(item.kind)) {
      reasons.push('LIFECYCLE_EVENT_INVALID'); continue;
    }
    ids.add(item.id);
    if (item.cycle > lastCycle) { lastCycle = item.cycle; orderIndex = 0; }
    const i = order.indexOf(item.stage);
    if (i < orderIndex) reasons.push('LIFECYCLE_EVENT_ORDER_INVALID');
    orderIndex = i;
  }
  const sourceIds = new Set([...(state.evidence || []), ...(state.counterEvidence || [])]
    .filter(isObject).map(item => item.id));
  if (lifecycle.cycle !== lifecycle.reopenHistory.length + 1 ||
    lifecycle.reopenHistory.some(item => !isObject(item) || !nonempty(item.reason) ||
      !nonempty(item.evidenceRef) || !sourceIds.has(item.evidenceRef)))
    reasons.push('LIFECYCLE_REOPEN_HISTORY_INVALID');
  const expected = [];
  for (let cycle = 1; cycle <= lifecycle.cycle; cycle++) {
    const ending = cycle < lifecycle.cycle ? lifecycle.reopenHistory[cycle - 1]?.fromStage : lifecycle.stage;
    const position = ending === 'complete' ? order.length : order.indexOf(ending);
    if (position < 0) { reasons.push('LIFECYCLE_STAGE_HISTORY_INVALID'); break; }
    expected.push(...order.slice(0,position+1));
    if (ending === 'complete') expected.push('complete');
  }
  if (JSON.stringify(lifecycle.stageHistory) !== JSON.stringify(expected))
    reasons.push('LIFECYCLE_STAGE_HISTORY_INVALID');
  for (const stage of order) reasons.push(...evaluateStage(lifecycle,state,stage).map(x => stage + ': ' + x));
  if (lifecycle.stage !== 'complete') reasons.push('LIFECYCLE_NOT_COMPLETE');
  return { canComplete: reasons.length === 0, blockingReasons: [...new Set(reasons)] };
}

function recordEvent(lifecycle, input, state) {
  if (!isObject(lifecycle) || lifecycle.schemaVersion !== SCHEMA || lifecycle.stage === 'complete' ||
      !isObject(input) || !nonempty(input.id) || !TYPES[lifecycle.stage]?.includes(input.kind) ||
      lifecycle.entries.some(item => item.id === input.id) || !nonempty(input.method) || !nonempty(input.result))
    throw new Error('LIFECYCLE_EVENT_INVALID');
  const next = clone(lifecycle);
  const context = next.stage === 'verification' && state ? verificationContext(state) : null;
  next.entries.push({ ...clone(input), ...(context ? { verificationContext: context } : {}),
    stage: next.stage, cycle: next.cycle, seq: next.entries.length + 1 });
  return next;
}

function advanceStage(lifecycle, state) {
  if (!isObject(lifecycle) || lifecycle.stage === 'complete') throw new Error('LIFECYCLE_STAGE_INVALID');
  const missing = evaluateStage(lifecycle,state,lifecycle.stage);
  if (missing.length) throw new Error('LIFECYCLE_STAGE_BLOCKED: ' + missing.join(' | '));
  const next = clone(lifecycle); const order = stageOrder(next.taskType);
  next.stage = order[order.indexOf(next.stage)+1] || 'complete';
  next.stageHistory.push(next.stage);
  return next;
}

function reopenLifecycle(lifecycle, {reason,evidenceRef} = {}) {
  if (!isObject(lifecycle) || lifecycle.schemaVersion !== SCHEMA || !nonempty(reason) || !nonempty(evidenceRef))
    throw new Error('LIFECYCLE_REOPEN_INVALID');
  const next = clone(lifecycle);
  next.reopenHistory.push({ cycle: next.cycle, fromStage: next.stage, reason, evidenceRef });
  next.cycle++; next.stage='research'; next.stageHistory.push('research');
  return next;
}
module.exports = { SCHEMA, STAGES, classifyDepth, createLifecycle, lifecycleBinding,
  verifyLifecycleBinding, verificationContext, assertLifecycleTransition,
  evaluateStage, evaluateLifecycle, recordEvent, advanceStage, reopenLifecycle };
