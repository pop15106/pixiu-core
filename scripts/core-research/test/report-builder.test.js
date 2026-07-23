'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { mkdtemp, readFile } = require('node:fs/promises');

const { normalizeCandidate } = require('../candidate-schema');
const { selectWeeklyCandidates } = require('../weekly-selector');
const { writeWeeklyReport } = require('../report-builder');

function createCandidate({ id, score, title, category = 'ai-sdlc' }) {
  return normalizeCandidate({
    resourceType: 'repository',
    title: title || `Candidate ${id}`,
    canonicalUri: `https://github.com/example/${id}`,
    publisher: 'Example',
    publishedAt: '2026-07-20T00:00:00Z',
    updatedAt: '2026-07-25T00:00:00Z',
    discoveredAt: '2026-07-25T02:30:00Z',
    commitSha: id.padEnd(40, 'a').slice(0, 40).replace(/[^a-f0-9]/gi, 'a'),
    license: 'MIT',
    categories: [category],
    summary: `摘要 ${id}`,
    evidence: [{ source: `https://github.com/example/${id}`, note: '證據' }],
    metrics: {
      coreFit: score,
      expectedValue: score,
      novelty: score,
      maturity: score,
      feasibility: score,
      evidenceQuality: score,
      trust: score,
    },
  });
}

async function createOutputDirectory() {
  return mkdtemp(path.join(os.tmpdir(), 'pixiu-report-'));
}

test('產生 selected.json、rejected.json 與 weekly-report.md', async () => {
  const selection = selectWeeklyCandidates([
    createCandidate({ id: 'selected', score: 90 }),
    createCandidate({ id: 'rejected', score: 60, category: 'security-testing' }),
  ], {
    now: '2026-07-26T02:30:00.000Z',
    days: 7,
    minimumScore: 70,
    totalLimit: 5,
    perCategoryLimit: 2,
  });
  const outputDir = await createOutputDirectory();

  const result = await writeWeeklyReport({ outputDir, selection });

  assert.equal(result.outputDir, path.resolve(outputDir));
  assert.deepEqual(Object.keys(result.files).sort(), [
    'rejected',
    'report',
    'selected',
  ]);

  const selected = JSON.parse(await readFile(result.files.selected, 'utf8'));
  const rejected = JSON.parse(await readFile(result.files.rejected, 'utf8'));
  const report = await readFile(result.files.report, 'utf8');

  assert.equal(selected.schemaVersion, 'pixiu.core-research/weekly-selection-v1');
  assert.equal(selected.items.length, 1);
  assert.equal(rejected.items.length, 1);
  assert.ok(report.includes('# PixiuCore 核心候選週評估'));
  assert.ok(report.includes('Candidate selected'));
  assert.ok(report.includes('SCORE_BELOW_THRESHOLD'));
  assert.ok(report.includes('最近 7 天'));
});

test('JSON 使用兩格縮排並保留結尾換行', async () => {
  const selection = selectWeeklyCandidates([
    createCandidate({ id: 'selected', score: 90 }),
  ], {
    now: '2026-07-26T02:30:00.000Z',
  });
  const outputDir = await createOutputDirectory();
  const result = await writeWeeklyReport({ outputDir, selection });
  const selectedText = await readFile(result.files.selected, 'utf8');

  assert.ok(selectedText.includes('\n  "schemaVersion"'));
  assert.ok(selectedText.endsWith('\n'));
});

test('Markdown 清理表格符號、換行與原始 HTML', async () => {
  const selection = selectWeeklyCandidates([
    createCandidate({
      id: 'unsafe',
      score: 90,
      title: '<script>alert(1)</script>|第一行\n第二行',
    }),
  ], {
    now: '2026-07-26T02:30:00.000Z',
  });
  const outputDir = await createOutputDirectory();
  const result = await writeWeeklyReport({ outputDir, selection });
  const report = await readFile(result.files.report, 'utf8');

  assert.ok(report.includes('&lt;script&gt;alert(1)&lt;/script&gt;/第一行 第二行'));
  assert.ok(!report.includes('<script>'));
});

test('拒絕缺少 selection 或 outputDir 的輸入', async () => {
  await assert.rejects(
    () => writeWeeklyReport({ outputDir: '', selection: {} }),
    (error) => error.code === 'REPORT_INPUT_INVALID',
  );
  await assert.rejects(
    () => writeWeeklyReport({ outputDir: 'tmp' }),
    (error) => error.code === 'REPORT_INPUT_INVALID',
  );
});
