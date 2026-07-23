'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeCandidate } = require('../candidate-schema');
const { buildCanonicalKey } = require('../candidate-dedupe');

function createBase(overrides = {}) {
  return {
    resourceType: 'repository',
    title: 'Example',
    canonicalUri: 'https://github.com/example/repo',
    publisher: 'Example',
    publishedAt: '2026-07-20T00:00:00Z',
    updatedAt: '2026-07-22T00:00:00Z',
    discoveredAt: '2026-07-23T02:00:00Z',
    commitSha: 'a'.repeat(40),
    license: 'MIT',
    categories: ['ai-sdlc'],
    summary: '摘要',
    evidence: [{ source: 'https://github.com/example/repo', note: '證據' }],
    metrics: {
      coreFit: 80,
      expectedValue: 80,
      novelty: 80,
      maturity: 80,
      feasibility: 80,
      evidenceQuality: 80,
      trust: 80,
    },
    ...overrides,
  };
}

test('相同 Repo URI 與 Commit SHA 產生相同 Canonical Key', () => {
  const first = normalizeCandidate(createBase());
  const second = normalizeCandidate(createBase({
    canonicalUri: 'HTTPS://GITHUB.COM/example/repo/',
    title: '不同標題不影響版本身分',
  }));

  assert.equal(buildCanonicalKey(first), buildCanonicalKey(second));
});

test('Repo 新 Commit SHA 產生不同 Canonical Key', () => {
  const first = normalizeCandidate(createBase({ commitSha: 'a'.repeat(40) }));
  const second = normalizeCandidate(createBase({ commitSha: 'b'.repeat(40) }));

  assert.notEqual(buildCanonicalKey(first), buildCanonicalKey(second));
});

test('論文優先使用 DOI 並忽略 DOI 大小寫', () => {
  const first = normalizeCandidate(createBase({
    resourceType: 'paper',
    canonicalUri: 'https://example.org/paper-one',
    commitSha: undefined,
    doi: '10.1234/ABC.Def',
  }));
  const second = normalizeCandidate(createBase({
    resourceType: 'paper',
    canonicalUri: 'https://example.org/another-url',
    commitSha: undefined,
    doi: '10.1234/abc.def',
  }));

  assert.equal(buildCanonicalKey(first), 'paper:doi:10.1234/abc.def');
  assert.equal(buildCanonicalKey(first), buildCanonicalKey(second));
});

test('arXiv v1 與 v2 產生不同 Canonical Key', () => {
  const first = normalizeCandidate(createBase({
    resourceType: 'paper',
    canonicalUri: 'https://arxiv.org/abs/2607.12345',
    commitSha: undefined,
    doi: undefined,
    arxivId: '2607.12345',
    arxivVersion: 'v1',
  }));
  const second = normalizeCandidate(createBase({
    resourceType: 'paper',
    canonicalUri: 'https://arxiv.org/abs/2607.12345',
    commitSha: undefined,
    doi: undefined,
    arxivId: '2607.12345',
    arxivVersion: 'v2',
  }));

  assert.notEqual(buildCanonicalKey(first), buildCanonicalKey(second));
});

test('文章以 Canonical URL 與發布日期形成版本鍵', () => {
  const first = normalizeCandidate(createBase({
    resourceType: 'article',
    canonicalUri: 'https://example.com/article',
    commitSha: undefined,
    publishedAt: '2026-07-20T01:00:00Z',
  }));
  const second = normalizeCandidate(createBase({
    resourceType: 'article',
    canonicalUri: 'https://example.com/article',
    commitSha: undefined,
    publishedAt: '2026-07-21T01:00:00Z',
  }));

  assert.equal(buildCanonicalKey(first), 'article:https://example.com/article@2026-07-20');
  assert.notEqual(buildCanonicalKey(first), buildCanonicalKey(second));
});
