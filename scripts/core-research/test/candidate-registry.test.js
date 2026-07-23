'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { mkdtemp, readFile, writeFile } = require('node:fs/promises');

const {
  importCandidates,
  readRegistry,
  listLatestCandidates,
} = require('../candidate-registry');

function createCandidate(overrides = {}) {
  return {
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

async function createRegistryPath() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pixiu-registry-'));
  return path.join(directory, 'registry.jsonl');
}

test('首次匯入寫入 CANDIDATE_IMPORTED JSONL 事件', async () => {
  const registryPath = await createRegistryPath();
  const result = await importCandidates({
    registryPath,
    candidates: [createCandidate()],
    importedAt: '2026-07-23T03:00:00Z',
  });

  assert.equal(result.eventsWritten, 1);
  assert.equal(result.imported.length, 1);
  assert.equal(result.duplicates.length, 0);

  const events = await readRegistry(registryPath);
  assert.equal(events.length, 1);
  assert.equal(events[0].schemaVersion, 'pixiu.core-research/registry-event-v1');
  assert.equal(events[0].eventType, 'CANDIDATE_IMPORTED');
  assert.equal(events[0].eventAt, '2026-07-23T03:00:00.000Z');
  assert.match(events[0].eventId, /^event-[a-f0-9]{24}$/);
  assert.equal(events[0].candidate.title, 'Example Repo');
});

test('同批與跨次重複候選不重複寫入 Registry', async () => {
  const registryPath = await createRegistryPath();
  const first = await importCandidates({
    registryPath,
    candidates: [createCandidate(), createCandidate({ title: '同版本不同標題' })],
    importedAt: '2026-07-23T03:00:00Z',
  });
  const second = await importCandidates({
    registryPath,
    candidates: [createCandidate()],
    importedAt: '2026-07-23T04:00:00Z',
  });

  assert.equal(first.eventsWritten, 1);
  assert.equal(first.duplicates.length, 1);
  assert.equal(second.eventsWritten, 0);
  assert.equal(second.duplicates.length, 1);
  assert.equal((await readRegistry(registryPath)).length, 1);
});

test('Repo 新 Commit SHA 會建立新的候選事件', async () => {
  const registryPath = await createRegistryPath();
  await importCandidates({
    registryPath,
    candidates: [createCandidate({ commitSha: 'a'.repeat(40) })],
    importedAt: '2026-07-23T03:00:00Z',
  });
  const result = await importCandidates({
    registryPath,
    candidates: [createCandidate({ commitSha: 'b'.repeat(40) })],
    importedAt: '2026-07-23T04:00:00Z',
  });

  assert.equal(result.eventsWritten, 1);
  assert.equal((await readRegistry(registryPath)).length, 2);
});

test('Registry 壞行會回報錯誤碼與正確行號', async () => {
  const registryPath = await createRegistryPath();
  await writeFile(registryPath, '{"valid":true}\nnot-json\n', 'utf8');

  await assert.rejects(
    () => readRegistry(registryPath),
    (error) => error.code === 'REGISTRY_LINE_INVALID' && error.lineNumber === 2,
  );
});

test('listLatestCandidates 回傳不可變候選陣列', async () => {
  const registryPath = await createRegistryPath();
  await importCandidates({
    registryPath,
    candidates: [
      createCandidate({ commitSha: 'a'.repeat(40) }),
      createCandidate({ commitSha: 'b'.repeat(40), title: '新版本' }),
    ],
    importedAt: '2026-07-23T03:00:00Z',
  });

  const candidates = listLatestCandidates(await readRegistry(registryPath));

  assert.equal(candidates.length, 2);
  assert.ok(Object.isFrozen(candidates));
  assert.ok(candidates.every(Object.isFrozen));
});

test('Registry 每一行都是完整 JSON 事件', async () => {
  const registryPath = await createRegistryPath();
  await importCandidates({
    registryPath,
    candidates: [createCandidate()],
    importedAt: '2026-07-23T03:00:00Z',
  });

  const lines = (await readFile(registryPath, 'utf8')).trim().split(/\r?\n/);
  assert.equal(lines.length, 1);
  assert.doesNotThrow(() => JSON.parse(lines[0]));
});
