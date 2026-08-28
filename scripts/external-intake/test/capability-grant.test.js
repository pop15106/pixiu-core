'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createCapabilityGrant,
  verifyCapabilityGrant,
  createCapabilityGrantAudit,
  verifyCapabilityGrantAudit,
} = require('../capability-grant');

const NOW = '2026-08-28T10:00:00.000Z';

function createValidGrant() {
  return createCapabilityGrant({
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
}

test('Capability Grant 建立後為 immutable 且 exact digest 可驗', () => {
  const grant = createValidGrant();

  assert.equal(Object.isFrozen(grant), true);
  assert.equal(Object.isFrozen(grant.scope), true);
  assert.equal(Object.isFrozen(grant.capabilities), true);
  assert.match(grant.digest, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(
    verifyCapabilityGrant(grant, {
      now: NOW,
      expectedPrincipalRef: grant.principalRef,
      expectedScope: grant.scope,
      requestedCapabilities: ['workspace.read'],
    }),
    { valid: true, errors: [] },
  );
});

test('Grant 時間欄位只接受含 timezone 的 canonical date-time', () => {
  assert.throws(
    () => createCapabilityGrant({
      grantId: 'grant-noncanonical-time',
      version: 1,
      principalRef: 'principal:test',
      scope: {
        source: 'github',
        projectId: 'ai-knowledge-workflow',
        repositoryId: 'umbrella',
        intents: ['review'],
      },
      capabilities: ['workspace.read'],
      issuerRef: 'policy:pixiu:l0',
      policyRef: 'policy:external-intake:v1',
      issuedAt: '08/28/2026 09:00',
      notBefore: '2026-08-28T09:00:00Z',
      expiresAt: '2026-08-28T11:00:00Z',
    }),
    (error) => error && error.code === 'CAPABILITY_GRANT_ISSUED_AT_INVALID',
  );
});

test('Grant tamper、過期與尚未生效皆 fail closed', () => {
  const grant = createValidGrant();
  const tampered = JSON.parse(JSON.stringify(grant));
  tampered.capabilities.push('workspace.write');

  assert.ok(
    verifyCapabilityGrant(tampered, { now: NOW }).errors.includes('CAPABILITY_GRANT_DIGEST_MISMATCH'),
  );
  assert.ok(
    verifyCapabilityGrant(grant, { now: '2026-08-28T12:00:00.000Z' }).errors.includes('CAPABILITY_GRANT_EXPIRED'),
  );
  assert.ok(
    verifyCapabilityGrant(grant, { now: '2026-08-28T08:30:00.000Z' }).errors.includes('CAPABILITY_GRANT_NOT_YET_VALID'),
  );
});

test('principal、scope 或 requested capability 超出 grant 時 fail closed', () => {
  const grant = createValidGrant();

  assert.ok(
    verifyCapabilityGrant(grant, {
      now: NOW,
      expectedPrincipalRef: 'principal:github-app:other',
    }).errors.includes('CAPABILITY_GRANT_PRINCIPAL_MISMATCH'),
  );
  assert.ok(
    verifyCapabilityGrant(grant, {
      now: NOW,
      expectedScope: { ...grant.scope, repositoryId: 'other-repo' },
    }).errors.includes('CAPABILITY_GRANT_SCOPE_MISMATCH'),
  );
  assert.ok(
    verifyCapabilityGrant(grant, {
      now: NOW,
      requestedCapabilities: ['workspace.write'],
    }).errors.includes('CAPABILITY_NOT_GRANTED'),
  );
});

test('Capability Grant audit verifier 必須先獨立驗 grant digest，不能接受 supplied grant 被竄改', () => {
  const grant = createValidGrant();
  const audit = createCapabilityGrantAudit(grant, {
    eventId: 'audit-grant-cak-e-tamper',
    occurredAt: '2026-08-28T09:00:01.000Z',
  });
  const tamperedGrant = JSON.parse(JSON.stringify(grant));
  tamperedGrant.issuerRef = 'policy:attacker';

  const result = verifyCapabilityGrantAudit(tamperedGrant, audit);

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('CAPABILITY_GRANT_AUDIT_GRANT_INVALID'));
});

test('Capability Grant audit 必須綁 exact grant identity/version/digest/principal/scope/capabilities', () => {
  const grant = createValidGrant();
  const audit = createCapabilityGrantAudit(grant, {
    eventId: 'audit-grant-cak-e-001',
    occurredAt: '2026-08-28T09:00:01.000Z',
  });

  assert.equal(Object.isFrozen(audit), true);
  assert.deepEqual(verifyCapabilityGrantAudit(grant, audit), { valid: true, errors: [] });

  const mismatched = JSON.parse(JSON.stringify(audit));
  mismatched.grantVersion += 1;
  assert.ok(
    verifyCapabilityGrantAudit(grant, mismatched).errors.includes('CAPABILITY_GRANT_AUDIT_VERSION_MISMATCH'),
  );

  const invalidTime = JSON.parse(JSON.stringify(audit));
  invalidTime.occurredAt = 'not-a-time';
  assert.ok(
    verifyCapabilityGrantAudit(grant, invalidTime).errors.includes('CAPABILITY_GRANT_AUDIT_TIME_INVALID'),
  );
});
