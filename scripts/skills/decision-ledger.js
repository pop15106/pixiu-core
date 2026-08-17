#!/usr/bin/env node
'use strict';

const DECISION_STATUSES = Object.freeze([
  'OPEN',
  'BLOCKED_BY_FACT',
  'READY_TO_ASK',
  'RESOLVED',
  'REOPENED',
  'DEFERRED',
  'OUT_OF_SCOPE',
  'INVALIDATED'
]);

const PRIORITY_WEIGHT = Object.freeze({ P0: 3, P1: 2, P2: 1 });

function decisionMap(decisions) {
  return new Map((decisions || []).map(decision => [decision.id, decision]));
}

function isFrontierCandidate(decision, decisions) {
  if (!decision || !['OPEN', 'REOPENED'].includes(decision.status)) return false;
  if ((decision.blockedByFacts || []).length > 0) return false;
  if (decision.resolverState === 'IN_PROGRESS') return false;
  if (decision.alreadyAnswered === true) return false;
  if (decision.blocksDownstream === false) return false;

  const byId = decisionMap(decisions);
  return (decision.prerequisites || []).every(id => byId.get(id)?.status === 'RESOLVED');
}

function computeFrontier(decisions) {
  return (decisions || [])
    .filter(decision => isFrontierCandidate(decision, decisions))
    .sort((left, right) => {
      const priority = (PRIORITY_WEIGHT[right.priority] || 0) - (PRIORITY_WEIGHT[left.priority] || 0);
      if (priority !== 0) return priority;

      const downstream = (right.downstream || []).length - (left.downstream || []).length;
      if (downstream !== 0) return downstream;

      const irreversible = Number(Boolean(right.irreversible)) - Number(Boolean(left.irreversible));
      if (irreversible !== 0) return irreversible;

      return String(left.id).localeCompare(String(right.id));
    });
}

function reopenDecision(decisions, decisionId, reason, timestamp = new Date().toISOString()) {
  const cloned = structuredClone(decisions || []);
  const root = cloned.find(decision => decision.id === decisionId);
  if (!root) throw new Error(`找不到 Decision：${decisionId}`);

  root.history = Array.isArray(root.history) ? root.history : [];
  root.history.push({
    status: root.status,
    resolution: root.resolution ?? null,
    rationale: root.rationale ?? null,
    resolvedAt: root.resolvedAt ?? null,
    reopenedAt: timestamp,
    reopenReason: reason
  });
  root.status = 'REOPENED';
  root.resolution = null;
  root.rationale = null;
  root.reopenedAt = timestamp;
  root.reopenReason = reason;

  const affected = new Set(root.downstream || []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const decision of cloned) {
      if (affected.has(decision.id)) {
        for (const downstreamId of decision.downstream || []) {
          if (!affected.has(downstreamId)) {
            affected.add(downstreamId);
            changed = true;
          }
        }
      }
    }
  }

  for (const decision of cloned) {
    if (!affected.has(decision.id)) continue;
    if (['RESOLVED', 'DEFERRED', 'INVALIDATED'].includes(decision.status)) {
      decision.status = 'OPEN';
    }
  }

  return cloned;
}

module.exports = {
  DECISION_STATUSES,
  isFrontierCandidate,
  computeFrontier,
  reopenDecision
};
