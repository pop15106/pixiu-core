'use strict';

const {
  assertExactKeys,
  deepFreeze,
  normalizeInstant,
  normalizeStringSet,
  requirePositiveInteger,
  requireString,
  sameCanonicalValue,
  sha256Digest,
  withoutKeys,
} = require('./contract-utils');

const GRANT_SCHEMA_VERSION = 'pixiu.capability-grant/v1';
const AUDIT_SCHEMA_VERSION = 'pixiu.capability-grant-audit/v1';
const GRANT_KEYS = [
  'schemaVersion',
  'grantId',
  'version',
  'principalRef',
  'scope',
  'capabilities',
  'issuerRef',
  'policyRef',
  'issuedAt',
  'notBefore',
  'expiresAt',
  'digest',
];
const SCOPE_KEYS = ['source', 'projectId', 'repositoryId', 'intents'];
const AUDIT_KEYS = [
  'schemaVersion',
  'eventId',
  'eventType',
  'occurredAt',
  'grantId',
  'grantVersion',
  'grantDigest',
  'principalRef',
  'scope',
  'capabilities',
  'auditDigest',
];

function normalizeScope(scope) {
  assertExactKeys(scope, SCOPE_KEYS, 'CAPABILITY_GRANT_SCOPE_INVALID');
  return {
    source: requireString(scope.source, 'CAPABILITY_GRANT_SCOPE_SOURCE').toLowerCase(),
    projectId: requireString(scope.projectId, 'CAPABILITY_GRANT_SCOPE_PROJECT'),
    repositoryId: requireString(scope.repositoryId, 'CAPABILITY_GRANT_SCOPE_REPOSITORY'),
    intents: normalizeStringSet(scope.intents, 'CAPABILITY_GRANT_SCOPE_INTENTS'),
  };
}

function buildGrantPayload(input) {
  const issuedAt = normalizeInstant(input.issuedAt, 'CAPABILITY_GRANT_ISSUED_AT');
  const notBefore = normalizeInstant(input.notBefore, 'CAPABILITY_GRANT_NOT_BEFORE');
  const expiresAt = normalizeInstant(input.expiresAt, 'CAPABILITY_GRANT_EXPIRES_AT');
  if (Date.parse(issuedAt) > Date.parse(notBefore)) {
    const error = new RangeError('CAPABILITY_GRANT_TIME_ORDER_INVALID');
    error.code = 'CAPABILITY_GRANT_TIME_ORDER_INVALID';
    throw error;
  }
  if (Date.parse(notBefore) >= Date.parse(expiresAt)) {
    const error = new RangeError('CAPABILITY_GRANT_TIME_ORDER_INVALID');
    error.code = 'CAPABILITY_GRANT_TIME_ORDER_INVALID';
    throw error;
  }

  return {
    schemaVersion: GRANT_SCHEMA_VERSION,
    grantId: requireString(input.grantId, 'CAPABILITY_GRANT_ID'),
    version: requirePositiveInteger(input.version, 'CAPABILITY_GRANT_VERSION'),
    principalRef: requireString(input.principalRef, 'CAPABILITY_GRANT_PRINCIPAL'),
    scope: normalizeScope(input.scope),
    capabilities: normalizeStringSet(input.capabilities, 'CAPABILITY_GRANT_CAPABILITIES'),
    issuerRef: requireString(input.issuerRef, 'CAPABILITY_GRANT_ISSUER'),
    policyRef: requireString(input.policyRef, 'CAPABILITY_GRANT_POLICY'),
    issuedAt,
    notBefore,
    expiresAt,
  };
}

function createCapabilityGrant(input = {}) {
  assertExactKeys(
    input,
    GRANT_KEYS.filter((key) => !['schemaVersion', 'digest'].includes(key)),
    'CAPABILITY_GRANT_UNKNOWN_FIELD',
  );
  const payload = buildGrantPayload(input);
  return deepFreeze({ ...payload, digest: sha256Digest(payload) });
}

function verifyCapabilityGrant(grant, options = {}) {
  const errors = [];
  try {
    assertExactKeys(grant, GRANT_KEYS, 'CAPABILITY_GRANT_UNKNOWN_FIELD');
    if (grant.schemaVersion !== GRANT_SCHEMA_VERSION) errors.push('CAPABILITY_GRANT_SCHEMA_UNSUPPORTED');

    const normalized = buildGrantPayload(grant);
    if (sha256Digest(normalized) !== grant.digest) errors.push('CAPABILITY_GRANT_DIGEST_MISMATCH');

    const now = normalizeInstant(options.now || new Date().toISOString(), 'CAPABILITY_GRANT_NOW');
    if (Date.parse(now) < Date.parse(normalized.notBefore)) errors.push('CAPABILITY_GRANT_NOT_YET_VALID');
    if (Date.parse(now) >= Date.parse(normalized.expiresAt)) errors.push('CAPABILITY_GRANT_EXPIRED');

    if (
      options.expectedPrincipalRef !== undefined
      && normalized.principalRef !== requireString(options.expectedPrincipalRef, 'CAPABILITY_GRANT_EXPECTED_PRINCIPAL')
    ) {
      errors.push('CAPABILITY_GRANT_PRINCIPAL_MISMATCH');
    }

    if (options.expectedScope !== undefined) {
      const expectedScope = normalizeScope(options.expectedScope);
      if (!sameCanonicalValue(normalized.scope, expectedScope)) errors.push('CAPABILITY_GRANT_SCOPE_MISMATCH');
    }

    if (options.requestedCapabilities !== undefined) {
      const requested = normalizeStringSet(options.requestedCapabilities, 'CAPABILITY_GRANT_REQUESTED_CAPABILITIES');
      const allowed = new Set(normalized.capabilities);
      if (requested.some((capability) => !allowed.has(capability))) errors.push('CAPABILITY_NOT_GRANTED');
    }
  } catch (error) {
    errors.push(error && error.code ? error.code : 'CAPABILITY_GRANT_INVALID');
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}

function createCapabilityGrantAudit(grant, input = {}) {
  const grantCheck = verifyCapabilityGrant(grant, { now: grant.notBefore });
  const structuralErrors = grantCheck.errors.filter((code) => !['CAPABILITY_GRANT_NOT_YET_VALID'].includes(code));
  if (structuralErrors.length > 0) {
    const error = new TypeError('CAPABILITY_GRANT_INVALID');
    error.code = structuralErrors[0];
    throw error;
  }
  assertExactKeys(input, ['eventId', 'occurredAt'], 'CAPABILITY_GRANT_AUDIT_UNKNOWN_FIELD');
  const occurredAt = normalizeInstant(input.occurredAt, 'CAPABILITY_GRANT_AUDIT_OCCURRED_AT');
  if (Date.parse(occurredAt) < Date.parse(grant.issuedAt) || Date.parse(occurredAt) >= Date.parse(grant.expiresAt)) {
    const error = new RangeError('CAPABILITY_GRANT_AUDIT_TIME_INVALID');
    error.code = 'CAPABILITY_GRANT_AUDIT_TIME_INVALID';
    throw error;
  }
  const payload = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    eventId: requireString(input.eventId, 'CAPABILITY_GRANT_AUDIT_EVENT_ID'),
    eventType: 'CAPABILITY_GRANT_ISSUED',
    occurredAt,
    grantId: grant.grantId,
    grantVersion: grant.version,
    grantDigest: grant.digest,
    principalRef: grant.principalRef,
    scope: grant.scope,
    capabilities: grant.capabilities,
  };
  return deepFreeze({ ...payload, auditDigest: sha256Digest(payload) });
}

function verifyCapabilityGrantAudit(grant, audit) {
  const grantCheck = verifyCapabilityGrant(grant, {
    now: grant && typeof grant.notBefore === 'string' ? grant.notBefore : new Date().toISOString(),
  });
  if (!grantCheck.valid) {
    return { valid: false, errors: ['CAPABILITY_GRANT_AUDIT_GRANT_INVALID'] };
  }

  const errors = [];
  try {
    assertExactKeys(audit, AUDIT_KEYS, 'CAPABILITY_GRANT_AUDIT_UNKNOWN_FIELD');
    if (audit.schemaVersion !== AUDIT_SCHEMA_VERSION) errors.push('CAPABILITY_GRANT_AUDIT_SCHEMA_UNSUPPORTED');
    if (audit.eventType !== 'CAPABILITY_GRANT_ISSUED') errors.push('CAPABILITY_GRANT_AUDIT_TYPE_INVALID');
    requireString(audit.eventId, 'CAPABILITY_GRANT_AUDIT_EVENT_ID');
    const occurredAt = normalizeInstant(audit.occurredAt, 'CAPABILITY_GRANT_AUDIT_TIME');
    requirePositiveInteger(audit.grantVersion, 'CAPABILITY_GRANT_AUDIT_VERSION');
    if (Date.parse(occurredAt) < Date.parse(grant.issuedAt) || Date.parse(occurredAt) >= Date.parse(grant.expiresAt)) {
      errors.push('CAPABILITY_GRANT_AUDIT_TIME_INVALID');
    }
    if (audit.grantId !== grant.grantId) errors.push('CAPABILITY_GRANT_AUDIT_ID_MISMATCH');
    if (audit.grantVersion !== grant.version) errors.push('CAPABILITY_GRANT_AUDIT_VERSION_MISMATCH');
    if (audit.grantDigest !== grant.digest) errors.push('CAPABILITY_GRANT_AUDIT_DIGEST_MISMATCH');
    if (audit.principalRef !== grant.principalRef) errors.push('CAPABILITY_GRANT_AUDIT_PRINCIPAL_MISMATCH');
    if (!sameCanonicalValue(audit.scope, grant.scope)) errors.push('CAPABILITY_GRANT_AUDIT_SCOPE_MISMATCH');
    if (!sameCanonicalValue(audit.capabilities, grant.capabilities)) {
      errors.push('CAPABILITY_GRANT_AUDIT_CAPABILITIES_MISMATCH');
    }

    const payload = withoutKeys(audit, ['auditDigest']);
    if (sha256Digest(payload) !== audit.auditDigest) errors.push('CAPABILITY_GRANT_AUDIT_RECORD_TAMPERED');
  } catch (error) {
    errors.push(error && error.code ? error.code : 'CAPABILITY_GRANT_AUDIT_INVALID');
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}

module.exports = {
  AUDIT_SCHEMA_VERSION,
  GRANT_SCHEMA_VERSION,
  createCapabilityGrant,
  createCapabilityGrantAudit,
  normalizeScope,
  verifyCapabilityGrant,
  verifyCapabilityGrantAudit,
};
