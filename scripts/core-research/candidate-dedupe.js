'use strict';

const { buildIdentitySeed } = require('./candidate-schema');

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw createError('CANDIDATE_INVALID', '候選必須是已正規化物件');
  }
  if (candidate.schemaVersion !== 'pixiu.core-research/candidate-v1') {
    throw createError('CANDIDATE_SCHEMA_UNSUPPORTED', '不支援的候選 Schema');
  }
}

function buildCanonicalKey(candidate) {
  validateCandidate(candidate);
  return buildIdentitySeed(candidate);
}

function buildResourceKey(candidate) {
  validateCandidate(candidate);
  if (candidate.resourceType === 'repository') {
    return `repository:${candidate.canonicalUri}`;
  }
  if (candidate.resourceType === 'paper') {
    if (candidate.doi) return `paper:doi:${candidate.doi.toLowerCase()}`;
    if (candidate.arxivId) return `paper:arxiv:${candidate.arxivId.toLowerCase()}`;
    return `paper:url:${candidate.canonicalUri}`;
  }
  return `article:${candidate.canonicalUri}`;
}

module.exports = {
  buildCanonicalKey,
  buildResourceKey,
};
