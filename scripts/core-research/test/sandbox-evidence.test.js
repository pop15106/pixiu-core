'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeCandidate } = require('../candidate-schema');
const { scoreCandidate } = require('../candidate-scorer');
const { buildEvaluationTask } = require('../evaluation-task-builder');
const { validateSandboxEvidence } = require('../sandbox-evidence');

function createTask() {
  const candidate = normalizeCandidate({
    resourceType: 'repository',
    title: 'Sandbox Fixture',
    canonicalUri: 'https://github.com/example/sandbox-fixture',
    publisher: 'example',
    publishedAt: '2026-07-20T00:00:00Z',
    updatedAt: '2026-07-23T00:00:00Z',
    discoveredAt: '2026-07-23T02:00:00Z',
    commitSha: 'a'.repeat(40),
    license: 'MIT',
    categories: ['security-testing'],
    summary: 'Sandbox 測試',
    evidence: [{ source: 'https://github.com/example/sandbox-fixture', note: 'fixture' }],
    metrics: {
      coreFit: 95,
      expectedValue: 90,
      novelty: 85,
      maturity: 85,
      feasibility: 90,
      evidenceQuality: 90,
      trust: 95,
    },
    riskFlags: [],
  });
  return buildEvaluationTask({
    selectionEntry: { candidate, score: scoreCandidate(candidate) },
    stateRoot: 'C:/pixiu/state/core-research',
    artifactRoot: 'C:/pixiu/artifacts/core-research',
    createdAt: '2026-07-23T03:00:00Z',
  });
}

function passEvidence(task, overrides = {}) {
  return {
    taskId: task.taskId,
    taskDigest: task.integrity.value,
    status: 'PASS',
    command: ['node', '--test'],
    recordedAt: '2026-07-23T04:00:00Z',
    durationMs: 1000,
    exitCode: 0,
    timedOut: false,
    outputBytes: 1024,
    networkIsolated: true,
    secretsAvailable: false,
    workspaceOnly: true,
    ...overrides,
  };
}

test('完整隔離證據可記錄為 PASS', () => {
  const task = createTask();
  const result = validateSandboxEvidence(task, passEvidence(task));

  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.concerns, []);
  assert.equal(result.recordedAt, '2026-07-23T04:00:00.000Z');
  assert.ok(Object.isFrozen(result));
});

test('PASS 缺少網路隔離時拒絕', () => {
  const task = createTask();

  assert.throws(
    () => validateSandboxEvidence(task, passEvidence(task, { networkIsolated: false })),
    (error) => error.code === 'SANDBOX_ISOLATION_REQUIRED',
  );
});

test('PASS 不可暴露秘密或跨出工作區', () => {
  const task = createTask();

  assert.throws(
    () => validateSandboxEvidence(task, passEvidence(task, { secretsAvailable: true })),
    (error) => error.code === 'SANDBOX_SECRETS_FORBIDDEN',
  );
  assert.throws(
    () => validateSandboxEvidence(task, passEvidence(task, { workspaceOnly: false })),
    (error) => error.code === 'SANDBOX_WORKSPACE_ONLY_REQUIRED',
  );
});

test('只允許 Task 核准的命令', () => {
  const task = createTask();

  assert.throws(
    () => validateSandboxEvidence(task, passEvidence(task, { command: ['powershell', '-Command', 'Get-ChildItem Env:'] })),
    (error) => error.code === 'SANDBOX_COMMAND_NOT_APPROVED',
  );
});

test('超時或輸出超限證據拒絕', () => {
  const task = createTask();

  assert.throws(
    () => validateSandboxEvidence(task, passEvidence(task, { durationMs: task.sandboxPolicy.timeoutMs + 1 })),
    (error) => error.code === 'SANDBOX_TIMEOUT_EXCEEDED',
  );
  assert.throws(
    () => validateSandboxEvidence(task, passEvidence(task, { outputBytes: task.sandboxPolicy.maxOutputBytes + 1 })),
    (error) => error.code === 'SANDBOX_OUTPUT_LIMIT_EXCEEDED',
  );
});

test('沒有 OS 級 Sandbox 時只能明確標記 SKIPPED_UNAVAILABLE', () => {
  const task = createTask();
  const result = validateSandboxEvidence(task, {
    taskId: task.taskId,
    taskDigest: task.integrity.value,
    status: 'SKIPPED_UNAVAILABLE',
    recordedAt: '2026-07-23T04:00:00Z',
    reason: '目前 DevSpace 主機沒有可驗證的網路隔離容器。',
  });

  assert.equal(result.status, 'SKIPPED_UNAVAILABLE');
  assert.deepEqual(result.concerns, ['SANDBOX_UNAVAILABLE']);
});

test('Task ID 或 Digest 不一致時拒絕', () => {
  const task = createTask();

  assert.throws(
    () => validateSandboxEvidence(task, passEvidence(task, { taskId: 'evaluation-other' })),
    (error) => error.code === 'SANDBOX_TASK_MISMATCH',
  );
  assert.throws(
    () => validateSandboxEvidence(task, passEvidence(task, { taskDigest: '0'.repeat(64) })),
    (error) => error.code === 'SANDBOX_TASK_MISMATCH',
  );
});
