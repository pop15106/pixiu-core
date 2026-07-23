'use strict';

const { buildCanonicalKey } = require('./candidate-dedupe');
const { scoreCandidate } = require('./candidate-scorer');

const DEFAULT_POLICY = Object.freeze({
  days: 7,
  minimumScore: 70,
  totalLimit: 5,
  perCategoryLimit: 2,
});

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requirePositiveNumber(value, fieldName, options = {}) {
  if (!Number.isFinite(value) || value <= 0 || (options.integer && !Number.isInteger(value))) {
    throw createError('SELECTION_POLICY_INVALID', `${fieldName} 必須是正數${options.integer ? '整數' : ''}`);
  }
  return value;
}

function normalizePolicy(policy = {}) {
  const nowTimestamp = policy.now === undefined ? Date.now() : Date.parse(policy.now);
  if (!Number.isFinite(nowTimestamp)) {
    throw createError('SELECTION_POLICY_INVALID', 'now 必須是有效日期');
  }

  const minimumScore = policy.minimumScore ?? DEFAULT_POLICY.minimumScore;
  if (!Number.isFinite(minimumScore) || minimumScore < 0 || minimumScore > 100) {
    throw createError('SELECTION_POLICY_INVALID', 'minimumScore 必須介於 0 到 100');
  }

  return Object.freeze({
    now: new Date(nowTimestamp).toISOString(),
    days: requirePositiveNumber(policy.days ?? DEFAULT_POLICY.days, 'days'),
    minimumScore,
    totalLimit: requirePositiveNumber(
      policy.totalLimit ?? DEFAULT_POLICY.totalLimit,
      'totalLimit',
      { integer: true },
    ),
    perCategoryLimit: requirePositiveNumber(
      policy.perCategoryLimit ?? DEFAULT_POLICY.perCategoryLimit,
      'perCategoryLimit',
      { integer: true },
    ),
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue);
  }
  return Object.freeze(value);
}

function candidateTimestamp(candidate) {
  return Date.parse(candidate.updatedAt || candidate.publishedAt);
}

function compareEntries(left, right) {
  if (right.score.totalScore !== left.score.totalScore) {
    return right.score.totalScore - left.score.totalScore;
  }
  if (right.candidate.metrics.evidenceQuality !== left.candidate.metrics.evidenceQuality) {
    return right.candidate.metrics.evidenceQuality - left.candidate.metrics.evidenceQuality;
  }
  if (right.candidate.metrics.coreFit !== left.candidate.metrics.coreFit) {
    return right.candidate.metrics.coreFit - left.candidate.metrics.coreFit;
  }
  const timestampDifference = candidateTimestamp(right.candidate) - candidateTimestamp(left.candidate);
  if (timestampDifference !== 0) return timestampDifference;
  return left.candidate.candidateId.localeCompare(right.candidate.candidateId);
}

function createRejectedEntry(entry, reasonCodes) {
  return {
    candidate: entry.candidate,
    score: entry.score,
    reasonCodes: [...new Set(reasonCodes)],
  };
}

function selectWeeklyCandidates(candidates, inputPolicy = {}) {
  if (!Array.isArray(candidates)) {
    throw createError('CANDIDATE_LIST_INVALID', 'candidates 必須是陣列');
  }

  const policy = normalizePolicy(inputPolicy);
  const nowTimestamp = Date.parse(policy.now);
  const earliestTimestamp = nowTimestamp - (policy.days * 24 * 60 * 60 * 1000);
  const scoredEntries = candidates.map((candidate) => {
    if (!candidate || candidate.schemaVersion !== 'pixiu.core-research/candidate-v1') {
      throw createError('CANDIDATE_SCHEMA_UNSUPPORTED', '候選必須先通過正規化');
    }
    return {
      candidate,
      canonicalKey: buildCanonicalKey(candidate),
      score: scoreCandidate(candidate),
    };
  }).sort(compareEntries);

  const seenCanonicalKeys = new Set();
  const eligible = [];
  const rejected = [];

  for (const entry of scoredEntries) {
    if (seenCanonicalKeys.has(entry.canonicalKey)) {
      rejected.push(createRejectedEntry(entry, ['DUPLICATE_RESOURCE']));
      continue;
    }
    seenCanonicalKeys.add(entry.canonicalKey);

    const discoveredTimestamp = Date.parse(entry.candidate.discoveredAt);
    if (discoveredTimestamp < earliestTimestamp || discoveredTimestamp > nowTimestamp) {
      rejected.push(createRejectedEntry(entry, ['OUTSIDE_TIME_WINDOW']));
      continue;
    }

    if (entry.score.reasonCodes.includes('SOURCE_BLOCKED')) {
      rejected.push(createRejectedEntry(entry, ['SOURCE_BLOCKED']));
      continue;
    }

    if (entry.score.totalScore < policy.minimumScore) {
      rejected.push(createRejectedEntry(entry, ['SCORE_BELOW_THRESHOLD']));
      continue;
    }

    eligible.push(entry);
  }

  const selected = [];
  const categoryCounts = new Map();
  for (const entry of eligible) {
    const primaryCategory = entry.candidate.categories[0];
    const currentCategoryCount = categoryCounts.get(primaryCategory) || 0;

    if (currentCategoryCount >= policy.perCategoryLimit) {
      rejected.push(createRejectedEntry(entry, ['CATEGORY_QUOTA_REACHED']));
      continue;
    }
    if (selected.length >= policy.totalLimit) {
      rejected.push(createRejectedEntry(entry, ['TOTAL_LIMIT_REACHED']));
      continue;
    }

    selected.push({
      candidate: entry.candidate,
      score: entry.score,
    });
    categoryCounts.set(primaryCategory, currentCategoryCount + 1);
  }

  const byCategory = Object.fromEntries([...categoryCounts.entries()].sort(([left], [right]) => (
    left.localeCompare(right)
  )));

  return deepFreeze({
    policy,
    selected,
    rejected,
    statistics: {
      considered: candidates.length,
      selected: selected.length,
      rejected: rejected.length,
      byCategory,
    },
  });
}

module.exports = {
  DEFAULT_POLICY,
  selectWeeklyCandidates,
};
