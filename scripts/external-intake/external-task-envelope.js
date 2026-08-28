'use strict';

const {
  assertExactKeys,
  deepFreeze,
  normalizeInstant,
  normalizeStringSet,
  requireString,
  sha256Digest,
  withoutKeys,
} = require('./contract-utils');
const {
  verifyCapabilityGrant,
  verifyCapabilityGrantAudit,
} = require('./capability-grant');

const ENVELOPE_SCHEMA_VERSION = 'pixiu.external-task-envelope/v1';
const CREATE_KEYS = [
  'source',
  'externalEventId',
  'principalRef',
  'projectId',
  'repositoryId',
  'intent',
  'requestedCapabilities',
  'contentHash',
  'observedAt',
  'expiresAt',
  'capabilityGrantRef',
  'auditRef',
];
const ENVELOPE_KEYS = ['schemaVersion', ...CREATE_KEYS, 'envelopeDigest'];
const GRANT_REF_KEYS = ['grantId', 'version', 'digest'];
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function normalizeCapabilityGrantRef(value) {
  assertExactKeys(value, GRANT_REF_KEYS, 'EXTERNAL_TASK_GRANT_REF_INVALID');
  if (!Number.isSafeInteger(value.version) || value.version < 1) {
    const error = new TypeError('EXTERNAL_TASK_GRANT_REF_INVALID');
    error.code = 'EXTERNAL_TASK_GRANT_REF_INVALID';
    throw error;
  }
  const digest = requireString(value.digest, 'EXTERNAL_TASK_GRANT_DIGEST', { maxLength: 80 }).toLowerCase();
  if (!HASH_PATTERN.test(digest)) {
    const error = new TypeError('EXTERNAL_TASK_GRANT_REF_INVALID');
    error.code = 'EXTERNAL_TASK_GRANT_REF_INVALID';
    throw error;
  }
  return {
    grantId: requireString(value.grantId, 'EXTERNAL_TASK_GRANT_ID'),
    version: value.version,
    digest,
  };
}

function normalizeEnvelopePayload(input) {
  const observedAt = normalizeInstant(input.observedAt, 'EXTERNAL_TASK_OBSERVED_AT');
  const expiresAt = normalizeInstant(input.expiresAt, 'EXTERNAL_TASK_EXPIRES_AT');
  if (Date.parse(observedAt) >= Date.parse(expiresAt)) {
    const error = new RangeError('EXTERNAL_TASK_TIME_ORDER_INVALID');
    error.code = 'EXTERNAL_TASK_TIME_ORDER_INVALID';
    throw error;
  }
  const contentHash = requireString(input.contentHash, 'EXTERNAL_TASK_CONTENT_HASH', { maxLength: 80 }).toLowerCase();
  if (!HASH_PATTERN.test(contentHash)) {
    const error = new TypeError('EXTERNAL_TASK_CONTENT_HASH_INVALID');
    error.code = 'EXTERNAL_TASK_CONTENT_HASH_INVALID';
    throw error;
  }

  return {
    schemaVersion: ENVELOPE_SCHEMA_VERSION,
    source: requireString(input.source, 'EXTERNAL_TASK_SOURCE').toLowerCase(),
    externalEventId: requireString(input.externalEventId, 'EXTERNAL_TASK_EVENT_ID'),
    principalRef: requireString(input.principalRef, 'EXTERNAL_TASK_PRINCIPAL'),
    projectId: requireString(input.projectId, 'EXTERNAL_TASK_PROJECT'),
    repositoryId: requireString(input.repositoryId, 'EXTERNAL_TASK_REPOSITORY'),
    intent: requireString(input.intent, 'EXTERNAL_TASK_INTENT').toLowerCase(),
    requestedCapabilities: normalizeStringSet(
      input.requestedCapabilities,
      'EXTERNAL_TASK_REQUESTED_CAPABILITIES',
    ),
    contentHash,
    observedAt,
    expiresAt,
    capabilityGrantRef: normalizeCapabilityGrantRef(input.capabilityGrantRef),
    auditRef: requireString(input.auditRef, 'EXTERNAL_TASK_AUDIT_REF'),
  };
}

function createExternalTaskEnvelope(input = {}) {
  try {
    assertExactKeys(input, CREATE_KEYS, 'EXTERNAL_TASK_ENVELOPE_FORBIDDEN_FIELD');
  } catch (error) {
    if (error && error.code === 'EXTERNAL_TASK_ENVELOPE_FORBIDDEN_FIELD') throw error;
    throw error;
  }
  const payload = normalizeEnvelopePayload(input);
  return deepFreeze({ ...payload, envelopeDigest: sha256Digest(payload) });
}

function validateExternalTaskEnvelope(envelope, options = {}) {
  const errors = [];
  try {
    assertExactKeys(envelope, ENVELOPE_KEYS, 'EXTERNAL_TASK_ENVELOPE_UNKNOWN_FIELD');
    if (envelope.schemaVersion !== ENVELOPE_SCHEMA_VERSION) {
      errors.push('EXTERNAL_TASK_ENVELOPE_SCHEMA_UNSUPPORTED');
    }

    const normalized = normalizeEnvelopePayload(envelope);
    if (sha256Digest(normalized) !== envelope.envelopeDigest) {
      errors.push('EXTERNAL_TASK_ENVELOPE_DIGEST_MISMATCH');
    }

    const now = normalizeInstant(options.now || new Date().toISOString(), 'EXTERNAL_TASK_NOW');
    if (Date.parse(now) >= Date.parse(normalized.expiresAt)) {
      errors.push('EXTERNAL_TASK_ENVELOPE_EXPIRED');
    }

    const { grant, audit } = options;
    if (!grant) {
      errors.push('EXTERNAL_TASK_GRANT_REQUIRED');
    } else {
      const grantCheck = verifyCapabilityGrant(grant, {
        now,
        expectedPrincipalRef: normalized.principalRef,
        requestedCapabilities: normalized.requestedCapabilities,
      });
      errors.push(...grantCheck.errors.filter((code) => {
        if (code === 'CAPABILITY_GRANT_PRINCIPAL_MISMATCH') {
          errors.push('EXTERNAL_TASK_PRINCIPAL_MISMATCH');
          return false;
        }
        return true;
      }));

      if (
        grant.scope?.source !== normalized.source
        || grant.scope?.projectId !== normalized.projectId
        || grant.scope?.repositoryId !== normalized.repositoryId
        || !Array.isArray(grant.scope?.intents)
        || !grant.scope.intents.includes(normalized.intent)
      ) {
        errors.push('EXTERNAL_TASK_SCOPE_MISMATCH');
      }

      if (
        normalized.capabilityGrantRef.grantId !== grant.grantId
        || normalized.capabilityGrantRef.version !== grant.version
        || normalized.capabilityGrantRef.digest !== grant.digest
      ) {
        errors.push('EXTERNAL_TASK_GRANT_REF_MISMATCH');
      }

      const observedGrantCheck = verifyCapabilityGrant(grant, {
        now: normalized.observedAt,
        expectedPrincipalRef: normalized.principalRef,
        requestedCapabilities: normalized.requestedCapabilities,
      });
      if (observedGrantCheck.errors.includes('CAPABILITY_GRANT_NOT_YET_VALID')) {
        errors.push('EXTERNAL_TASK_GRANT_NOT_VALID_AT_OBSERVED_TIME');
      }
      if (observedGrantCheck.errors.includes('CAPABILITY_GRANT_EXPIRED')) {
        errors.push('EXTERNAL_TASK_GRANT_EXPIRED_AT_OBSERVED_TIME');
      }

      if (Date.parse(normalized.expiresAt) > Date.parse(grant.expiresAt)) {
        errors.push('EXTERNAL_TASK_EXPIRES_AFTER_GRANT');
      }
    }

    if (!audit) {
      errors.push('EXTERNAL_TASK_AUDIT_REQUIRED');
    } else if (grant) {
      const auditCheck = verifyCapabilityGrantAudit(grant, audit);
      if (!auditCheck.valid) errors.push('EXTERNAL_TASK_GRANT_AUDIT_INVALID');
      if (normalized.auditRef !== audit.eventId) errors.push('EXTERNAL_TASK_AUDIT_REF_MISMATCH');
      if (Date.parse(audit.occurredAt) > Date.parse(normalized.observedAt)) {
        errors.push('EXTERNAL_TASK_AUDIT_AFTER_OBSERVED_TIME');
      }
    }
  } catch (error) {
    errors.push(error && error.code ? error.code : 'EXTERNAL_TASK_ENVELOPE_INVALID');
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}

module.exports = {
  ENVELOPE_SCHEMA_VERSION,
  createExternalTaskEnvelope,
  validateExternalTaskEnvelope,
};
