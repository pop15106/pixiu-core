#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createWorkflowLabServer } = require('./server');

async function waitForRun(origin, runId, predicate, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (true) {
    const response = await fetch(`${origin}/api/runs/${runId}`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    if (predicate(payload.run)) {
      return payload.run;
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`等待 Run ${runId} 狀態逾時，目前為 ${payload.run.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function createClient(origin, token) {
  const headers = {
    origin,
    'content-type': 'application/json',
    'X-Pixiu-Workflow-Token': token
  };

  return {
    async start(request) {
      const response = await fetch(`${origin}/api/runs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });
      assert.equal(response.status, 202);
      return (await response.json()).run;
    },
    async approve(runId, decision) {
      const response = await fetch(`${origin}/api/runs/${runId}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify(decision)
      });
      assert.equal(response.status, 202);
      return (await response.json()).run;
    },
    async cancel(runId) {
      const response = await fetch(`${origin}/api/runs/${runId}/cancel`, {
        method: 'POST',
        headers,
        body: '{}'
      });
      assert.equal(response.status, 200);
      return (await response.json()).run;
    }
  };
}

test('真實 Workflow Lab Web API 可執行單模組、部分流程、全流程、RED 退回與取消', async (t) => {
  const token = 'workflow-integration-token';
  const app = createWorkflowLabServer({
    token,
    projectValidator: {
      listProjects() {
        return [];
      }
    },
    liveExecutor: {
      isAvailable() {
        return false;
      }
    }
  });
  const address = await app.start(0);
  t.after(() => app.stop());
  const origin = `http://127.0.0.1:${address.port}`;
  const client = createClient(origin, token);

  const health = await fetch(`${origin}/healthz`).then((response) => response.json());
  assert.equal(health.status, 'ready');

  const secret = 'WORKFLOW-INTEGRATION-SECRET-7788';
  const translatorStart = await client.start({
    requirement: `替 ${secret} 建立帳單覆核`,
    sensitiveTerms: [secret],
    selectionMode: 'single',
    moduleSequence: ['translator']
  });
  const translator = await waitForRun(origin, translatorStart.id, (run) => run.status === 'green');
  assert.equal(translator.steps.length, 1);
  assert.equal(translator.steps[0].moduleId, 'translator');
  assert.equal(JSON.stringify(translator).includes(secret), false);
  assert.equal(translator.artifacts.length, 1);

  const artifactResponse = await fetch(
    `${origin}/api/runs/${translator.id}/artifacts/${translator.artifacts[0].id}`
  );
  assert.equal(artifactResponse.status, 200);
  assert.equal(JSON.stringify(await artifactResponse.json()).includes(secret), false);

  const partialStart = await client.start({
    requirement: '新增帳單覆核',
    businessLogic: '金額 > 100 時需要覆核',
    fixtureMode: 'assisted-fixture',
    selectionMode: 'partial',
    moduleSequence: ['translator', 'pm', 'sa']
  });
  const partial = await waitForRun(origin, partialStart.id, (run) => run.status === 'green');
  assert.deepEqual(partial.steps.map((step) => step.moduleId), ['translator', 'pm', 'sa']);

  const fullStart = await client.start({
    requirement: '建立完整帳單覆核流程',
    businessLogic: '金額 > 100 時需要覆核',
    fixtureMode: 'assisted-fixture',
    selectionMode: 'full'
  });
  const full = await waitForRun(origin, fullStart.id, (run) => run.status === 'green');
  assert.equal(full.steps.length, 13);
  assert.equal(full.steps.every((step) => step.status === 'GREEN'), true);
  assert.equal(full.artifacts.some((artifact) => artifact.type === 'documentation-artifact-v1'), true);

  const redStart = await client.start({
    requirement: '建立會被 QA 退回的測試流程',
    fixtureMode: 'assisted-fixture',
    selectionMode: 'full',
    testScenario: 'qa-red'
  });
  const paused = await waitForRun(origin, redStart.id, (run) => run.status === 'paused');
  assert.equal(paused.pendingApproval.kind, 'red-return');
  assert.equal(paused.pendingApproval.recommendedModuleId, 'pg');
  await client.approve(paused.id, { action: 'return', moduleId: 'pg' });
  const resumed = await waitForRun(origin, paused.id, (run) => run.status === 'green');
  assert.equal(resumed.iteration, 2);
  assert.equal(resumed.steps.filter((step) => step.moduleId === 'pg').length, 2);

  const delayedStart = await client.start({
    requirement: '建立可取消的延遲測試',
    selectionMode: 'single',
    moduleSequence: ['translator'],
    testScenario: 'delayed'
  });
  await waitForRun(origin, delayedStart.id, (run) => ['queued', 'running'].includes(run.status));
  await client.cancel(delayedStart.id);
  const cancelled = await waitForRun(origin, delayedStart.id, (run) => run.status === 'cancelled');
  assert.equal(cancelled.status, 'cancelled');
});
