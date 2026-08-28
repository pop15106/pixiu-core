'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  loadExternalIntakeClosure,
  validateExternalIntakeClosure,
} = require('../closure');

const repositoryRoot = path.resolve(__dirname, '../../..');
const closurePath = path.join(
  repositoryRoot,
  'docs',
  'architecture',
  'pixiucore-external-intake-safety.v1.json',
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('External Intake closure 同時證明 Envelope 與 Capability Grant/Audit PASS', () => {
  const closure = loadExternalIntakeClosure(closurePath);
  const result = validateExternalIntakeClosure(closure, { repositoryRoot });

  assert.deepEqual(result, { valid: true, errors: [] });
  assert.equal(closure.schemaVersion, 'pixiu.external-intake-safety/v1');
  assert.equal(closure.status, 'passed');
  assert.equal(closure.externalTaskEnvelope.status, 'passed');
  assert.equal(closure.capabilityGrantAndAudit.status, 'passed');
});

test('缺少禁止欄位宣告不得算 External Task Envelope closure', () => {
  const closure = loadExternalIntakeClosure(closurePath);
  const tampered = clone(closure);
  tampered.externalTaskEnvelope.forbiddenFields = ['rawCommand'];

  const result = validateExternalIntakeClosure(tampered, { repositoryRoot });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('EXTERNAL_INTAKE_FORBIDDEN_FIELDS_INCOMPLETE'));
});

test('External Intake closure path 即使存在但指錯元件也 fail closed', () => {
  const closure = loadExternalIntakeClosure(closurePath);
  const tampered = clone(closure);
  tampered.externalTaskEnvelope.implementation = 'scripts/external-intake/capability-grant.js';

  const result = validateExternalIntakeClosure(tampered, { repositoryRoot });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('EXTERNAL_TASK_ENVELOPE_IMPLEMENTATION_MISMATCH'));
});

test('CAK-E safety evidence bundle 綁定 closure、驗證與 NOT_INDEPENDENT review', () => {
  const evidencePath = path.join(
    repositoryRoot,
    'docs',
    'architecture',
    'pixiucore-cak-e-safety-prerequisite-evidence.v1.json',
  );
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));

  assert.equal(evidence.schemaVersion, 'pixiu.cak-e-safety-prerequisite-evidence/v1');
  assert.equal(evidence.status, 'passed');
  assert.equal(evidence.verification.coreEvolution, '21/21 PASS');
  assert.equal(evidence.verification.externalIntake, '17/17 PASS');
  assert.equal(evidence.verification.workflowLabAffected, '52/52 PASS');
  assert.deepEqual(evidence.review, {
    mode: 'same_session_read_only',
    independence: 'NOT_INDEPENDENT',
    p0: 0,
    p1: 0,
    p2: 0,
    p3: 0,
  });
  assert.equal(evidence.activeUserDataUsed, false);
  assert.equal(evidence.externalSessionWorkflowModified, false);
  assert.equal(evidence.agentOrModelUsed, false);
  assert.equal(
    validateExternalIntakeClosure(loadExternalIntakeClosure(path.join(repositoryRoot, evidence.externalIntakeClosure)), {
      repositoryRoot,
    }).valid,
    true,
  );
});

test('Capability Grant/Audit 非 passed 或 evidence path 缺失時 fail closed', () => {
  const closure = loadExternalIntakeClosure(closurePath);
  const pending = clone(closure);
  pending.capabilityGrantAndAudit.status = 'pending';
  assert.ok(
    validateExternalIntakeClosure(pending, { repositoryRoot }).errors
      .includes('CAPABILITY_GRANT_AUDIT_CLOSURE_NOT_PASSED'),
  );

  const missing = clone(closure);
  missing.capabilityGrantAndAudit.schemas[0] = 'scripts/external-intake/schemas/not-found.json';
  assert.ok(
    validateExternalIntakeClosure(missing, { repositoryRoot }).errors
      .includes('CAPABILITY_GRANT_AUDIT_SCHEMA_PATH_MISSING'),
  );
});
