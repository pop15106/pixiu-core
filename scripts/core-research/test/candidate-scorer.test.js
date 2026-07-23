'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeCandidate } = require('../candidate-schema');
const { scoreCandidate } = require('../candidate-scorer');

function createCandidate(overrides = {}) {
  const base = {
    resourceType: 'repository',
    title: 'Example Repo',
    canonicalUri: 'https://github.com/example/repo',
    publisher: 'Example',
    publishedAt: '2026-07-20T00:00:00Z',
    updatedAt: '2026-07-22T00:00:00Z',
    discoveredAt: '2026-07-23T02:00:00Z',
    commitSha: 'a'.repeat(40),
    license: 'MIT',
    categories: ['ai-sdlc'],
    summary: '候選摘要',
    evidence: [{ source: 'https://github.com/example/repo', note: '最近有更新' }],
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
  };

  return normalizeCandidate({
    ...base,
    ...overrides,
    metrics: {
      ...base.metrics,
      ...(overrides.metrics || {}),
    },
  });
}

test('使用固定權重計算可重現的兩位小數總分', () => {
  const candidate = createCandidate({
    metrics: {
      coreFit: 90,
      expectedValue: 80,
      novelty: 70,
      maturity: 60,
      feasibility: 50,
      evidenceQuality: 40,
      trust: 30,
    },
  });

  const first = scoreCandidate(candidate);
  const second = scoreCandidate(candidate);

  assert.equal(first.totalScore, 67);
  assert.deepEqual(first, second);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.reasonCodes));
  assert.equal(first.weightedMetrics.coreFit, 22.5);
});

test('高分且版本與授權完整的 Repo 為 Integrate Proposed', () => {
  const result = scoreCandidate(createCandidate({
    metrics: {
      coreFit: 95,
      expectedValue: 90,
      novelty: 90,
      maturity: 85,
      feasibility: 90,
      evidenceQuality: 90,
      trust: 95,
    },
  }));

  assert.equal(result.totalScore, 91.25);
  assert.equal(result.disposition, 'Integrate Proposed');
  assert.deepEqual(result.reasonCodes, []);
});

test('Repo 缺少完整 Commit SHA 時最多只能 Extract', () => {
  const result = scoreCandidate(createCandidate({
    commitSha: undefined,
    metrics: {
      coreFit: 95,
      expectedValue: 95,
      novelty: 95,
      maturity: 95,
      feasibility: 95,
      evidenceQuality: 95,
      trust: 95,
    },
  }));

  assert.equal(result.disposition, 'Extract');
  assert.ok(result.reasonCodes.includes('MISSING_COMMIT_SHA'));
});

test('License UNKNOWN 時最多只能 Reference', () => {
  const result = scoreCandidate(createCandidate({
    license: 'UNKNOWN',
    metrics: {
      coreFit: 95,
      expectedValue: 95,
      novelty: 95,
      maturity: 95,
      feasibility: 95,
      evidenceQuality: 95,
      trust: 95,
    },
  }));

  assert.equal(result.disposition, 'Reference');
  assert.ok(result.reasonCodes.includes('LICENSE_UNKNOWN'));
});

test('來源被阻擋時不論分數都 Reject', () => {
  const result = scoreCandidate(createCandidate({
    riskFlags: ['SOURCE_BLOCKED'],
    metrics: {
      coreFit: 100,
      expectedValue: 100,
      novelty: 100,
      maturity: 100,
      feasibility: 100,
      evidenceQuality: 100,
      trust: 100,
    },
  }));

  assert.equal(result.totalScore, 100);
  assert.equal(result.disposition, 'Reject');
  assert.ok(result.reasonCodes.includes('SOURCE_BLOCKED'));
});

test('分數區間映射到穩定處理方式', () => {
  assert.equal(scoreCandidate(createCandidate({
    metrics: {
      coreFit: 49,
      expectedValue: 49,
      novelty: 49,
      maturity: 49,
      feasibility: 49,
      evidenceQuality: 49,
      trust: 49,
    },
  })).disposition, 'Reject');

  assert.equal(scoreCandidate(createCandidate({
    metrics: {
      coreFit: 60,
      expectedValue: 60,
      novelty: 60,
      maturity: 60,
      feasibility: 60,
      evidenceQuality: 60,
      trust: 60,
    },
  })).disposition, 'Reference');

  assert.equal(scoreCandidate(createCandidate({
    metrics: {
      coreFit: 75,
      expectedValue: 75,
      novelty: 75,
      maturity: 75,
      feasibility: 75,
      evidenceQuality: 75,
      trust: 75,
    },
  })).disposition, 'Extract');
});
