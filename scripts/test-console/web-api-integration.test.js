#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const { createTestConsoleServer } = require('./server');

async function waitForRun(origin, runId, timeoutMs = 240000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`${origin}/api/runs/${runId}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    if (['passed', 'failed', 'cancelled'].includes(payload.run.status)) {
      return payload.run;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`測試工作 ${runId} 逾時`);
}

async function startRun(origin, token, moduleId) {
  const response = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'x-pixiu-test-token': token
    },
    body: JSON.stringify({ moduleId })
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload.run;
}

test('真實 Web API 可執行單模組與完整整合測試', { timeout: 300000 }, async (t) => {
  const rootDir = path.resolve(__dirname, '..', '..');
  const app = createTestConsoleServer({ rootDir });
  const address = await app.start(0);
  t.after(() => app.stop());
  const origin = `http://127.0.0.1:${address.port}`;

  const sessionResponse = await fetch(`${origin}/api/session`);
  const session = await sessionResponse.json();
  assert.equal(sessionResponse.status, 200);
  assert.equal(typeof session.token, 'string');
  assert.ok(session.token.length >= 32);

  const moduleResponse = await fetch(`${origin}/api/modules`);
  const modulePayload = await moduleResponse.json();
  assert.equal(moduleResponse.status, 200);
  assert.equal(modulePayload.modules.length, 7);

  const single = await startRun(origin, session.token, 'core-evolution');
  const singleResult = await waitForRun(origin, single.id);
  assert.equal(singleResult.status, 'passed', singleResult.log);
  assert.equal(singleResult.steps.length, 1);
  assert.equal(singleResult.steps[0].moduleId, 'core-evolution');

  const integration = await startRun(origin, session.token, 'integration-all');
  const integrationResult = await waitForRun(origin, integration.id);
  assert.equal(integrationResult.status, 'passed', integrationResult.log);
  assert.equal(integrationResult.steps.length, 6);
  assert.equal(integrationResult.steps.every((step) => step.status === 'passed'), true);
});
