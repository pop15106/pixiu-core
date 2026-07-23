'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} = require('node:fs/promises');

const { normalizeCandidate } = require('../candidate-schema');
const { scoreCandidate } = require('../candidate-scorer');

const CLI_PATH = path.resolve(__dirname, '..', 'cli.js');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: options.cwd,
    encoding: 'utf8',
    timeout: 30000,
  });
}

function runGit(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
}

async function createSourceRepository(root) {
  const sourceRepo = path.join(root, 'source-repo');
  await mkdir(sourceRepo, { recursive: true });
  runGit(sourceRepo, ['init']);
  runGit(sourceRepo, ['config', 'user.email', 'fixture@example.com']);
  runGit(sourceRepo, ['config', 'user.name', 'Fixture']);
  await writeFile(path.join(sourceRepo, 'LICENSE'), 'MIT License\n', 'utf8');
  await writeFile(path.join(sourceRepo, 'README.md'), '# Fixture\n', 'utf8');
  await writeFile(path.join(sourceRepo, 'safe.js'), "'use strict';\nmodule.exports = 1;\n", 'utf8');
  runGit(sourceRepo, ['add', '.']);
  runGit(sourceRepo, ['commit', '-m', 'fixture']);
  return {
    sourceRepo,
    commitSha: runGit(sourceRepo, ['rev-parse', 'HEAD']),
  };
}

async function createSelectedJson(root, commitSha) {
  const candidate = normalizeCandidate({
    resourceType: 'repository',
    title: 'CLI Evaluation Fixture',
    canonicalUri: 'https://github.com/example/evaluation-fixture',
    publisher: 'example',
    publishedAt: '2026-07-20T00:00:00Z',
    updatedAt: '2026-07-23T00:00:00Z',
    discoveredAt: '2026-07-23T02:00:00Z',
    commitSha,
    license: 'MIT',
    categories: ['security-testing'],
    summary: 'CLI 評估流程測試',
    evidence: [{ source: 'https://github.com/example/evaluation-fixture', note: 'fixture' }],
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
  const selectedPath = path.join(root, 'selected.json');
  await writeFile(selectedPath, JSON.stringify({
    schemaVersion: 'pixiu.core-research/weekly-selection-v1',
    items: [{ candidate, score: scoreCandidate(candidate) }],
  }, null, 2), 'utf8');
  return selectedPath;
}

test('CLI 完成 prepare、scan、record、approve 端對端流程', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pixiu-evaluation-cli-'));
  const { sourceRepo, commitSha } = await createSourceRepository(root);
  const selectedPath = await createSelectedJson(root, commitSha);
  const stateRoot = path.join(root, 'state');
  const artifactRoot = path.join(root, 'artifacts');
  const tasksDir = path.join(root, 'tasks');
  const ledgerPath = path.join(root, 'ledger.jsonl');

  const prepared = runCli([
    'prepare-evaluations',
    '--selected', selectedPath,
    '--output', tasksDir,
    '--state-root', stateRoot,
    '--artifact-root', artifactRoot,
    '--ledger', ledgerPath,
    '--created-at', '2026-07-23T03:00:00Z',
  ]);
  assert.equal(prepared.status, 0, prepared.stderr);

  const summary = JSON.parse(await readFile(path.join(tasksDir, 'prepare-summary.json'), 'utf8'));
  assert.equal(summary.prepared.length, 1);
  const taskPath = summary.prepared[0].taskPath;
  const task = JSON.parse(await readFile(taskPath, 'utf8'));

  await mkdir(path.dirname(task.workspace.worktreePath), { recursive: true });
  runGit(root, ['clone', sourceRepo, task.workspace.worktreePath]);
  runGit(task.workspace.worktreePath, [
    'remote',
    'set-url',
    'origin',
    task.source.canonicalUri,
  ]);

  const workspaceEvidencePath = path.join(root, 'workspace-evidence.json');
  const scanned = runCli([
    'evaluate-workspace',
    '--task', taskPath,
    '--workspace', task.workspace.worktreePath,
    '--output', workspaceEvidencePath,
    '--scanned-at', '2026-07-23T04:00:00Z',
  ]);
  assert.equal(scanned.status, 0, scanned.stderr);
  assert.equal(JSON.parse(await readFile(workspaceEvidencePath, 'utf8')).taskId, task.taskId);

  const sandboxPath = path.join(root, 'sandbox.json');
  await writeFile(sandboxPath, JSON.stringify({
    taskId: task.taskId,
    taskDigest: task.integrity.value,
    status: 'SKIPPED_UNAVAILABLE',
    recordedAt: '2026-07-23T05:00:00Z',
    reason: 'Fixture 主機沒有 OS 級網路隔離。',
  }, null, 2), 'utf8');

  const recorded = runCli([
    'record-evidence',
    '--task', taskPath,
    '--workspace-evidence', workspaceEvidencePath,
    '--sandbox-evidence', sandboxPath,
    '--output', task.artifactDir,
    '--ledger', ledgerPath,
    '--recorded-at', '2026-07-23T05:01:00Z',
  ]);
  assert.equal(recorded.status, 0, recorded.stderr);
  assert.ok((await readFile(path.join(task.artifactDir, 'security-report.md'), 'utf8')).includes('AWAITING_APPROVAL'));

  const statusBeforePath = path.join(root, 'status-before.json');
  const statusBefore = runCli([
    'evaluation-status',
    '--ledger', ledgerPath,
    '--output', statusBeforePath,
  ]);
  assert.equal(statusBefore.status, 0, statusBefore.stderr);
  assert.equal(
    JSON.parse(await readFile(statusBeforePath, 'utf8')).tasks[task.taskId].state,
    'AWAITING_APPROVAL',
  );

  const approved = runCli([
    'approve',
    '--ledger', ledgerPath,
    '--task-id', task.taskId,
    '--decision', 'approve-plan',
    '--by', 'human:7010',
    '--comment', '核准另開正式實作計畫。',
    '--decided-at', '2026-07-23T06:00:00Z',
  ]);
  assert.equal(approved.status, 0, approved.stderr);

  const statusAfterPath = path.join(root, 'status-after.json');
  const statusAfter = runCli([
    'evaluation-status',
    '--ledger', ledgerPath,
    '--output', statusAfterPath,
  ]);
  assert.equal(statusAfter.status, 0, statusAfter.stderr);
  assert.equal(
    JSON.parse(await readFile(statusAfterPath, 'utf8')).tasks[task.taskId].state,
    'APPROVED_FOR_PLAN',
  );
});

test('prepare-evaluations 會跳過不可 checkout 的項目', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pixiu-evaluation-skip-'));
  const candidate = normalizeCandidate({
    resourceType: 'article',
    title: 'Article',
    canonicalUri: 'https://example.com/article',
    publisher: 'example',
    publishedAt: '2026-07-20T00:00:00Z',
    discoveredAt: '2026-07-23T02:00:00Z',
    license: 'UNKNOWN',
    categories: ['ai-sdlc'],
    summary: '只供參考',
    evidence: [{ source: 'https://example.com/article', note: 'article' }],
    metrics: {
      coreFit: 80,
      expectedValue: 80,
      novelty: 80,
      maturity: 80,
      feasibility: 80,
      evidenceQuality: 80,
      trust: 80,
    },
    riskFlags: [],
  });
  const selectedPath = path.join(root, 'selected.json');
  await writeFile(selectedPath, JSON.stringify({
    items: [{ candidate, score: scoreCandidate(candidate) }],
  }), 'utf8');

  const result = runCli([
    'prepare-evaluations',
    '--selected', selectedPath,
    '--output', path.join(root, 'tasks'),
    '--state-root', path.join(root, 'state'),
    '--artifact-root', path.join(root, 'artifacts'),
    '--ledger', path.join(root, 'ledger.jsonl'),
  ]);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(await readFile(path.join(root, 'tasks', 'prepare-summary.json'), 'utf8'));
  assert.equal(summary.prepared.length, 0);
  assert.equal(summary.skipped.length, 1);
  assert.ok(summary.skipped[0].reasonCodes.includes('REPOSITORY_REQUIRED'));
});
