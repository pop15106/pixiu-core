'use strict';

// 只驗證風險紀錄的一致性；接受者身分與原始證據仍須由呼叫端回讀確認。
const { verificationContext } = require('./lifecycle');
const { digestObject } = require('./test-plan');
const SEVERITIES = new Set(['low', 'medium', 'high', 'critical', 'unknown']);
const STATUSES = new Set(['open', 'accepted', 'mitigated', 'resolved']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const list = value => Array.isArray(value) ? value : [];
const same = (a, b) => object(a) && object(b) && digestObject(a) === digestObject(b);

function riskVerificationContext(state) {
  if (!object(state.riskContext) || !nonempty(state.riskContext.environment) || !nonempty(state.objective))
    throw new Error('RISK_CONTEXT_MISSING: 需記錄適用環境與範圍');
  const bound = verificationContext(state);
  if (!bound && !nonempty(state.riskContext.sourceRevision))
    throw new Error('RISK_SOURCE_MISSING: 需記錄適用來源版本');
  return { scope: state.objective, environment: state.riskContext.environment,
    source: bound || { revision: state.riskContext.sourceRevision } };
}

function validateRiskSeverities(state) {
  const reasons = [];
  for (const field of ['remainingRisks', 'assumptions', 'unknowns', 'challenges', 'counterEvidence']) {
    for (const item of list(state[field])) {
      if (!object(item)) continue;
      // 歷史非風險集合可省略等級；明確填入的值與風險登錄必須有效。
      if (item.severity === undefined && field !== 'remainingRisks') continue;
      if (!SEVERITIES.has(item.severity)) reasons.push(`${item.id || field} RISK_SEVERITY_INVALID`);
      if (item.severity === 'unknown') reasons.push(`${item.id || field} RISK_UNASSESSED: 影響尚未評估`);
    }
  }
  return reasons;
}

function evaluateRiskDispositions(state, hasTraceableSource) {
  const reasons = validateRiskSeverities(state);
  const evidence = new Map(list(state.evidence).filter(object).map(item => [item.id, item]));
  const tests = new Map(list(state.tests).filter(object).map(item => [item.id, item]));
  for (const risk of list(state.remainingRisks)) {
    if (!object(risk)) continue;
    const id = risk.id || 'risk';
    if (!STATUSES.has(risk.status)) {
      reasons.push(`${id} RISK_STATUS_INVALID`);
      continue;
    }
    if (risk.status === 'open') {
      if (['high', 'critical'].includes(risk.severity))
        reasons.push(`${id} 高風險 remainingRisk 尚未處置`);
      continue;
    }
    let context;
    try { context = riskVerificationContext(state); }
    catch (error) { reasons.push(`${id} ${error.message}`); continue; }
    const disposition = risk.disposition;
    if (!object(disposition) || !nonempty(disposition.owner) || !nonempty(disposition.reason) ||
        !same(disposition.context, context)) {
      reasons.push(`${id} RISK_DISPOSITION_INVALID: 需負責人、理由與當次版本／環境／範圍`);
      continue;
    }
    const refs = disposition.evidenceRefs;
    if (!Array.isArray(refs) || refs.length === 0 || !refs.every(nonempty) || new Set(refs).size !== refs.length) {
      reasons.push(`${id} RISK_EVIDENCE_REQUIRED`);
      continue;
    }
    for (const ref of refs) {
      const item = evidence.get(ref) || tests.get(ref);
      if (!item || !list(item.riskRefs).includes(id) || !same(item.context, context) ||
          (tests.has(ref) ? item.status !== 'passed' : !hasTraceableSource(item))) {
        reasons.push(`${id} RISK_EVIDENCE_INVALID: ${ref}`);
      }
    }
    if (risk.status === 'accepted') {
      const approval = risk.approval;
      const proof = evidence.get(approval?.evidenceRef);
      const locators = proof ? [proof.url, proof.source, proof.citation, proof.provenance] : [];
      if (!object(approval) || !nonempty(approval.actor) || !nonempty(approval.reference) ||
          !refs.includes(approval.evidenceRef) || !proof || proof.kind !== 'risk-acceptance' ||
          proof.authority !== 'user' || proof.actor !== approval.actor || proof.decision !== 'accepted' ||
          !locators.includes(approval.reference)) {
        reasons.push(`${id} RISK_APPROVAL_REQUIRED: 需明確使用者接受紀錄，模型不得自行接受`);
      }
    } else if (!nonempty(disposition.action)) {
      reasons.push(`${id} RISK_ACTION_REQUIRED: 需記錄實際緩解或修復措施`);
    }
  }
  return reasons;
}

module.exports = { riskVerificationContext, evaluateRiskDispositions };
