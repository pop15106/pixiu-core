'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { normalizeCandidate } = require('../candidate-schema');
const { scoreCandidate } = require('../candidate-scorer');
const {
  buildEvaluationTask,
  verifyEvaluationTask,
} = require('../evaluation-task-builder');

function createSelectionEntry(overrides = {}) {
  const candidate = normalizeCandidate({
    resourceType: 'repository',
    title: 'Example Repo',
    canonicalUri: 'https://github.com/example/repo',
    publisher: 'example',
    publishedAt: '2026-07-20T00:00:00Z',
    updatedAt: '2026-07-23T00:00:00Z',
    discoveredAt: '2026-07-23T02:00:00Z',
    commitSha: 'a'.repeat(40),
    license: 'MIT',
    categories: ['ai-sdlc'],
    summary: '候選摘要',
    evidence: [{ source: 'https://github.com/example/repo', note: '來源存在' }],
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
    ...overrides,
  });
  return { candidate, score: scoreCandidate(candidate) };
}

test('建立穩定且不可變的 Evaluation Task', () => {
  const input = {
    selectionEntry: createSelectionEntry(),
    stateRoot: 'C:/pixiu/state/core-research',
    artifactRoot: 'C:/pixiu/artifacts/core-research',
    createdAt: '2026-07-23T11:00:00+08:00',
  };
  const first = buildEvaluationTask(input);
  const second = buildEvaluationTask(input);

  assert.equal(first.taskId, second.taskId);
  assert.equal(first.integrity.value, second.integrity.value);
  assert.equal(first.createdAt, '2026-07-23T03:00:00.000Z');
  assert.ok(Object.isFrozen(first));
  assert.equal(verifyEvaluationTask(first).taskId, first.taskId);
});

test('checkout plan 使用 argv 陣列而非 shell 字串', () => {
  const task = buildEvaluationTask({
    selectionEntry: createSelectionEntry(),
    stateRoot: 'C:/pixiu/state/core-research',
    artifactRoot: 'C:/pixiu/artifacts/core-research',
    createdAt: '2026-07-23T03:00:00Z',
  });

  assert.equal(task.checkoutPlan.length, 3);
  assert.ok(task.checkoutPlan.every((step) => step.executable === 'git'));
  assert.ok(task.checkoutPlan.every((step) => Array.isArray(step.args)));
  assert.ok(task.checkoutPlan.every((step) => !Object.hasOwn(step, 'command')));
  assert.ok(task.checkoutPlan[0].args.includes('https://github.com/example/repo'));
  assert.ok(task.checkoutPlan[1].args.includes('a'.repeat(40)));
});

test('cache、worktree 與 artifact 路徑固定在指定根目錄下', () => {
  const stateRoot = path.resolve('C:/pixiu/state/core-research');
  const artifactRoot = path.resolve('C:/pixiu/artifacts/core-research');
  const task = buildEvaluationTask({
    selectionEntry: createSelectionEntry(),
    stateRoot,
    artifactRoot,
    createdAt: '2026-07-23T03:00:00Z',
  });

  assert.ok(task.workspace.cachePath.startsWith(`${stateRoot}${path.sep}`));
  assert.ok(task.workspace.worktreePath.startsWith(`${stateRoot}${path.sep}`));
  assert.ok(task.artifactDir.startsWith(`${artifactRoot}${path.sep}`));
  assert.deepEqual([...task.allowedPaths].sort(), [
    task.artifactDir,
    task.workspace.cachePath,
    task.workspace.worktreePath,
  ].sort());
});

test('禁止操作與 Sandbox 限制完整保留', () => {
  const task = buildEvaluationTask({
    selectionEntry: createSelectionEntry(),
    stateRoot: 'C:/pixiu/state/core-research',
    artifactRoot: 'C:/pixiu/artifacts/core-research',
    createdAt: '2026-07-23T03:00:00Z',
  });

  assert.deepEqual(task.prohibitedActions, [
    'commit',
    'deploy',
    'formal-core-write',
    'merge',
    'push',
    'read-secrets',
  ]);
  assert.equal(task.sandboxPolicy.networkIsolationRequired, true);
  assert.equal(task.sandboxPolicy.secretsAvailable, false);
  assert.equal(task.sandboxPolicy.workspaceOnly, true);
  assert.ok(task.sandboxPolicy.timeoutMs > 0);
  assert.ok(task.sandboxPolicy.approvedCommands.length > 0);
});

test('遭竄改的 Task Digest 會被拒絕', () => {
  const task = buildEvaluationTask({
    selectionEntry: createSelectionEntry(),
    stateRoot: 'C:/pixiu/state/core-research',
    artifactRoot: 'C:/pixiu/artifacts/core-research',
    createdAt: '2026-07-23T03:00:00Z',
  });
  const tampered = {
    ...task,
    prohibitedActions: task.prohibitedActions.filter((item) => item !== 'push'),
  };

  assert.throws(
    () => verifyEvaluationTask(tampered),
    (error) => error.code === 'EVALUATION_TASK_INTEGRITY_MISMATCH',
  );
});

test('不符合 Source Gate 的候選不能建立 Task', () => {
  assert.throws(
    () => buildEvaluationTask({
      selectionEntry: createSelectionEntry({ license: 'UNKNOWN' }),
      stateRoot: 'C:/pixiu/state/core-research',
      artifactRoot: 'C:/pixiu/artifacts/core-research',
      createdAt: '2026-07-23T03:00:00Z',
    }),
    (error) => error.code === 'EVALUATION_CHECKOUT_NOT_ALLOWED',
  );
});
