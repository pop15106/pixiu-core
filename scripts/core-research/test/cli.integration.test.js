'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { existsSync } = require('node:fs');
const { mkdtemp, writeFile } = require('node:fs/promises');
const { spawnSync } = require('node:child_process');

const CLI_PATH = path.resolve(__dirname, '..', 'cli.js');

function createCandidate() {
  return {
    resourceType: 'repository',
    title: 'CLI Candidate',
    canonicalUri: 'https://github.com/example/cli-candidate',
    publisher: 'Example',
    publishedAt: '2026-07-20T00:00:00Z',
    updatedAt: '2026-07-25T00:00:00Z',
    discoveredAt: '2026-07-25T02:30:00Z',
    commitSha: 'c'.repeat(40),
    license: 'MIT',
    categories: ['ai-sdlc'],
    summary: 'CLI 端對端候選',
    evidence: [{
      source: 'https://github.com/example/cli-candidate',
      note: '測試證據',
    }],
    metrics: {
      coreFit: 90,
      expectedValue: 90,
      novelty: 90,
      maturity: 90,
      feasibility: 90,
      evidenceQuality: 90,
      trust: 90,
    },
  };
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  });
}

async function createPaths() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pixiu-cli-'));
  return {
    directory,
    inputPath: path.join(directory, 'input.json'),
    registryPath: path.join(directory, 'registry.jsonl'),
    outputDir: path.join(directory, 'weekly'),
  };
}

test('CLI 完成 import 到 weekly-select 的端對端流程', async () => {
  const paths = await createPaths();
  await writeFile(paths.inputPath, JSON.stringify([createCandidate()]), 'utf8');

  const importResult = runCli([
    'import',
    '--input', paths.inputPath,
    '--registry', paths.registryPath,
    '--imported-at', '2026-07-25T03:00:00Z',
  ]);

  assert.equal(importResult.status, 0, importResult.stderr);
  assert.ok(importResult.stdout.includes('匯入 1 項'));
  assert.ok(existsSync(paths.registryPath));

  const selectResult = runCli([
    'weekly-select',
    '--registry', paths.registryPath,
    '--output', paths.outputDir,
    '--now', '2026-07-26T02:30:00.000Z',
  ]);

  assert.equal(selectResult.status, 0, selectResult.stderr);
  assert.ok(selectResult.stdout.includes('入選 1 項'));
  assert.ok(existsSync(path.join(paths.outputDir, 'selected.json')));
  assert.ok(existsSync(path.join(paths.outputDir, 'rejected.json')));
  assert.ok(existsSync(path.join(paths.outputDir, 'weekly-report.md')));
});

test('import 支援單一候選物件', async () => {
  const paths = await createPaths();
  await writeFile(paths.inputPath, JSON.stringify(createCandidate()), 'utf8');

  const result = runCli([
    'import',
    '--input', paths.inputPath,
    '--registry', paths.registryPath,
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes('匯入 1 項'));
});

test('不合法 JSON 以簡短錯誤碼結束且不輸出 Stack Trace', async () => {
  const paths = await createPaths();
  await writeFile(paths.inputPath, '{not-json', 'utf8');

  const result = runCli([
    'import',
    '--input', paths.inputPath,
    '--registry', paths.registryPath,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /^CORE_RESEARCH_ERROR INPUT_JSON_INVALID:/);
  assert.ok(!result.stderr.includes('\n    at '));
});

test('未知命令回傳 COMMAND_UNSUPPORTED', () => {
  const result = runCli(['unknown-command']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /^CORE_RESEARCH_ERROR COMMAND_UNSUPPORTED:/);
  assert.ok(!result.stderr.includes('\n    at '));
});

test('缺少必要參數時回傳 ARGUMENT_REQUIRED', () => {
  const result = runCli(['import', '--input', 'candidate.json']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /^CORE_RESEARCH_ERROR ARGUMENT_REQUIRED:/);
});
