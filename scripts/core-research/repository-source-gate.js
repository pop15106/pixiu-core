'use strict';

const { isFullCommitSha } = require('./candidate-schema');
const { scoreCandidate, isBlockingReasonCode } = require('./candidate-scorer');

const CHECKOUT_DISPOSITIONS = new Set(['Extract', 'Integrate Proposed']);

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nestedValue of Object.values(value)) deepFreeze(nestedValue);
  return Object.freeze(value);
}

function parseGitHubRepository(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.protocol !== 'https:'
    || url.hostname !== 'github.com'
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    return null;
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 2) return null;
  const owner = segments[0];
  const repository = segments[1].replace(/\.git$/i, '');
  if (!owner || !repository || repository === '.' || repository === '..') return null;

  return Object.freeze({
    owner,
    repository,
    canonicalUri: `https://github.com/${owner}/${repository}`,
  });
}

function validateSelectionEntry(selectionEntry) {
  if (!selectionEntry || typeof selectionEntry !== 'object') {
    throw createError('SELECTION_ENTRY_INVALID', 'selection entry 必須是物件');
  }
  const candidate = selectionEntry.candidate;
  if (!candidate || candidate.schemaVersion !== 'pixiu.core-research/candidate-v1') {
    throw createError('CANDIDATE_SCHEMA_UNSUPPORTED', '候選必須先通過正規化');
  }

  const expectedScore = scoreCandidate(candidate);
  const providedScore = selectionEntry.score;
  if (
    !providedScore
    || providedScore.candidateId !== expectedScore.candidateId
    || providedScore.totalScore !== expectedScore.totalScore
    || providedScore.disposition !== expectedScore.disposition
  ) {
    throw createError('SELECTION_SCORE_MISMATCH', 'selection score 與候選重新計算結果不一致');
  }
  return { candidate, score: expectedScore };
}

function evaluateRepositoryCandidate(selectionEntry) {
  const { candidate, score } = validateSelectionEntry(selectionEntry);
  const reasonCodes = [];

  if (candidate.resourceType !== 'repository') {
    return deepFreeze({
      decision: 'REFERENCE_ONLY',
      reasonCodes: ['REPOSITORY_REQUIRED'],
      candidateId: candidate.candidateId,
      source: null,
    });
  }

  const blockingCodes = candidate.riskFlags.filter(isBlockingReasonCode);
  if (blockingCodes.length > 0) {
    return deepFreeze({
      decision: 'REJECTED',
      reasonCodes: [...new Set(blockingCodes)],
      candidateId: candidate.candidateId,
      source: null,
    });
  }

  const source = parseGitHubRepository(candidate.canonicalUri);
  if (!source || source.canonicalUri !== candidate.canonicalUri.replace(/\.git$/i, '')) {
    reasonCodes.push('GITHUB_CANONICAL_REQUIRED');
  }
  if (!isFullCommitSha(candidate.commitSha)) reasonCodes.push('MISSING_COMMIT_SHA');
  if (candidate.license === 'UNKNOWN') reasonCodes.push('LICENSE_UNKNOWN');
  if (!CHECKOUT_DISPOSITIONS.has(score.disposition)) {
    reasonCodes.push('DISPOSITION_NOT_ELIGIBLE');
  }

  return deepFreeze({
    decision: reasonCodes.length === 0 ? 'CHECKOUT_ALLOWED' : 'REFERENCE_ONLY',
    reasonCodes: [...new Set(reasonCodes)],
    candidateId: candidate.candidateId,
    source: source ? {
      ...source,
      commitSha: candidate.commitSha,
      license: candidate.license,
      publisher: candidate.publisher,
    } : null,
  });
}

module.exports = {
  parseGitHubRepository,
  evaluateRepositoryCandidate,
};
