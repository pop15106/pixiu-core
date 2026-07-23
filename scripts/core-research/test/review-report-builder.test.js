'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { mkdtemp, readFile } = require('node:fs/promises');

const { normalizeCandidate } = require('../candidate-schema');
const { scoreCandidate } = require('../candidate-scorer');
const { buildEvaluationTask } = require('../evaluation-task-builder');
const { validateSandboxEvidence } = require('../sandbox-evidence');
const { writeEvaluationReview } = require('../review-report-builder');

function createTask() {
  const candidate = normalizeCandidate({
    resourceType: 'repository',
    title: 'Review <script>alert(1)</script> | Fixture',
    canonicalUri: 'https://github.com/example/review-fixture',
    publisher: 'example',
    publishedAt: '2026-07-20T00:00:00Z',
    updatedAt: '2026-07-23T00:00:00Z',
    discoveredAt: '2026-07-23T02:00:00Z',
    commitSha: 'a'.repeat(40),
    license: 'MIT',
    categories: ['security-testing'],
    summary: '評估報告測試',
    evidence: [{ source: 'https://github.com/example/review-fixture', note: 'fixture' }],
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

function workspaceEvidence(task, overrides = {}) {
  return {
    schemaVersion: 'pixiu.core-research/workspace-evidence-v1',
    taskId: task.taskId,
    taskDigest: task.integrity.value,
    scannedAt: '2026-07-23T04:00:00.000Z',
    workspace: {
      path: task.workspace.worktreePath,
      head: task.source.commitSha,
      origin: task.source.canonicalUri,
    },
    limits: { maxFiles: 5000, maxFileBytes: 1048576, maxTotalBytes: 52428800 },
    statistics: { scannedFiles: 3, scannedBytes: 100, skippedFiles: 0 },
    skipped: [],
    checks: {
      license: { status: 'PASS', findings: [] },
      secret: { status: 'PASS', findings: [] },
      static: { status: 'FINDINGS', findings: [{
        code: 'STATIC_EVAL',
        severity: 'HIGH',
        path: 'src/a.js',
        line: 2,
        summary: '危險 | <b>eval</b>',
      }] },
      supplyChain: { status: 'PASS', findings: [] },
      promptInjection: { status: 'PASS', findings: [] },
    },
    ...overrides,
  };
}

test('產生 evidence、security report 與 integration spec', async () => {
  const task = createTask();
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'pixiu-review-report-'));
  const sandbox = validateSandboxEvidence(task, {
    taskId: task.taskId,
    taskDigest: task.integrity.value,
    status: 'SKIPPED_UNAVAILABLE',
    recordedAt: '2026-07-23T05:00:00Z',
    reason: '無可驗證網路隔離。',
  });

  const result = await writeEvaluationReview({
    task,
    workspaceEvidence: workspaceEvidence(task),
    sandboxEvidence: sandbox,
    outputDir,
  });

  assert.equal(result.reviewState, 'REVIEW_READY_WITH_CONCERNS');
  assert.equal(result.recommendation, 'Reject');
  assert.deepEqual(Object.keys(result.files).sort(), ['evidence', 'integrationSpec', 'securityReport']);
  const evidence = JSON.parse(await readFile(result.files.evidence, 'utf8'));
  assert.equal(evidence.taskId, task.taskId);
  assert.ok(evidence.concerns.includes('SANDBOX_UNAVAILABLE'));
});

test('Markdown 清理外部 HTML、表格符號與換行', async () => {
  const task = createTask();
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'pixiu-review-sanitize-'));
  const sandbox = validateSandboxEvidence(task, {
    taskId: task.taskId,
    taskDigest: task.integrity.value,
    status: 'SKIPPED_UNAVAILABLE',
    recordedAt: '2026-07-23T05:00:00Z',
    reason: '無 Sandbox。',
  });

  const result = await writeEvaluationReview({
    task,
    workspaceEvidence: workspaceEvidence(task),
    sandboxEvidence: sandbox,
    outputDir,
  });
  const report = await readFile(result.files.securityReport, 'utf8');
  const spec = await readFile(result.files.integrationSpec, 'utf8');

  assert.equal(report.includes('<script>'), false);
  assert.equal(report.includes('<b>'), false);
  assert.equal(report.includes('危險 |'), false);
  assert.equal(spec.includes('<script>'), false);
  assert.ok(report.includes('危險 / &lt;b&gt;eval&lt;/b&gt;'));
});

test('無發現且 Sandbox PASS 時保留原始 Integrate Proposed', async () => {
  const task = createTask();
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'pixiu-review-pass-'));
  const cleanWorkspace = workspaceEvidence(task, {
    checks: {
      license: { status: 'PASS', findings: [] },
      secret: { status: 'PASS', findings: [] },
      static: { status: 'PASS', findings: [] },
      supplyChain: { status: 'PASS', findings: [] },
      promptInjection: { status: 'PASS', findings: [] },
    },
  });
  const sandbox = validateSandboxEvidence(task, {
    taskId: task.taskId,
    taskDigest: task.integrity.value,
    status: 'PASS',
    command: ['node', '--test'],
    recordedAt: '2026-07-23T05:00:00Z',
    durationMs: 100,
    exitCode: 0,
    timedOut: false,
    outputBytes: 100,
    networkIsolated: true,
    secretsAvailable: false,
    workspaceOnly: true,
  });

  const result = await writeEvaluationReview({
    task,
    workspaceEvidence: cleanWorkspace,
    sandboxEvidence: sandbox,
    outputDir,
  });

  assert.equal(result.reviewState, 'REVIEW_READY');
  assert.equal(result.recommendation, 'Integrate Proposed');
  assert.deepEqual(result.concerns, []);
});

test('Workspace evidence 與 Task 不一致時拒絕', async () => {
  const task = createTask();
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'pixiu-review-mismatch-'));
  const sandbox = validateSandboxEvidence(task, {
    taskId: task.taskId,
    taskDigest: task.integrity.value,
    status: 'SKIPPED_UNAVAILABLE',
    recordedAt: '2026-07-23T05:00:00Z',
    reason: '無 Sandbox。',
  });

  await assert.rejects(
    () => writeEvaluationReview({
      task,
      workspaceEvidence: workspaceEvidence(task, { taskId: 'evaluation-other' }),
      sandboxEvidence: sandbox,
      outputDir,
    }),
    (error) => error.code === 'WORKSPACE_EVIDENCE_TASK_MISMATCH',
  );
});
