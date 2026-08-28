'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  loadSafetyHardeningClosure,
  validateSafetyHardeningClosure,
} = require('../safety-hardening-gate-closure');

const repositoryRoot = path.resolve(__dirname, '../../..');
const closurePath = path.join(
  repositoryRoot,
  'docs',
  'architecture',
  'pixiucore-safety-hardening-gates.v1.json',
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('canonical Gate A/B/C closure 明確綁定三個既有安全模組', () => {
  const closure = loadSafetyHardeningClosure(closurePath);
  const result = validateSafetyHardeningClosure(closure, { repositoryRoot });

  assert.deepEqual(result, { valid: true, errors: [] });
  assert.equal(closure.schemaVersion, 'pixiu.safety-hardening-gates/v1');
  assert.deepEqual(
    closure.gates.map((gate) => [gate.id, gate.name]),
    [
      ['A', 'Resource Identity Gate'],
      ['B', 'MCP Compatibility Gateway'],
      ['C', 'Pixiu Extension Package'],
    ],
  );
  assert.ok(closure.gates.every((gate) => gate.status === 'passed'));
});

test('Gate mapping 被調換時 fail closed', () => {
  const closure = loadSafetyHardeningClosure(closurePath);
  const tampered = clone(closure);
  tampered.gates[0].implementation = 'scripts/core-evolution/mcp-compatibility-gateway.js';

  const result = validateSafetyHardeningClosure(tampered, { repositoryRoot });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('SAFETY_GATE_A_IMPLEMENTATION_MISMATCH'));
});

test('Gate test mapping 指向其他存在測試時仍 fail closed', () => {
  const closure = loadSafetyHardeningClosure(closurePath);
  const tampered = clone(closure);
  tampered.gates[0].tests = ['scripts/core-evolution/test/mcp-compatibility-gateway.test.js'];

  const result = validateSafetyHardeningClosure(tampered, { repositoryRoot });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('SAFETY_GATE_A_TEST_MAPPING_MISMATCH'));
});

test('任一 Gate 非 passed 時不得宣告 closure', () => {
  const closure = loadSafetyHardeningClosure(closurePath);
  const tampered = clone(closure);
  tampered.gates[1].status = 'pending';

  const result = validateSafetyHardeningClosure(tampered, { repositoryRoot });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('SAFETY_GATE_B_NOT_PASSED'));
});

test('缺少 implementation/test/evidence path 時 fail closed', () => {
  const closure = loadSafetyHardeningClosure(closurePath);
  const tampered = clone(closure);
  tampered.gates[2].tests = ['scripts/core-evolution/test/not-found.test.js'];

  const result = validateSafetyHardeningClosure(tampered, { repositoryRoot });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('SAFETY_GATE_C_TEST_PATH_MISSING'));
});
