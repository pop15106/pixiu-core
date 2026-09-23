#!/usr/bin/env node
'use strict';

const fs = require('fs');

const SCHEMA_VERSION = 'pixiu.critical-relay.v1';

function textValue(value, fieldName) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error(`${fieldName} 不可為空`);
  }
  return normalized;
}

function listValue(value) {
  return Array.isArray(value) ? value : [];
}

function createCriticalRelay(input = {}) {
  const objective = textValue(input.objective, 'objective');
  const criteria = listValue(input.completionCriteria)
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: `criterion-${index + 1}`,
          criterion: textValue(item, 'completionCriteria'),
          satisfied: false,
          evidenceRefs: []
        };
      }
      return {
        id: textValue(item.id || `criterion-${index + 1}`, 'completionCriteria.id'),
        criterion: textValue(item.criterion, 'completionCriteria.criterion'),
        satisfied: item.satisfied === true,
        evidenceRefs: listValue(item.evidenceRefs)
      };
    });

  if (criteria.length === 0) {
    throw new Error('completionCriteria 至少需要一項');
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    objective,
    mode: input.mode || 'general',
    phase: 'UNDERSTAND',
    iteration: 0,
    status: 'active',
    claims: [],
    assumptions: [],
    evidence: [],
    counterEvidence: [],
    challenges: [],
    unknowns: [],
    tests: [],
    completionCriteria: criteria,
    remainingRisks: [],
    nextAction: input.nextAction || '建立第一批可驗證主張與假設'
  };
}

function severityBlocks(value) {
  return value === 'critical' || value === 'high';
}

function evaluateCriticalRelay(state) {
  if (!state || state.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`不支援的 Critical Relay schema：${state?.schemaVersion || 'missing'}`);
  }

  const blockingReasons = [];

  for (const claim of listValue(state.claims)) {
    const id = claim.id || 'claim';
    if (!['supported', 'rejected', 'withdrawn'].includes(claim.status)) {
      blockingReasons.push(`${id} 尚未收斂：status=${claim.status || 'missing'}`);
      continue;
    }
    if (claim.status === 'supported' && listValue(claim.evidenceRefs).length === 0) {
      blockingReasons.push(`${id} 宣告 supported，但沒有 evidenceRefs`);
    }
    if (
      listValue(claim.counterEvidenceRefs).length > 0 &&
      claim.counterEvidenceStatus !== 'addressed'
    ) {
      blockingReasons.push(`${id} 仍有未處理 counterEvidence`);
    }
  }

  for (const assumption of listValue(state.assumptions)) {
    if (
      severityBlocks(assumption.severity) &&
      !['verified', 'bounded', 'rejected'].includes(assumption.status)
    ) {
      blockingReasons.push(`${assumption.id || 'assumption'} 高風險假設尚未驗證或界定`);
    }
  }

  for (const challenge of listValue(state.challenges)) {
    if (severityBlocks(challenge.severity) && challenge.status !== 'resolved') {
      blockingReasons.push(`${challenge.id || 'challenge'} 高風險挑戰尚未解決`);
    }
  }

  for (const unknown of listValue(state.unknowns)) {
    if (severityBlocks(unknown.severity) && unknown.status !== 'resolved') {
      blockingReasons.push(`${unknown.id || 'unknown'} 高風險未知項尚未解決`);
    }
  }

  for (const test of listValue(state.tests)) {
    if (test.required !== false && test.status !== 'passed') {
      blockingReasons.push(`${test.id || test.name || 'test'} 必要驗證尚未通過`);
    }
  }

  for (const criterion of listValue(state.completionCriteria)) {
    if (criterion.satisfied !== true) {
      blockingReasons.push(`${criterion.id || 'criterion'} 完成條件尚未滿足`);
    } else if (listValue(criterion.evidenceRefs).length === 0) {
      blockingReasons.push(`${criterion.id || 'criterion'} 已標示完成，但缺少 evidenceRefs`);
    }
  }

  for (const risk of listValue(state.remainingRisks)) {
    if (
      severityBlocks(risk.severity) &&
      !['accepted', 'mitigated', 'resolved'].includes(risk.status)
    ) {
      blockingReasons.push(`${risk.id || 'risk'} 高風險 remainingRisk 尚未處置`);
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    canComplete: blockingReasons.length === 0,
    blockingReasons,
    nextPhase: blockingReasons.length === 0 ? 'READY_TO_HANDOFF' : 'CHALLENGE'
  };
}

function buildHandoffSnapshot(state) {
  const evaluation = evaluateCriticalRelay(state);
  return {
    schemaVersion: SCHEMA_VERSION,
    objective: state.objective,
    phase: state.phase,
    iteration: state.iteration,
    claims: listValue(state.claims),
    assumptions: listValue(state.assumptions),
    evidence: listValue(state.evidence),
    counterEvidence: listValue(state.counterEvidence),
    challenges: listValue(state.challenges),
    unknowns: listValue(state.unknowns),
    tests: listValue(state.tests),
    completionCriteria: listValue(state.completionCriteria),
    remainingRisks: listValue(state.remainingRisks),
    nextAction: state.nextAction,
    evaluation
  };
}

function checkFile(filePath) {
  const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const snapshot = buildHandoffSnapshot(state);
  process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n');
  return snapshot.evaluation.canComplete;
}

if (require.main === module) {
  const [command, filePath] = process.argv.slice(2);
  if (command !== 'check' || !filePath) {
    process.stderr.write('用法：node scripts/critical-relay/critical-relay.js check <state.json>\n');
    process.exitCode = 2;
  } else {
    process.exitCode = checkFile(filePath) ? 0 : 2;
  }
}

module.exports = {
  SCHEMA_VERSION,
  createCriticalRelay,
  evaluateCriticalRelay,
  buildHandoffSnapshot
};
