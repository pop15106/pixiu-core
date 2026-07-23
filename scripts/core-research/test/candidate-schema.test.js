'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeCandidate,
  isFullCommitSha,
} = require('../candidate-schema');

function createRepositoryCandidate(overrides = {}) {
  return {
    resourceType: 'repository',
    title: 'Example Repo',
    canonicalUri: 'HTTPS://GITHUB.COM/Example/Repo/',
    publisher: 'Example',
    publishedAt: '2026-07-20T00:00:00Z',
    updatedAt: '2026-07-22T00:00:00Z',
    discoveredAt: '2026-07-23T02:00:00Z',
    commitSha: 'a'.repeat(40),
    license: 'MIT',
    categories: ['ai-sdlc'],
    summary: '候選摘要',
    evidence: [{
      source: 'https://github.com/Example/Repo',
      note: '最近有更新',
    }],
    metrics: {
      coreFit: 90,
      expectedValue: 80,
      novelty: 70,
      maturity: 60,
      feasibility: 80,
      evidenceQuality: 75,
      trust: 85,
    },
    ...overrides,
  };
}

test('正規化完整 Repo 候選並固定不可變資料', () => {
  const input = createRepositoryCandidate();
  const candidate = normalizeCandidate(input);

  assert.equal(candidate.schemaVersion, 'pixiu.core-research/candidate-v1');
  assert.equal(candidate.canonicalUri, 'https://github.com/Example/Repo');
  assert.equal(candidate.commitSha, 'a'.repeat(40));
  assert.equal(candidate.license, 'MIT');
  assert.match(candidate.candidateId, /^candidate-[a-f0-9]{16}$/);
  assert.ok(Object.isFrozen(candidate));
  assert.ok(Object.isFrozen(candidate.categories));
  assert.ok(Object.isFrozen(candidate.evidence));
  assert.ok(Object.isFrozen(candidate.metrics));
  assert.equal(input.canonicalUri, 'HTTPS://GITHUB.COM/Example/Repo/');
});

test('Repo 可以先以未固定版本進入候選資料層', () => {
  const candidate = normalizeCandidate(createRepositoryCandidate({
    commitSha: undefined,
  }));

  assert.equal(candidate.commitSha, null);
});

test('拒絕非 HTTP／HTTPS 或內嵌帳密的 URI', () => {
  assert.throws(
    () => normalizeCandidate(createRepositoryCandidate({
      canonicalUri: 'file:///tmp/repo',
    })),
    (error) => error.code === 'CANDIDATE_URI_INVALID',
  );
  assert.throws(
    () => normalizeCandidate(createRepositoryCandidate({
      canonicalUri: 'https://user:password@example.com/repo',
    })),
    (error) => error.code === 'CANDIDATE_URI_CREDENTIALS_FORBIDDEN',
  );
});

test('拒絕缺少必要欄位或空分類', () => {
  assert.throws(
    () => normalizeCandidate(createRepositoryCandidate({ title: '' })),
    (error) => error.code === 'CANDIDATE_FIELD_REQUIRED',
  );
  assert.throws(
    () => normalizeCandidate(createRepositoryCandidate({ categories: [] })),
    (error) => error.code === 'CANDIDATE_CATEGORIES_INVALID',
  );
});

test('拒絕超出 0 到 100 的評分維度', () => {
  assert.throws(
    () => normalizeCandidate(createRepositoryCandidate({
      metrics: {
        ...createRepositoryCandidate().metrics,
        trust: 101,
      },
    })),
    (error) => error.code === 'CANDIDATE_METRICS_INVALID',
  );
});

test('Repo Commit SHA 存在時必須是完整 40 字元十六進位', () => {
  assert.equal(isFullCommitSha('a'.repeat(40)), true);
  assert.equal(isFullCommitSha('A'.repeat(40)), true);
  assert.equal(isFullCommitSha('a'.repeat(39)), false);
  assert.equal(isFullCommitSha('z'.repeat(40)), false);

  assert.throws(
    () => normalizeCandidate(createRepositoryCandidate({
      commitSha: 'abc123',
    })),
    (error) => error.code === 'CANDIDATE_COMMIT_INVALID',
  );
});

test('空白授權正規化為 UNKNOWN 並清理分類重複值', () => {
  const candidate = normalizeCandidate(createRepositoryCandidate({
    license: '   ',
    categories: ['ai-sdlc', 'ai-sdlc', 'security-testing'],
  }));

  assert.equal(candidate.license, 'UNKNOWN');
  assert.deepEqual(candidate.categories, ['ai-sdlc', 'security-testing']);
});

test('拒絕不合法日期與缺少證據', () => {
  assert.throws(
    () => normalizeCandidate(createRepositoryCandidate({
      discoveredAt: 'not-a-date',
    })),
    (error) => error.code === 'CANDIDATE_DATE_INVALID',
  );
  assert.throws(
    () => normalizeCandidate(createRepositoryCandidate({
      evidence: [],
    })),
    (error) => error.code === 'CANDIDATE_EVIDENCE_INVALID',
  );
});
