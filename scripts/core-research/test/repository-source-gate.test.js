'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeCandidate } = require('../candidate-schema');
const { scoreCandidate } = require('../candidate-scorer');
const { evaluateRepositoryCandidate } = require('../repository-source-gate');

function createCandidate(overrides = {}) {
  return normalizeCandidate({
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
}

function selectionEntry(candidate) {
  return { candidate, score: scoreCandidate(candidate) };
}

test('合法 GitHub Repo 可以建立 checkout 任務', () => {
  const result = evaluateRepositoryCandidate(selectionEntry(createCandidate()));

  assert.equal(result.decision, 'CHECKOUT_ALLOWED');
  assert.deepEqual(result.reasonCodes, []);
  assert.equal(result.source.owner, 'example');
  assert.equal(result.source.repository, 'repo');
  assert.equal(result.source.canonicalUri, 'https://github.com/example/repo');
});

test('缺完整 Commit SHA 的 Repo 只能保留為參考', () => {
  const result = evaluateRepositoryCandidate(selectionEntry(createCandidate({ commitSha: null })));

  assert.equal(result.decision, 'REFERENCE_ONLY');
  assert.ok(result.reasonCodes.includes('MISSING_COMMIT_SHA'));
});

test('License UNKNOWN 的 Repo 只能保留為參考', () => {
  const result = evaluateRepositoryCandidate(selectionEntry(createCandidate({ license: 'UNKNOWN' })));

  assert.equal(result.decision, 'REFERENCE_ONLY');
  assert.ok(result.reasonCodes.includes('LICENSE_UNKNOWN'));
});

test('阻擋型風險 Repo 直接拒絕', () => {
  const result = evaluateRepositoryCandidate(selectionEntry(createCandidate({
    riskFlags: ['INTEGRITY_MISMATCH'],
  })));

  assert.equal(result.decision, 'REJECTED');
  assert.deepEqual(result.reasonCodes, ['INTEGRITY_MISMATCH']);
});

test('非 GitHub canonical Repo 不可建立 checkout 任務', () => {
  const result = evaluateRepositoryCandidate(selectionEntry(createCandidate({
    canonicalUri: 'https://gitlab.com/example/repo',
  })));

  assert.equal(result.decision, 'REFERENCE_ONLY');
  assert.ok(result.reasonCodes.includes('GITHUB_CANONICAL_REQUIRED'));
});

test('GitHub URL 不可包含 query、fragment 或額外路徑', () => {
  const query = evaluateRepositoryCandidate(selectionEntry(createCandidate({
    canonicalUri: 'https://github.com/example/repo?tab=readme',
  })));
  const extraPath = evaluateRepositoryCandidate(selectionEntry(createCandidate({
    canonicalUri: 'https://github.com/example/repo/tree/main',
  })));

  assert.equal(query.decision, 'REFERENCE_ONLY');
  assert.ok(query.reasonCodes.includes('GITHUB_CANONICAL_REQUIRED'));
  assert.equal(extraPath.decision, 'REFERENCE_ONLY');
  assert.ok(extraPath.reasonCodes.includes('GITHUB_CANONICAL_REQUIRED'));
});

test('Paper 與 Article 不建立 Repo checkout 任務', () => {
  const paper = createCandidate({
    resourceType: 'paper',
    canonicalUri: 'https://arxiv.org/abs/2607.00001',
    commitSha: null,
    doi: '10.1234/example',
  });

  const result = evaluateRepositoryCandidate(selectionEntry(paper));

  assert.equal(result.decision, 'REFERENCE_ONLY');
  assert.deepEqual(result.reasonCodes, ['REPOSITORY_REQUIRED']);
});

test('只有 Extract 或 Integrate Proposed 可進 checkout', () => {
  const lowScore = createCandidate({
    metrics: {
      coreFit: 55,
      expectedValue: 55,
      novelty: 55,
      maturity: 55,
      feasibility: 55,
      evidenceQuality: 55,
      trust: 55,
    },
  });

  const result = evaluateRepositoryCandidate(selectionEntry(lowScore));

  assert.equal(result.decision, 'REFERENCE_ONLY');
  assert.ok(result.reasonCodes.includes('DISPOSITION_NOT_ELIGIBLE'));
});
