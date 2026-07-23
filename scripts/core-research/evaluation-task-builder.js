'use strict';

const crypto = require('node:crypto');
const path = require('node:path');

const { evaluateRepositoryCandidate } = require('./repository-source-gate');

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireRoot(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw createError('EVALUATION_ROOT_REQUIRED', `${fieldName} 不可為空`);
  }
  return path.resolve(value);
}

function normalizeCreatedAt(value) {
  const timestamp = value === undefined ? Date.now() : Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw createError('EVALUATION_CREATED_AT_INVALID', 'createdAt 必須是有效日期');
  }
  return new Date(timestamp).toISOString();
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nestedValue of Object.values(value)) deepFreeze(nestedValue);
  return Object.freeze(value);
}

function createDigest(payload) {
  return crypto.createHash('sha256').update(stableSerialize(payload)).digest('hex');
}

function buildEvaluationTask({
  selectionEntry,
  stateRoot,
  artifactRoot,
  createdAt,
} = {}) {
  const sourceDecision = evaluateRepositoryCandidate(selectionEntry);
  if (sourceDecision.decision !== 'CHECKOUT_ALLOWED') {
    throw createError(
      'EVALUATION_CHECKOUT_NOT_ALLOWED',
      `候選不可建立 checkout 任務：${sourceDecision.reasonCodes.join(',')}`,
    );
  }

  const normalizedStateRoot = requireRoot(stateRoot, 'stateRoot');
  const normalizedArtifactRoot = requireRoot(artifactRoot, 'artifactRoot');
  const normalizedCreatedAt = normalizeCreatedAt(createdAt);
  const candidate = selectionEntry.candidate;
  const score = selectionEntry.score;
  const taskSeed = `${candidate.candidateId}\n${sourceDecision.source.commitSha}`;
  const taskId = `evaluation-${crypto.createHash('sha256').update(taskSeed).digest('hex').slice(0, 24)}`;
  const repositoryKey = crypto
    .createHash('sha256')
    .update(sourceDecision.source.canonicalUri)
    .digest('hex')
    .slice(0, 20);
  const cachePath = path.join(normalizedStateRoot, 'repository-cache', `${repositoryKey}.git`);
  const worktreePath = path.join(normalizedStateRoot, 'worktrees', taskId);
  const artifactDir = path.join(normalizedArtifactRoot, 'evaluations', taskId);

  const payload = {
    schemaVersion: 'pixiu.core-research/evaluation-task-v1',
    taskId,
    createdAt: normalizedCreatedAt,
    candidateId: candidate.candidateId,
    candidate: {
      title: candidate.title,
      profile: candidate.profile,
      categories: [...candidate.categories],
      summary: candidate.summary,
    },
    score: {
      totalScore: score.totalScore,
      disposition: score.disposition,
      reasonCodes: [...score.reasonCodes],
    },
    source: {
      ...sourceDecision.source,
    },
    workspace: {
      cachePath,
      worktreePath,
    },
    artifactDir,
    allowedPaths: [artifactDir, cachePath, worktreePath].sort(),
    prohibitedActions: [
      'commit',
      'deploy',
      'formal-core-write',
      'merge',
      'push',
      'read-secrets',
    ],
    checkoutPlan: [
      {
        stepId: 'clone-bare-cache',
        executable: 'git',
        args: [
          'clone',
          '--bare',
          '--filter=blob:none',
          sourceDecision.source.canonicalUri,
          cachePath,
        ],
        when: 'CACHE_MISSING',
      },
      {
        stepId: 'fetch-pinned-commit',
        executable: 'git',
        args: [
          '--git-dir',
          cachePath,
          'fetch',
          '--prune',
          'origin',
          sourceDecision.source.commitSha,
        ],
        when: 'ALWAYS',
      },
      {
        stepId: 'create-detached-worktree',
        executable: 'git',
        args: [
          '--git-dir',
          cachePath,
          'worktree',
          'add',
          '--detach',
          worktreePath,
          sourceDecision.source.commitSha,
        ],
        when: 'WORKTREE_MISSING',
      },
    ],
    scanPlan: [
      'license',
      'secret',
      'static',
      'supply-chain',
      'prompt-injection',
    ],
    sandboxPolicy: {
      mode: 'devspace-restricted',
      networkIsolationRequired: true,
      secretsAvailable: false,
      workspaceOnly: true,
      timeoutMs: 300000,
      maxOutputBytes: 1048576,
      approvedCommands: [
        ['node', '--test'],
        ['npm', 'test'],
        ['python', '-m', 'pytest'],
        ['mvn', 'test'],
        ['gradle', 'test'],
      ],
    },
  };

  return deepFreeze({
    ...payload,
    integrity: {
      algorithm: 'sha256',
      value: createDigest(payload),
    },
  });
}

function verifyEvaluationTask(task) {
  if (!task || typeof task !== 'object' || Array.isArray(task)) {
    throw createError('EVALUATION_TASK_INVALID', 'Evaluation Task 必須是物件');
  }
  if (task.schemaVersion !== 'pixiu.core-research/evaluation-task-v1') {
    throw createError('EVALUATION_TASK_SCHEMA_UNSUPPORTED', '不支援的 Evaluation Task Schema');
  }
  if (task.integrity?.algorithm !== 'sha256' || !/^[a-f0-9]{64}$/.test(task.integrity.value || '')) {
    throw createError('EVALUATION_TASK_INTEGRITY_INVALID', 'Evaluation Task 缺少合法 SHA-256 Digest');
  }

  const { integrity, ...payload } = task;
  const actualDigest = createDigest(payload);
  if (actualDigest !== integrity.value) {
    throw createError('EVALUATION_TASK_INTEGRITY_MISMATCH', 'Evaluation Task Digest 不一致');
  }
  return deepFreeze({ ...task });
}

module.exports = {
  buildEvaluationTask,
  verifyEvaluationTask,
  stableSerialize,
};
