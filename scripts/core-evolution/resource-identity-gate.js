'use strict';

const crypto = require('node:crypto');

const READ_ACTIONS = new Set(['discover', 'list', 'read']);
const EXECUTION_ACTIONS = new Set(['clone', 'install', 'import', 'execute']);

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function slugify(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw createError('RESOURCE_IDENTITY_INVALID', `${fieldName} 不可為空`);
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalized) {
    throw createError('RESOURCE_IDENTITY_INVALID', `${fieldName} 無法正規化`);
  }
  return normalized;
}

function normalizeUri(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw createError('RESOURCE_IDENTITY_INVALID', 'canonicalUri 不可為空');
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw createError('RESOURCE_IDENTITY_INVALID', 'canonicalUri 格式不合法');
  }

  if (!['https:', 'http:'].includes(url.protocol)) {
    throw createError('RESOURCE_IDENTITY_INVALID', 'canonicalUri 僅允許 HTTP 或 HTTPS');
  }

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';
  const normalized = url.toString().replace(/\/$/, '');
  return normalized;
}

function normalizeResourceIdentity(input) {
  if (!input || typeof input !== 'object') {
    throw createError('RESOURCE_IDENTITY_INVALID', '資源身分輸入必須是物件');
  }

  const namespace = slugify(input.namespace, 'namespace');
  const name = slugify(input.name, 'name');
  const publisherId = slugify(input.publisherId, 'publisherId');
  const version = typeof input.version === 'string' ? input.version.trim() : '';
  const resourceType = slugify(input.resourceType, 'resourceType');

  if (!version) {
    throw createError('RESOURCE_IDENTITY_INVALID', 'version 不可為空');
  }

  const digest = input.digest
    ? { algorithm: 'sha256', value: String(input.digest).toLowerCase() }
    : null;

  if (digest && !/^[a-f0-9]{64}$/.test(digest.value)) {
    throw createError('RESOURCE_IDENTITY_INVALID', 'SHA-256 Digest 格式不合法');
  }

  return Object.freeze({
    resourceId: `${namespace}.${name}`,
    resourceType,
    namespace,
    name,
    publisher: Object.freeze({ id: publisherId }),
    source: Object.freeze({ canonicalUri: normalizeUri(input.canonicalUri) }),
    version,
    integrity: digest ? Object.freeze(digest) : null,
  });
}

function verifyResourceIdentity(identity, evidence = {}) {
  const reasonCodes = [];

  if (!evidence.exists) {
    reasonCodes.push('RESOURCE_NOT_FOUND');
  }
  if (!evidence.publisherVerified) {
    reasonCodes.push('PUBLISHER_UNVERIFIED');
  }
  if (evidence.lookalikeDetected) {
    reasonCodes.push('LOOKALIKE_DETECTED');
  }

  if (identity.integrity && typeof evidence.content === 'string') {
    const actualDigest = crypto
      .createHash(identity.integrity.algorithm)
      .update(evidence.content)
      .digest('hex');
    if (actualDigest !== identity.integrity.value) {
      reasonCodes.push('INTEGRITY_MISMATCH');
    }
  } else if (identity.integrity && typeof evidence.content !== 'string') {
    reasonCodes.push('INTEGRITY_EVIDENCE_MISSING');
  }

  let trustLevel = 'UNVERIFIED';
  if (reasonCodes.includes('INTEGRITY_MISMATCH') || reasonCodes.includes('LOOKALIKE_DETECTED')) {
    trustLevel = 'BLOCKED';
  } else if (reasonCodes.includes('RESOURCE_NOT_FOUND')) {
    trustLevel = 'BLOCKED';
  } else if (reasonCodes.length === 0 && identity.integrity) {
    trustLevel = 'VERIFIED';
  } else if (evidence.exists && evidence.publisherVerified) {
    trustLevel = 'KNOWN';
  }

  return Object.freeze({
    identity,
    trustLevel,
    reasonCodes: Object.freeze([...reasonCodes]),
  });
}

function decideResourceAccess(verification, action) {
  const normalizedAction = String(action || '').trim().toLowerCase();

  if (verification.trustLevel === 'BLOCKED') {
    return Object.freeze({ allowed: false, code: 'RESOURCE_BLOCKED' });
  }

  if (READ_ACTIONS.has(normalizedAction)) {
    return Object.freeze({
      allowed: ['VERIFIED', 'KNOWN'].includes(verification.trustLevel),
      code: ['VERIFIED', 'KNOWN'].includes(verification.trustLevel)
        ? 'RESOURCE_ACCESS_ALLOWED'
        : 'RESOURCE_VERIFICATION_REQUIRED',
    });
  }

  if (EXECUTION_ACTIONS.has(normalizedAction)) {
    const allowed = verification.trustLevel === 'VERIFIED';
    return Object.freeze({
      allowed,
      code: allowed ? 'RESOURCE_ACCESS_ALLOWED' : 'RESOURCE_VERIFICATION_REQUIRED',
    });
  }

  return Object.freeze({ allowed: false, code: 'RESOURCE_ACTION_UNSUPPORTED' });
}

module.exports = {
  normalizeResourceIdentity,
  verifyResourceIdentity,
  decideResourceAccess,
};
