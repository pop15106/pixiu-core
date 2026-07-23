'use strict';

const { buildIdentitySeed } = require('./candidate-schema');

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function buildCanonicalKey(candidate) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw createError('CANDIDATE_INVALID', '候選必須是已正規化物件');
  }
  if (candidate.schemaVersion !== 'pixiu.core-research/candidate-v1') {
    throw createError('CANDIDATE_SCHEMA_UNSUPPORTED', '不支援的候選 Schema');
  }
  return buildIdentitySeed(candidate);
}

module.exports = {
  buildCanonicalKey,
};
