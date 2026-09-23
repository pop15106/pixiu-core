#!/usr/bin/env node
'use strict';

const { createHash } = require('node:crypto');
const fs = require('fs');

const SCHEMA_VERSION = 'pixiu.critical-relay.v1';
const ARRAY_FIELDS = [
  'claims',
  'assumptions',
  'evidence',
  'counterEvidence',
  'challenges',
  'unknowns',
  'tests',
  'completionCriteria',
  'remainingRisks',
  'phaseHistory'
];
const COMPLETION_PHASES = new Set(['RECHALLENGE', 'READY_TO_HANDOFF', 'COMPLETE']);
const ALLOWED_STATUSES = new Set(['active', 'ready', 'completed', 'blocked']);

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

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createCriticalRelay(input = {}) {
  if (!Array.isArray(input.completionCriteria)) {
    throw new Error('completionCriteria 必須是陣列');
  }

  const objective = textValue(input.objective, 'objective');
  const criteria = input.completionCriteria.map((item, index) => {
    if (typeof item === 'string') {
      return {
        id: `criterion-${index + 1}`,
        criterion: textValue(item, 'completionCriteria'),
        satisfied: false,
        evidenceRefs: []
      };
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`completionCriteria[${index}] 必須是字串或物件`);
    }
    return {
      id: textValue(item.id || `criterion-${index + 1}`, 'completionCriteria.id'),
      criterion: textValue(item.criterion, 'completionCriteria.criterion'),
      satisfied: item.satisfied === true,
      evidenceRefs: Array.isArray(item.evidenceRefs) ? [...item.evidenceRefs] : []
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
    phaseHistory: ['UNDERSTAND'],
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

function recordCriticalRelayPhase(state, phase) {
  if (!state || state.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`不支援的 Critical Relay schema：${state?.schemaVersion || 'missing'}`);
  }
  const normalized = textValue(phase, 'phase');
  if (!Array.isArray(state.phaseHistory)) {
    throw new Error('phaseHistory 必須是陣列');
  }
  state.phase = normalized;
  if (state.phaseHistory.at(-1) !== normalized) {
    state.phaseHistory.push(normalized);
  }
  return state;
}

function severityBlocks(value) {
  return value === 'critical' || value === 'high';
}

function getArrayField(state, fieldName, blockingReasons) {
  if (!Array.isArray(state[fieldName])) {
    blockingReasons.push(`${fieldName} 必須是陣列`);
    return [];
  }
  return state[fieldName];
}

function getReferenceList(value, label, blockingReasons) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    blockingReasons.push(`${label} 必須是陣列`);
    return [];
  }
  return value;
}

function indexByUniqueId(items, collectionName, blockingReasons) {
  const index = new Map();
  for (const [position, item] of items.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      blockingReasons.push(`${collectionName}[${position}] 必須是物件`);
      continue;
    }
    if (typeof item.id !== 'string' || !item.id.trim()) {
      blockingReasons.push(`${collectionName}[${position}] 缺少有效 id`);
      continue;
    }
    if (index.has(item.id)) {
      blockingReasons.push(`${collectionName} 出現重複 id：${item.id}`);
      continue;
    }
    index.set(item.id, item);
  }
  return index;
}

function hasTraceableSource(item) {
  if (typeof item?.url === 'string' && /^https?:\/\/\S+$/iu.test(item.url.trim())) return true;
  if (typeof item?.citation === 'string' && item.citation.trim().length >= 4) return true;
  if (typeof item?.provenance === 'string' && item.provenance.trim().length >= 4) return true;
  if (
    typeof item?.source === 'string' &&
    /^(?:https?:\/\/|file:|git:|repo:|doi:|arxiv:|urn:)/iu.test(item.source.trim())
  ) {
    return true;
  }
  return false;
}

function counterEvidenceClaimRefs(item, blockingReasons) {
  const hasCanonical = item.claimRefs !== undefined;
  const raw = hasCanonical ? item.claimRefs : item.challenges;
  return getReferenceList(
    raw,
    `counterEvidence ${item.id || '<missing>'}.${hasCanonical ? 'claimRefs' : 'challenges'}`,
    blockingReasons
  );
}

function evaluateCriticalRelay(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('Critical Relay state 必須是物件');
  }
  if (state.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`不支援的 Critical Relay schema：${state?.schemaVersion || 'missing'}`);
  }

  const blockingReasons = [];

  for (const fieldName of ARRAY_FIELDS) {
    if (!Array.isArray(state[fieldName])) {
      blockingReasons.push(`${fieldName} 必須是陣列`);
    }
  }

  const claims = getArrayField(state, 'claims', blockingReasons);
  const assumptions = getArrayField(state, 'assumptions', blockingReasons);
  const evidence = getArrayField(state, 'evidence', blockingReasons);
  const counterEvidence = getArrayField(state, 'counterEvidence', blockingReasons);
  const challenges = getArrayField(state, 'challenges', blockingReasons);
  const unknowns = getArrayField(state, 'unknowns', blockingReasons);
  const tests = getArrayField(state, 'tests', blockingReasons);
  const completionCriteria = getArrayField(state, 'completionCriteria', blockingReasons);
  const remainingRisks = getArrayField(state, 'remainingRisks', blockingReasons);
  const phaseHistory = getArrayField(state, 'phaseHistory', blockingReasons);

  const claimById = indexByUniqueId(claims, 'claims', blockingReasons);
  const evidenceById = indexByUniqueId(evidence, 'evidence', blockingReasons);
  const counterEvidenceById = indexByUniqueId(counterEvidence, 'counterEvidence', blockingReasons);
  const challengeById = indexByUniqueId(challenges, 'challenges', blockingReasons);
  const testById = indexByUniqueId(tests, 'tests', blockingReasons);
  indexByUniqueId(assumptions, 'assumptions', blockingReasons);
  indexByUniqueId(unknowns, 'unknowns', blockingReasons);
  indexByUniqueId(completionCriteria, 'completionCriteria', blockingReasons);
  indexByUniqueId(remainingRisks, 'remainingRisks', blockingReasons);

  for (const id of evidenceById.keys()) {
    if (testById.has(id)) {
      blockingReasons.push(`evidence 與 tests 共用 id，reference 會產生歧義：${id}`);
    }
  }

  if (!String(state.objective || '').trim()) {
    blockingReasons.push('objective 不可為空');
  }
  if (!ALLOWED_STATUSES.has(state.status)) {
    blockingReasons.push(`status 不合法：${state.status || 'missing'}`);
  }
  if (state.status === 'blocked') {
    blockingReasons.push('status=blocked，不得宣告完成');
  }
  if (claims.length === 0) {
    blockingReasons.push('claims 至少需要一項可驗證主張');
  }
  if (completionCriteria.length === 0) {
    blockingReasons.push('completionCriteria 至少需要一項');
  }
  if (!COMPLETION_PHASES.has(state.phase)) {
    blockingReasons.push(
      `phase=${state.phase || 'missing'} 尚未進入 RECHALLENGE／READY_TO_HANDOFF／COMPLETE`
    );
  }
  if (!String(state.nextAction || '').trim()) {
    blockingReasons.push('nextAction 不可為空');
  }

  const verifyIndex = phaseHistory.lastIndexOf('VERIFY');
  const rechallengeIndex = phaseHistory.lastIndexOf('RECHALLENGE');
  if (verifyIndex < 0 || rechallengeIndex < 0 || rechallengeIndex <= verifyIndex) {
    blockingReasons.push('phaseHistory 必須留下 VERIFY → RECHALLENGE 的先後紀錄');
  }
  if (
    phaseHistory.length > 0 &&
    COMPLETION_PHASES.has(state.phase) &&
    phaseHistory.at(-1) !== state.phase
  ) {
    blockingReasons.push(`phaseHistory 最後階段與目前 phase 不一致：${phaseHistory.at(-1)} != ${state.phase}`);
  }

  for (const claim of claims) {
    if (!claim || typeof claim !== 'object' || Array.isArray(claim)) continue;
    const id = claim.id || 'claim';
    if (!['supported', 'rejected', 'withdrawn'].includes(claim.status)) {
      blockingReasons.push(`${id} 尚未收斂：status=${claim.status || 'missing'}`);
      continue;
    }

    const evidenceRefs = getReferenceList(claim.evidenceRefs, `${id}.evidenceRefs`, blockingReasons);
    const challengeRefs = getReferenceList(claim.challengeRefs, `${id}.challengeRefs`, blockingReasons);
    const counterEvidenceRefs = getReferenceList(
      claim.counterEvidenceRefs,
      `${id}.counterEvidenceRefs`,
      blockingReasons
    );

    if (claim.status === 'supported') {
      if (evidenceRefs.length === 0) {
        blockingReasons.push(`${id} 宣告 supported，但沒有 evidenceRefs`);
      }
      if (challengeRefs.length === 0) {
        blockingReasons.push(`${id} 宣告 supported，但沒有 challengeRefs`);
      }
    }

    for (const evidenceRef of evidenceRefs) {
      const item = evidenceById.get(evidenceRef);
      if (!item) {
        blockingReasons.push(`${id} 引用不存在的 evidence：${evidenceRef}`);
      } else if (!hasTraceableSource(item)) {
        blockingReasons.push(`${id} 引用的 evidence 缺少可追溯定位：${evidenceRef}`);
      }
    }

    for (const challengeRef of challengeRefs) {
      const challenge = challengeById.get(challengeRef);
      if (!challenge) {
        blockingReasons.push(`${id} 引用不存在的 challenge：${challengeRef}`);
        continue;
      }
      const challengeClaimRefs = getReferenceList(
        challenge.claimRefs,
        `${challengeRef}.claimRefs`,
        blockingReasons
      );
      if (!challengeClaimRefs.includes(id)) {
        blockingReasons.push(`${id} 的 challenge 未反向指向該 claim：${challengeRef}`);
      }
      if (challenge.status !== 'resolved') {
        blockingReasons.push(`${id} 的 challenge 尚未 resolved：${challengeRef}`);
      }
      if (!String(challenge.method || '').trim()) {
        blockingReasons.push(`${id} 的 challenge 缺少 method：${challengeRef}`);
      }
      if (!String(challenge.result || '').trim()) {
        blockingReasons.push(`${id} 的 challenge 缺少 result：${challengeRef}`);
      }
    }

    for (const counterEvidenceRef of counterEvidenceRefs) {
      const item = counterEvidenceById.get(counterEvidenceRef);
      if (!item) {
        blockingReasons.push(`${id} 引用不存在的 counterEvidence：${counterEvidenceRef}`);
      } else if (!hasTraceableSource(item)) {
        blockingReasons.push(`${id} 引用的 counterEvidence 缺少可追溯定位：${counterEvidenceRef}`);
      }
    }
    if (counterEvidenceRefs.length > 0 && claim.counterEvidenceStatus !== 'addressed') {
      blockingReasons.push(`${id} 仍有未處理 counterEvidence`);
    }
  }

  for (const item of evidence) {
    if (item && typeof item === 'object' && !Array.isArray(item) && !hasTraceableSource(item)) {
      blockingReasons.push(`${item.id || 'evidence'} 缺少可追溯定位`);
    }
  }

  for (const item of counterEvidence) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    if (!hasTraceableSource(item)) {
      blockingReasons.push(`${item.id || 'counterEvidence'} 缺少可追溯定位`);
    }
    const claimRefs = counterEvidenceClaimRefs(item, blockingReasons);
    if (claimRefs.length === 0) {
      blockingReasons.push(`${item.id || 'counterEvidence'} 沒有指向任何 claim`);
    }
    for (const claimRef of claimRefs) {
      const claim = claimById.get(claimRef);
      if (!claim) {
        blockingReasons.push(`${item.id || 'counterEvidence'} 指向不存在的 claim：${claimRef}`);
        continue;
      }
      const claimRefsList = getReferenceList(
        claim.counterEvidenceRefs,
        `${claimRef}.counterEvidenceRefs`,
        blockingReasons
      );
      if (!claimRefsList.includes(item.id)) {
        blockingReasons.push(
          `${item.id} 已指向 ${claimRef}，但該 claim 未反向列出此 counterEvidence`
        );
      }
      if (claim.counterEvidenceStatus !== 'addressed') {
        blockingReasons.push(`${item.id} 對應的 ${claimRef} 尚未標示 counterEvidence addressed`);
      }
    }
    if (
      severityBlocks(item.severity) &&
      !['addressed', 'resolved', 'accepted'].includes(item.status)
    ) {
      blockingReasons.push(`${item.id || 'counterEvidence'} 高風險反證尚未處理`);
    }
  }

  for (const assumption of assumptions) {
    if (
      assumption &&
      typeof assumption === 'object' &&
      severityBlocks(assumption.severity) &&
      !['verified', 'bounded', 'rejected'].includes(assumption.status)
    ) {
      blockingReasons.push(`${assumption.id || 'assumption'} 高風險假設尚未驗證或界定`);
    }
  }

  for (const challenge of challenges) {
    if (
      challenge &&
      typeof challenge === 'object' &&
      severityBlocks(challenge.severity) &&
      challenge.status !== 'resolved'
    ) {
      blockingReasons.push(`${challenge.id || 'challenge'} 高風險挑戰尚未解決`);
    }
  }

  for (const unknown of unknowns) {
    if (
      unknown &&
      typeof unknown === 'object' &&
      severityBlocks(unknown.severity) &&
      unknown.status !== 'resolved'
    ) {
      blockingReasons.push(`${unknown.id || 'unknown'} 高風險未知項尚未解決`);
    }
  }

  for (const test of tests) {
    if (
      test &&
      typeof test === 'object' &&
      test.required !== false &&
      test.status !== 'passed'
    ) {
      blockingReasons.push(`${test.id || test.name || 'test'} 必要驗證尚未通過`);
    }
  }

  for (const criterion of completionCriteria) {
    if (!criterion || typeof criterion !== 'object' || Array.isArray(criterion)) continue;
    const id = criterion.id || 'criterion';
    const evidenceRefs = getReferenceList(
      criterion.evidenceRefs,
      `${id}.evidenceRefs`,
      blockingReasons
    );
    if (criterion.satisfied !== true) {
      blockingReasons.push(`${id} 完成條件尚未滿足`);
    } else if (evidenceRefs.length === 0) {
      blockingReasons.push(`${id} 已標示完成，但缺少 evidenceRefs`);
    }
    for (const evidenceRef of evidenceRefs) {
      const evidenceItem = evidenceById.get(evidenceRef);
      const testItem = testById.get(evidenceRef);
      if (!evidenceItem && !testItem) {
        blockingReasons.push(`${id} 引用不存在的 evidence/test：${evidenceRef}`);
      } else if (evidenceItem && !hasTraceableSource(evidenceItem)) {
        blockingReasons.push(`${id} 引用的 evidence 缺少可追溯定位：${evidenceRef}`);
      } else if (testItem && testItem.status !== 'passed') {
        blockingReasons.push(`${id} 引用的 test 尚未通過：${evidenceRef}`);
      }
    }
  }

  for (const risk of remainingRisks) {
    if (
      risk &&
      typeof risk === 'object' &&
      severityBlocks(risk.severity) &&
      !['accepted', 'mitigated', 'resolved'].includes(risk.status)
    ) {
      blockingReasons.push(`${risk.id || 'risk'} 高風險 remainingRisk 尚未處置`);
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    canComplete: blockingReasons.length === 0,
    blockingReasons: [...new Set(blockingReasons)],
    nextPhase: blockingReasons.length === 0 ? 'READY_TO_HANDOFF' : 'CHALLENGE'
  };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, stableValue(value[key])])
  );
}

function stateDigest(state) {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(state)))
    .digest('hex');
}

function buildHandoffSnapshot(state) {
  const snapshot = deepClone({
    schemaVersion: state.schemaVersion,
    objective: state.objective,
    mode: state.mode,
    phase: state.phase,
    phaseHistory: state.phaseHistory,
    iteration: state.iteration,
    status: state.status,
    claims: state.claims,
    assumptions: state.assumptions,
    evidence: state.evidence,
    counterEvidence: state.counterEvidence,
    challenges: state.challenges,
    unknowns: state.unknowns,
    tests: state.tests,
    completionCriteria: state.completionCriteria,
    remainingRisks: state.remainingRisks,
    nextAction: state.nextAction
  });
  snapshot.evaluation = evaluateCriticalRelay(snapshot);
  snapshot.stateDigest = stateDigest(snapshot);
  return snapshot;
}

function verifyHandoffSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('handoff snapshot 必須是物件');
  }
  const copy = deepClone(snapshot);
  const expectedDigest = copy.stateDigest;
  delete copy.stateDigest;
  delete copy.evaluation;
  const actualDigest = stateDigest(copy);
  const evaluation = evaluateCriticalRelay(copy);
  return {
    digestMatches: typeof expectedDigest === 'string' && expectedDigest === actualDigest,
    evaluation,
    canAccept: typeof expectedDigest === 'string' &&
      expectedDigest === actualDigest &&
      evaluation.canComplete
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
  recordCriticalRelayPhase,
  evaluateCriticalRelay,
  buildHandoffSnapshot,
  verifyHandoffSnapshot
};
