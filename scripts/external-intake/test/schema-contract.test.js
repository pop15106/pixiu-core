'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const schemaDir = path.resolve(__dirname, '../schemas');

function readSchema(name) {
  return JSON.parse(fs.readFileSync(path.join(schemaDir, name), 'utf8'));
}

test('External Task Envelope schema 是封閉且 versioned 的 machine-readable contract', () => {
  const schema = readSchema('external-task-envelope.v1.schema.json');

  assert.equal(schema.$id, 'pixiu.external-task-envelope/v1');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(
    new Set(schema.required),
    new Set([
      'schemaVersion',
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
      'envelopeDigest',
    ]),
  );
});

test('Capability Grant 與 audit schema 明確 versioned 且封閉', () => {
  const grant = readSchema('capability-grant.v1.schema.json');
  const audit = readSchema('capability-grant-audit.v1.schema.json');

  assert.equal(grant.$id, 'pixiu.capability-grant/v1');
  assert.equal(grant.additionalProperties, false);
  assert.ok(grant.required.includes('digest'));
  assert.ok(grant.required.includes('scope'));
  assert.ok(grant.required.includes('capabilities'));

  assert.equal(audit.$id, 'pixiu.capability-grant-audit/v1');
  assert.equal(audit.additionalProperties, false);
  assert.ok(audit.required.includes('grantDigest'));
  assert.ok(audit.required.includes('grantVersion'));
  assert.ok(audit.required.includes('capabilities'));
});
