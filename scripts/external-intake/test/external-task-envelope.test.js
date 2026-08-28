'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createCapabilityGrant,
  createCapabilityGrantAudit,
} = require('../capability-grant');
const {
  createExternalTaskEnvelope,
  validateExternalTaskEnvelope,
} = require('../external-task-envelope');

const NOW = '2026-08-28T10:00:00.000Z';

function createGrantAndAudit() {
  const grant = createCapabilityGrant({
    grantId: 'grant-cak-e-001',
    version: 3,
    principalRef: 'principal:github-app:review-bot',
    scope: {
      source: 'github',
      projectId: 'ai-knowledge-workflow',
      repositoryId: 'umbrella',
      intents: ['review'],
    },
    capabilities: ['workspace.read', 'runtime.read'],
    issuerRef: 'policy:pixiu:l0',
    policyRef: 'policy:external-intake:v1',
    issuedAt: '2026-08-28T09:00:00.000Z',
    notBefore: '2026-08-28T09:00:00.000Z',
    expiresAt: '2026-08-28T11:00:00.000Z',
  });
  const audit = createCapabilityGrantAudit(grant, {
    eventId: 'audit-grant-cak-e-001',
    occurredAt: '2026-08-28T09:00:01.000Z',
  });
  return { grant, audit };
}

function createValidEnvelope() {
  const { grant, audit } = createGrantAndAudit();
  const envelope = createExternalTaskEnvelope({
    source: 'github',
    externalEventId: 'evt-123',
    principalRef: grant.principalRef,
    projectId: 'ai-knowledge-workflow',
    repositoryId: 'umbrella',
    intent: 'review',
    requestedCapabilities: ['workspace.read'],
    contentHash: `sha256:${'a'.repeat(64)}`,
    observedAt: '2026-08-28T09:30:00.000Z',
    expiresAt: '2026-08-28T10:30:00.000Z',
    capabilityGrantRef: {
      grantId: grant.grantId,
      version: grant.version,
      digest: grant.digest,
    },
    auditRef: audit.eventId,
  });
  return { envelope, grant, audit };
}

test('External Task Envelope 綁 principal、capability grant 與 audit 後通過', () => {
  const { envelope, grant, audit } = createValidEnvelope();

  assert.equal(Object.isFrozen(envelope), true);
  assert.equal(envelope.schemaVersion, 'pixiu.external-task-envelope/v1');
  assert.match(envelope.envelopeDigest, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(
    validateExternalTaskEnvelope(envelope, { grant, audit, now: NOW }),
    { valid: true, errors: [] },
  );
});

test('principal identity、scope、grant ref 或 audit ref mismatch 必須 fail closed', () => {
  const { envelope, grant, audit } = createValidEnvelope();

  const principalMismatch = { ...envelope, principalRef: 'principal:github-app:other' };
  assert.ok(
    validateExternalTaskEnvelope(principalMismatch, { grant, audit, now: NOW }).errors
      .includes('EXTERNAL_TASK_PRINCIPAL_MISMATCH'),
  );

  const scopeMismatch = { ...envelope, repositoryId: 'other-repo' };
  assert.ok(
    validateExternalTaskEnvelope(scopeMismatch, { grant, audit, now: NOW }).errors
      .includes('EXTERNAL_TASK_SCOPE_MISMATCH'),
  );

  const grantMismatch = {
    ...envelope,
    capabilityGrantRef: { ...envelope.capabilityGrantRef, version: envelope.capabilityGrantRef.version + 1 },
  };
  assert.ok(
    validateExternalTaskEnvelope(grantMismatch, { grant, audit, now: NOW }).errors
      .includes('EXTERNAL_TASK_GRANT_REF_MISMATCH'),
  );

  const auditMismatch = { ...envelope, auditRef: 'audit-other' };
  assert.ok(
    validateExternalTaskEnvelope(auditMismatch, { grant, audit, now: NOW }).errors
      .includes('EXTERNAL_TASK_AUDIT_REF_MISMATCH'),
  );
});

test('requested capability 超出 grant、envelope 過期或超過 grant expiry 時 fail closed', () => {
  const { envelope, grant, audit } = createValidEnvelope();

  const escalated = { ...envelope, requestedCapabilities: ['workspace.write'] };
  assert.ok(
    validateExternalTaskEnvelope(escalated, { grant, audit, now: NOW }).errors
      .includes('CAPABILITY_NOT_GRANTED'),
  );

  assert.ok(
    validateExternalTaskEnvelope(envelope, {
      grant,
      audit,
      now: '2026-08-28T10:31:00.000Z',
    }).errors.includes('EXTERNAL_TASK_ENVELOPE_EXPIRED'),
  );

  const beyondGrant = { ...envelope, expiresAt: '2026-08-28T11:30:00.000Z' };
  assert.ok(
    validateExternalTaskEnvelope(beyondGrant, { grant, audit, now: NOW }).errors
      .includes('EXTERNAL_TASK_EXPIRES_AFTER_GRANT'),
  );
});

test('raw command、local path、credential、approval 或 skipSandbox payload 一律拒絕', () => {
  const { grant, audit } = createGrantAndAudit();
  const base = {
    source: 'github',
    externalEventId: 'evt-forbidden',
    principalRef: grant.principalRef,
    projectId: 'ai-knowledge-workflow',
    repositoryId: 'umbrella',
    intent: 'review',
    requestedCapabilities: ['workspace.read'],
    contentHash: `sha256:${'b'.repeat(64)}`,
    observedAt: '2026-08-28T09:30:00.000Z',
    expiresAt: '2026-08-28T10:30:00.000Z',
    capabilityGrantRef: {
      grantId: grant.grantId,
      version: grant.version,
      digest: grant.digest,
    },
    auditRef: audit.eventId,
  };

  for (const forbidden of [
    { rawCommand: 'rm -rf /' },
    { localPath: 'C:\\secret' },
    { providerCredential: 'secret' },
    { approval: true },
    { skipSandbox: true },
  ]) {
    assert.throws(
      () => createExternalTaskEnvelope({ ...base, ...forbidden }),
      (error) => error && error.code === 'EXTERNAL_TASK_ENVELOPE_FORBIDDEN_FIELD',
    );
  }
});

test('未知欄位與 envelope digest tamper 皆 fail closed', () => {
  const { envelope, grant, audit } = createValidEnvelope();
  const unknown = { ...envelope, surprise: 'value' };
  const tampered = { ...envelope, intent: 'execute' };

  assert.ok(
    validateExternalTaskEnvelope(unknown, { grant, audit, now: NOW }).errors
      .includes('EXTERNAL_TASK_ENVELOPE_UNKNOWN_FIELD'),
  );
  assert.ok(
    validateExternalTaskEnvelope(tampered, { grant, audit, now: NOW }).errors
      .includes('EXTERNAL_TASK_ENVELOPE_DIGEST_MISMATCH'),
  );
});
