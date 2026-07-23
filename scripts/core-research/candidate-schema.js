'use strict';

const crypto = require('node:crypto');

const RESOURCE_TYPES = new Set(['repository', 'paper', 'article']);
const METRIC_NAMES = Object.freeze([
  'coreFit',
  'expectedValue',
  'novelty',
  'maturity',
  'feasibility',
  'evidenceQuality',
  'trust',
]);

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireText(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw createError('CANDIDATE_FIELD_REQUIRED', `${fieldName} 不可為空`);
  }
  return value.trim();
}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeUri(value, fieldName = 'canonicalUri') {
  const source = requireText(value, fieldName);
  let url;
  try {
    url = new URL(source);
  } catch {
    throw createError('CANDIDATE_URI_INVALID', `${fieldName} 格式不合法`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw createError('CANDIDATE_URI_INVALID', `${fieldName} 僅允許 HTTP 或 HTTPS`);
  }
  if (url.username || url.password) {
    throw createError(
      'CANDIDATE_URI_CREDENTIALS_FORBIDDEN',
      `${fieldName} 不可包含帳號或密碼`,
    );
  }

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function normalizeDate(value, fieldName, options = {}) {
  if ((value === undefined || value === null || value === '') && options.optional) {
    return null;
  }

  const source = requireText(value, fieldName);
  const timestamp = Date.parse(source);
  if (!Number.isFinite(timestamp)) {
    throw createError('CANDIDATE_DATE_INVALID', `${fieldName} 不是有效日期`);
  }
  return new Date(timestamp).toISOString();
}

function normalizeStringList(value, fieldName, errorCode, options = {}) {
  if (!Array.isArray(value)) {
    throw createError(errorCode, `${fieldName} 必須是陣列`);
  }

  const normalized = [...new Set(value.map((item) => {
    if (typeof item !== 'string' || item.trim() === '') {
      throw createError(errorCode, `${fieldName} 不可包含空值`);
    }
    return item.trim();
  }))];

  if (!options.allowEmpty && normalized.length === 0) {
    throw createError(errorCode, `${fieldName} 至少需要一項`);
  }
  return normalized;
}

function normalizeEvidence(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw createError('CANDIDATE_EVIDENCE_INVALID', 'evidence 至少需要一項');
  }

  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw createError('CANDIDATE_EVIDENCE_INVALID', `evidence[${index}] 必須是物件`);
    }
    return {
      source: normalizeUri(item.source, `evidence[${index}].source`),
      note: requireText(item.note, `evidence[${index}].note`),
    };
  });
}

function normalizeMetrics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createError('CANDIDATE_METRICS_INVALID', 'metrics 必須是物件');
  }

  const normalized = {};
  for (const metricName of METRIC_NAMES) {
    const metricValue = value[metricName];
    if (!Number.isFinite(metricValue) || metricValue < 0 || metricValue > 100) {
      throw createError(
        'CANDIDATE_METRICS_INVALID',
        `${metricName} 必須是 0 到 100 的數字`,
      );
    }
    normalized[metricName] = metricValue;
  }
  return normalized;
}

function isFullCommitSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value.trim());
}

function buildIdentitySeed(candidate) {
  if (candidate.resourceType === 'repository') {
    return `repository:${candidate.canonicalUri}@${candidate.commitSha || 'unpinned'}`;
  }
  if (candidate.resourceType === 'paper') {
    if (candidate.doi) return `paper:doi:${candidate.doi.toLowerCase()}`;
    if (candidate.arxivId) {
      return `paper:arxiv:${candidate.arxivId.toLowerCase()}@${candidate.arxivVersion || 'unversioned'}`;
    }
    return `paper:url:${candidate.canonicalUri}`;
  }
  return `article:${candidate.canonicalUri}@${candidate.publishedAt.slice(0, 10)}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue);
  }
  return Object.freeze(value);
}

function normalizeCandidate(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw createError('CANDIDATE_INPUT_INVALID', '候選輸入必須是物件');
  }

  const resourceType = requireText(input.resourceType, 'resourceType').toLowerCase();
  if (!RESOURCE_TYPES.has(resourceType)) {
    throw createError('CANDIDATE_RESOURCE_TYPE_INVALID', `不支援的資源類型：${resourceType}`);
  }

  const commitSha = normalizeOptionalText(input.commitSha);
  if (resourceType === 'repository' && commitSha && !isFullCommitSha(commitSha)) {
    throw createError('CANDIDATE_COMMIT_INVALID', 'Repo Commit SHA 必須是完整 40 字元十六進位');
  }

  const normalized = {
    schemaVersion: 'pixiu.core-research/candidate-v1',
    candidateId: null,
    profile: normalizeOptionalText(input.profile) || 'core-resource',
    resourceType,
    title: requireText(input.title, 'title'),
    canonicalUri: normalizeUri(input.canonicalUri),
    publisher: requireText(input.publisher, 'publisher'),
    publishedAt: normalizeDate(input.publishedAt, 'publishedAt'),
    updatedAt: normalizeDate(input.updatedAt, 'updatedAt', { optional: true }),
    discoveredAt: normalizeDate(input.discoveredAt, 'discoveredAt'),
    commitSha: resourceType === 'repository' && commitSha ? commitSha.toLowerCase() : null,
    doi: normalizeOptionalText(input.doi),
    arxivId: normalizeOptionalText(input.arxivId),
    arxivVersion: normalizeOptionalText(input.arxivVersion),
    license: normalizeOptionalText(input.license) || 'UNKNOWN',
    categories: normalizeStringList(
      input.categories,
      'categories',
      'CANDIDATE_CATEGORIES_INVALID',
    ),
    summary: requireText(input.summary, 'summary'),
    evidence: normalizeEvidence(input.evidence),
    metrics: normalizeMetrics(input.metrics),
    riskFlags: normalizeStringList(
      input.riskFlags || [],
      'riskFlags',
      'CANDIDATE_RISK_FLAGS_INVALID',
      { allowEmpty: true },
    ),
  };

  const digest = crypto.createHash('sha256').update(buildIdentitySeed(normalized)).digest('hex');
  normalized.candidateId = `candidate-${digest.slice(0, 16)}`;
  return deepFreeze(normalized);
}

module.exports = {
  METRIC_NAMES,
  normalizeCandidate,
  isFullCommitSha,
  normalizeUri,
  buildIdentitySeed,
};
