'use strict';

const DEFAULT_WEIGHTS = Object.freeze({
  coreFit: 0.25,
  expectedValue: 0.20,
  novelty: 0.15,
  maturity: 0.10,
  feasibility: 0.10,
  evidenceQuality: 0.10,
  trust: 0.10,
});

const DISPOSITION_RANK = Object.freeze({
  Reject: 0,
  Reference: 1,
  Extract: 2,
  'Integrate Proposed': 3,
});

const BLOCKING_RISK_FLAGS = new Set([
  'SOURCE_BLOCKED',
  'INTEGRITY_MISMATCH',
  'MALICIOUS_CONTENT',
]);

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function roundTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validateWeights(weights) {
  if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
    throw createError('SCORING_POLICY_INVALID', '評分權重必須是物件');
  }

  let total = 0;
  for (const [metricName, defaultWeight] of Object.entries(DEFAULT_WEIGHTS)) {
    const value = weights[metricName] ?? defaultWeight;
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw createError('SCORING_POLICY_INVALID', `${metricName} 權重格式不合法`);
    }
    total += value;
  }

  if (Math.abs(total - 1) > 0.000001) {
    throw createError('SCORING_POLICY_INVALID', '評分權重總和必須等於 1');
  }
}

function baseDisposition(totalScore) {
  if (totalScore < 50) return 'Reject';
  if (totalScore < 70) return 'Reference';
  if (totalScore < 85) return 'Extract';
  return 'Integrate Proposed';
}

function capDisposition(disposition, maximum) {
  return DISPOSITION_RANK[disposition] > DISPOSITION_RANK[maximum]
    ? maximum
    : disposition;
}

function isBlockingReasonCode(reasonCode) {
  return BLOCKING_RISK_FLAGS.has(reasonCode);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue);
  }
  return Object.freeze(value);
}

function scoreCandidate(candidate, policy = {}) {
  if (!candidate || candidate.schemaVersion !== 'pixiu.core-research/candidate-v1') {
    throw createError('CANDIDATE_SCHEMA_UNSUPPORTED', '候選必須先通過正規化');
  }

  const weights = {
    ...DEFAULT_WEIGHTS,
    ...(policy.weights || {}),
  };
  validateWeights(weights);

  const weightedMetrics = {};
  let totalScore = 0;
  for (const [metricName, weight] of Object.entries(weights)) {
    const weightedValue = roundTwo(candidate.metrics[metricName] * weight);
    weightedMetrics[metricName] = weightedValue;
    totalScore += weightedValue;
  }
  totalScore = roundTwo(totalScore);

  const reasonCodes = [];
  let disposition = baseDisposition(totalScore);

  const blockingFlags = candidate.riskFlags.filter((flag) => BLOCKING_RISK_FLAGS.has(flag));
  if (blockingFlags.length > 0) {
    reasonCodes.push(...blockingFlags);
    disposition = 'Reject';
  }

  if (candidate.license === 'UNKNOWN') {
    reasonCodes.push('LICENSE_UNKNOWN');
    disposition = capDisposition(disposition, 'Reference');
  }

  if (candidate.resourceType === 'repository' && !candidate.commitSha) {
    reasonCodes.push('MISSING_COMMIT_SHA');
    disposition = capDisposition(disposition, 'Extract');
  }

  return deepFreeze({
    candidateId: candidate.candidateId,
    totalScore,
    disposition,
    reasonCodes: [...new Set(reasonCodes)],
    weightedMetrics,
  });
}

module.exports = {
  DEFAULT_WEIGHTS,
  scoreCandidate,
  isBlockingReasonCode,
};
