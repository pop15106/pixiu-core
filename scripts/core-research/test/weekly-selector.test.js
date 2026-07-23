'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeCandidate } = require('../candidate-schema');
const { selectWeeklyCandidates } = require('../weekly-selector');

const NOW = '2026-07-26T02:30:00.000Z';

function createCandidate({
  id,
  category = 'ai-sdlc',
  discoveredAt = '2026-07-25T02:30:00Z',
  updatedAt = '2026-07-25T01:00:00Z',
  score = 80,
  evidenceQuality = score,
  coreFit = score,
  expectedValue = score,
  riskFlags = [],
  commitSha,
} = {}) {
  const suffix = id || Math.random().toString(16).slice(2);
  return normalizeCandidate({
    resourceType: 'repository',
    title: `Candidate ${suffix}`,
    canonicalUri: `https://github.com/example/${suffix}`,
    publisher: 'Example',
    publishedAt: '2026-07-20T00:00:00Z',
    updatedAt,
    discoveredAt,
    commitSha: commitSha || suffix.padEnd(40, 'a').slice(0, 40).replace(/[^a-f0-9]/gi, 'a'),
    license: 'MIT',
    categories: [category],
    summary: `候選 ${suffix}`,
    evidence: [{ source: `https://github.com/example/${suffix}`, note: '證據' }],
    metrics: {
      coreFit,
      expectedValue,
      novelty: score,
      maturity: score,
      feasibility: score,
      evidenceQuality,
      trust: score,
    },
    riskFlags,
  });
}

function select(candidates, overrides = {}) {
  return selectWeeklyCandidates(candidates, {
    now: NOW,
    days: 7,
    minimumScore: 70,
    totalLimit: 5,
    perCategoryLimit: 2,
    ...overrides,
  });
}

test('八天前與未來候選排除為 OUTSIDE_TIME_WINDOW', () => {
  const result = select([
    createCandidate({ id: 'old', discoveredAt: '2026-07-18T02:29:59Z', score: 90 }),
    createCandidate({ id: 'future', discoveredAt: '2026-07-26T02:30:01Z', score: 90 }),
  ]);

  assert.equal(result.selected.length, 0);
  assert.equal(result.rejected.length, 2);
  assert.ok(result.rejected.every((item) => item.reasonCodes.includes('OUTSIDE_TIME_WINDOW')));
});

test('低於最低分數的候選排除為 SCORE_BELOW_THRESHOLD', () => {
  const result = select([createCandidate({ id: 'low', score: 69 })]);

  assert.equal(result.selected.length, 0);
  assert.deepEqual(result.rejected[0].reasonCodes, ['SCORE_BELOW_THRESHOLD']);
});

test('來源阻擋候選排除為 SOURCE_BLOCKED', () => {
  const result = select([
    createCandidate({ id: 'blocked', score: 100, riskFlags: ['SOURCE_BLOCKED'] }),
  ]);

  assert.equal(result.selected.length, 0);
  assert.deepEqual(result.rejected[0].reasonCodes, ['SOURCE_BLOCKED']);
});

test('相同 Canonical Key 只保留分數較高的一項', () => {
  const high = createCandidate({ id: 'duplicate', score: 90 });
  const lowInput = {
    ...high,
    metrics: {
      ...high.metrics,
      coreFit: 75,
      expectedValue: 75,
      novelty: 75,
      maturity: 75,
      feasibility: 75,
      evidenceQuality: 75,
      trust: 75,
    },
  };
  const low = normalizeCandidate(lowInput);
  const result = select([low, high]);

  assert.equal(result.selected.length, 1);
  assert.equal(result.selected[0].score.totalScore, 90);
  assert.equal(result.rejected.length, 1);
  assert.deepEqual(result.rejected[0].reasonCodes, ['DUPLICATE_RESOURCE']);
});

test('同分類最多選兩項，其餘標記 CATEGORY_QUOTA_REACHED', () => {
  const result = select([
    createCandidate({ id: 'a1', category: 'ai-sdlc', score: 95 }),
    createCandidate({ id: 'a2', category: 'ai-sdlc', score: 90 }),
    createCandidate({ id: 'a3', category: 'ai-sdlc', score: 85 }),
  ]);

  assert.equal(result.selected.length, 2);
  assert.equal(result.rejected.length, 1);
  assert.deepEqual(result.rejected[0].reasonCodes, ['CATEGORY_QUOTA_REACHED']);
});

test('全週最多選五項，其餘標記 TOTAL_LIMIT_REACHED', () => {
  const candidates = [
    createCandidate({ id: 'c1', category: 'skill-agent', score: 99 }),
    createCandidate({ id: 'c2', category: 'skill-agent', score: 98 }),
    createCandidate({ id: 'c3', category: 'ai-sdlc', score: 97 }),
    createCandidate({ id: 'c4', category: 'ai-sdlc', score: 96 }),
    createCandidate({ id: 'c5', category: 'security-testing', score: 95 }),
    createCandidate({ id: 'c6', category: 'tool-integration', score: 94 }),
  ];
  const result = select(candidates);

  assert.equal(result.selected.length, 5);
  assert.equal(result.rejected.length, 1);
  assert.deepEqual(result.rejected[0].reasonCodes, ['TOTAL_LIMIT_REACHED']);
});

test('同分依證據品質、核心關聯、更新時間與 candidateId 穩定排序', () => {
  const result = select([
    createCandidate({
      id: 'late-id',
      category: 'security-testing',
      score: 80,
      evidenceQuality: 80,
      coreFit: 80,
      updatedAt: '2026-07-24T00:00:00Z',
    }),
    createCandidate({
      id: 'best-evidence',
      category: 'tool-integration',
      score: 80,
      evidenceQuality: 90,
      coreFit: 70,
      expectedValue: 87.5,
    }),
    createCandidate({
      id: 'best-core',
      category: 'ai-sdlc',
      score: 80,
      evidenceQuality: 80,
      coreFit: 90,
      expectedValue: 67.5,
    }),
    createCandidate({
      id: 'newer',
      category: 'skill-agent',
      score: 80,
      evidenceQuality: 80,
      coreFit: 80,
      updatedAt: '2026-07-25T00:00:00Z',
    }),
  ], { totalLimit: 4, perCategoryLimit: 4 });

  assert.deepEqual(
    result.selected.map((item) => item.candidate.title),
    ['Candidate best-evidence', 'Candidate best-core', 'Candidate newer', 'Candidate late-id'],
  );
});

test('回傳不可變結果與完整統計', () => {
  const result = select([
    createCandidate({ id: 'one', category: 'ai-sdlc', score: 90 }),
    createCandidate({ id: 'two', category: 'security-testing', score: 60 }),
  ]);

  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.selected));
  assert.ok(Object.isFrozen(result.rejected));
  assert.equal(result.statistics.considered, 2);
  assert.equal(result.statistics.selected, 1);
  assert.equal(result.statistics.rejected, 1);
  assert.deepEqual(result.statistics.byCategory, { 'ai-sdlc': 1 });
  assert.ok(result.rejected.every((item) => item.reasonCodes.length > 0));
});
