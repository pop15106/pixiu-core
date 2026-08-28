'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_VERSION = 'pixiu.safety-hardening-gates/v1';
const EXPECTED_GATES = Object.freeze({
  A: Object.freeze({
    name: 'Resource Identity Gate',
    implementation: 'scripts/core-evolution/resource-identity-gate.js',
    tests: Object.freeze(['scripts/core-evolution/test/resource-identity-gate.test.js']),
    evidence: Object.freeze([
      'docs/core-evolution-gates.md',
      'docs/superpowers/plans/2026-07-21-core-evolution-gates.md',
    ]),
  }),
  B: Object.freeze({
    name: 'MCP Compatibility Gateway',
    implementation: 'scripts/core-evolution/mcp-compatibility-gateway.js',
    tests: Object.freeze(['scripts/core-evolution/test/mcp-compatibility-gateway.test.js']),
    evidence: Object.freeze([
      'docs/core-evolution-gates.md',
      'docs/superpowers/plans/2026-07-21-core-evolution-gates.md',
    ]),
  }),
  C: Object.freeze({
    name: 'Pixiu Extension Package',
    implementation: 'scripts/core-evolution/pixiu-extension-package.js',
    tests: Object.freeze([
      'scripts/core-evolution/test/pixiu-extension-package.test.js',
      'scripts/core-evolution/test/integration.test.js',
    ]),
    evidence: Object.freeze([
      'docs/core-evolution-gates.md',
      'docs/superpowers/plans/2026-07-21-core-evolution-gates.md',
    ]),
  }),
});

function loadSafetyHardeningClosure(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim());
}

function sameStringSet(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  return [...actual].sort().join('\n') === [...expected].sort().join('\n');
}

function validateSafetyHardeningClosure(closure, options = {}) {
  const errors = [];
  const repositoryRoot = path.resolve(options.repositoryRoot || process.cwd());

  if (!closure || typeof closure !== 'object' || Array.isArray(closure)) {
    return { valid: false, errors: ['SAFETY_GATE_CLOSURE_INVALID'] };
  }
  if (closure.schemaVersion !== SCHEMA_VERSION) errors.push('SAFETY_GATE_SCHEMA_UNSUPPORTED');
  if (closure.status !== 'passed') errors.push('SAFETY_GATE_CLOSURE_NOT_PASSED');
  if (closure.verificationCommand !== 'node --test scripts/core-evolution/test/*.test.js') {
    errors.push('SAFETY_GATE_VERIFICATION_COMMAND_MISMATCH');
  }
  if (!Array.isArray(closure.gates) || closure.gates.length !== 3) {
    errors.push('SAFETY_GATE_SET_INVALID');
    return { valid: false, errors: [...new Set(errors)].sort() };
  }

  const seen = new Set();
  for (const gate of closure.gates) {
    const id = gate && typeof gate.id === 'string' ? gate.id : '?';
    const expected = EXPECTED_GATES[id];
    if (!expected || seen.has(id)) {
      errors.push('SAFETY_GATE_SET_INVALID');
      continue;
    }
    seen.add(id);
    if (gate.name !== expected.name) errors.push(`SAFETY_GATE_${id}_NAME_MISMATCH`);
    if (gate.status !== 'passed') errors.push(`SAFETY_GATE_${id}_NOT_PASSED`);
    if (gate.implementation !== expected.implementation) {
      errors.push(`SAFETY_GATE_${id}_IMPLEMENTATION_MISMATCH`);
    }
    if (!validateStringArray(gate.tests)) {
      errors.push(`SAFETY_GATE_${id}_TESTS_INVALID`);
    } else if (!sameStringSet(gate.tests, expected.tests)) {
      errors.push(`SAFETY_GATE_${id}_TEST_MAPPING_MISMATCH`);
    }
    if (!validateStringArray(gate.evidence)) {
      errors.push(`SAFETY_GATE_${id}_EVIDENCE_INVALID`);
    } else if (!sameStringSet(gate.evidence, expected.evidence)) {
      errors.push(`SAFETY_GATE_${id}_EVIDENCE_MAPPING_MISMATCH`);
    }

    if (typeof gate.implementation === 'string') {
      const implementationPath = path.resolve(repositoryRoot, gate.implementation);
      if (!fs.existsSync(implementationPath)) errors.push(`SAFETY_GATE_${id}_IMPLEMENTATION_PATH_MISSING`);
    }
    for (const testPath of Array.isArray(gate.tests) ? gate.tests : []) {
      if (!fs.existsSync(path.resolve(repositoryRoot, testPath))) {
        errors.push(`SAFETY_GATE_${id}_TEST_PATH_MISSING`);
      }
    }
    for (const evidencePath of Array.isArray(gate.evidence) ? gate.evidence : []) {
      if (!fs.existsSync(path.resolve(repositoryRoot, evidencePath))) {
        errors.push(`SAFETY_GATE_${id}_EVIDENCE_PATH_MISSING`);
      }
    }
  }

  for (const id of Object.keys(EXPECTED_GATES)) {
    if (!seen.has(id)) errors.push(`SAFETY_GATE_${id}_MISSING`);
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}

module.exports = {
  EXPECTED_GATES,
  SCHEMA_VERSION,
  loadSafetyHardeningClosure,
  validateSafetyHardeningClosure,
};
