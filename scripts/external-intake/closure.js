'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_VERSION = 'pixiu.external-intake-safety/v1';
const REQUIRED_FORBIDDEN_FIELDS = Object.freeze([
  'rawCommand',
  'localPath',
  'providerCredential',
  'approval',
  'skipSandbox',
]);
const EXPECTED_ENVELOPE = Object.freeze({
  schema: 'scripts/external-intake/schemas/external-task-envelope.v1.schema.json',
  implementation: 'scripts/external-intake/external-task-envelope.js',
  tests: Object.freeze([
    'scripts/external-intake/test/external-task-envelope.test.js',
    'scripts/external-intake/test/schema-contract.test.js',
  ]),
});
const EXPECTED_GRANT_AUDIT = Object.freeze({
  schemas: Object.freeze([
    'scripts/external-intake/schemas/capability-grant.v1.schema.json',
    'scripts/external-intake/schemas/capability-grant-audit.v1.schema.json',
  ]),
  implementation: 'scripts/external-intake/capability-grant.js',
  tests: Object.freeze([
    'scripts/external-intake/test/capability-grant.test.js',
    'scripts/external-intake/test/schema-contract.test.js',
  ]),
  bindings: Object.freeze(['principalRef', 'grantId', 'version', 'digest', 'scope', 'capabilities', 'auditDigest']),
});

function loadExternalIntakeClosure(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function pathExists(repositoryRoot, relativePath) {
  return typeof relativePath === 'string'
    && relativePath.trim().length > 0
    && fs.existsSync(path.resolve(repositoryRoot, relativePath));
}

function sameStringSet(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  return [...actual].sort().join('\n') === [...expected].sort().join('\n');
}

function validateExternalIntakeClosure(closure, options = {}) {
  const errors = [];
  const repositoryRoot = path.resolve(options.repositoryRoot || process.cwd());

  if (!closure || typeof closure !== 'object' || Array.isArray(closure)) {
    return { valid: false, errors: ['EXTERNAL_INTAKE_CLOSURE_INVALID'] };
  }
  if (closure.schemaVersion !== SCHEMA_VERSION) errors.push('EXTERNAL_INTAKE_CLOSURE_SCHEMA_UNSUPPORTED');
  if (closure.status !== 'passed') errors.push('EXTERNAL_INTAKE_CLOSURE_NOT_PASSED');
  if (closure.verificationCommand !== 'node --test scripts/external-intake/test/*.test.js') {
    errors.push('EXTERNAL_INTAKE_VERIFICATION_COMMAND_MISMATCH');
  }

  const envelope = closure.externalTaskEnvelope;
  if (!envelope || typeof envelope !== 'object' || envelope.status !== 'passed') {
    errors.push('EXTERNAL_TASK_ENVELOPE_CLOSURE_NOT_PASSED');
  } else {
    for (const required of REQUIRED_FORBIDDEN_FIELDS) {
      if (!Array.isArray(envelope.forbiddenFields) || !envelope.forbiddenFields.includes(required)) {
        errors.push('EXTERNAL_INTAKE_FORBIDDEN_FIELDS_INCOMPLETE');
        break;
      }
    }
    if (envelope.schema !== EXPECTED_ENVELOPE.schema) errors.push('EXTERNAL_TASK_ENVELOPE_SCHEMA_MISMATCH');
    if (envelope.implementation !== EXPECTED_ENVELOPE.implementation) {
      errors.push('EXTERNAL_TASK_ENVELOPE_IMPLEMENTATION_MISMATCH');
    }
    if (!sameStringSet(envelope.tests, EXPECTED_ENVELOPE.tests)) {
      errors.push('EXTERNAL_TASK_ENVELOPE_TEST_MAPPING_MISMATCH');
    }
    if (!pathExists(repositoryRoot, envelope.schema)) errors.push('EXTERNAL_TASK_ENVELOPE_SCHEMA_PATH_MISSING');
    if (!pathExists(repositoryRoot, envelope.implementation)) {
      errors.push('EXTERNAL_TASK_ENVELOPE_IMPLEMENTATION_PATH_MISSING');
    }
    for (const testPath of Array.isArray(envelope.tests) ? envelope.tests : []) {
      if (!pathExists(repositoryRoot, testPath)) errors.push('EXTERNAL_TASK_ENVELOPE_TEST_PATH_MISSING');
    }
  }

  const grant = closure.capabilityGrantAndAudit;
  if (!grant || typeof grant !== 'object' || grant.status !== 'passed') {
    errors.push('CAPABILITY_GRANT_AUDIT_CLOSURE_NOT_PASSED');
  } else {
    if (grant.implementation !== EXPECTED_GRANT_AUDIT.implementation) {
      errors.push('CAPABILITY_GRANT_AUDIT_IMPLEMENTATION_MISMATCH');
    }
    if (!sameStringSet(grant.schemas, EXPECTED_GRANT_AUDIT.schemas)) {
      errors.push('CAPABILITY_GRANT_AUDIT_SCHEMA_MAPPING_MISMATCH');
    }
    if (!sameStringSet(grant.tests, EXPECTED_GRANT_AUDIT.tests)) {
      errors.push('CAPABILITY_GRANT_AUDIT_TEST_MAPPING_MISMATCH');
    }
    if (!sameStringSet(grant.bindings, EXPECTED_GRANT_AUDIT.bindings)) {
      errors.push('CAPABILITY_GRANT_AUDIT_BINDINGS_INCOMPLETE');
    }
    if (!pathExists(repositoryRoot, grant.implementation)) {
      errors.push('CAPABILITY_GRANT_AUDIT_IMPLEMENTATION_PATH_MISSING');
    }
    if (!Array.isArray(grant.schemas) || grant.schemas.length !== 2) {
      errors.push('CAPABILITY_GRANT_AUDIT_SCHEMAS_INVALID');
    } else {
      for (const schemaPath of grant.schemas) {
        if (!pathExists(repositoryRoot, schemaPath)) errors.push('CAPABILITY_GRANT_AUDIT_SCHEMA_PATH_MISSING');
      }
    }
    for (const testPath of Array.isArray(grant.tests) ? grant.tests : []) {
      if (!pathExists(repositoryRoot, testPath)) errors.push('CAPABILITY_GRANT_AUDIT_TEST_PATH_MISSING');
    }
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}

module.exports = {
  REQUIRED_FORBIDDEN_FIELDS,
  SCHEMA_VERSION,
  loadExternalIntakeClosure,
  validateExternalIntakeClosure,
};
