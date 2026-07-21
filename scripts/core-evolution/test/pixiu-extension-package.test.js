const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateExtensionManifest,
  calculateEffectivePermissions,
  createExtensionLock,
} = require('../pixiu-extension-package');

const manifest = {
  schemaVersion: 'pixiu.extension/v1',
  id: 'pixiu.example.search',
  name: 'example-search',
  version: '1.0.0',
  publisher: { id: 'pixiu' },
  source: {
    resourceType: 'extension',
    namespace: 'pixiu',
    name: 'example-search',
    publisherId: 'pixiu',
    canonicalUri: 'https://example.com/example-search',
    version: '1.0.0',
  },
  compatibility: {
    pixiuCore: '>=1.0.0',
    mcp: ['2025-11-25'],
    hosts: ['chatgpt', 'codex'],
  },
  permissions: {
    filesystem: ['docs/**'],
    network: ['api.example.com'],
    process: [],
    secrets: [],
  },
  entrypoints: { tools: ['search_docs'] },
};

test('有效 Manifest 通過身分與 MCP 驗證', () => {
  const result = validateExtensionManifest(manifest, {
    host: 'chatgpt',
    clientMcpVersions: ['2025-11-25'],
    identityEvidence: { exists: true, publisherVerified: true },
  });

  assert.equal(result.valid, true);
  assert.equal(result.negotiatedMcpVersion, '2025-11-25');
  assert.equal(result.identity.trustLevel, 'KNOWN');
});

test('未支援 Host 時驗證失敗', () => {
  const result = validateExtensionManifest(manifest, {
    host: 'gemini',
    clientMcpVersions: ['2025-11-25'],
    identityEvidence: { exists: true, publisherVerified: true },
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('HOST_NOT_SUPPORTED'));
});

test('有效權限是四方集合的交集', () => {
  const result = calculateEffectivePermissions(
    { filesystem: ['docs/**', 'vault/**'], network: ['api.example.com'] },
    { filesystem: ['docs/**', 'vault/**'], network: ['api.example.com'] },
    { filesystem: ['docs/**'], network: ['api.example.com'] },
    { filesystem: ['docs/**'], network: [] },
  );

  assert.deepEqual(result, {
    filesystem: ['docs/**'],
    network: [],
    process: [],
    secrets: [],
  });
});

test('Lockfile 對相同內容產生穩定 Digest', () => {
  const filesA = { 'a.txt': 'A', 'b.txt': 'B' };
  const filesB = { 'b.txt': 'B', 'a.txt': 'A' };
  const first = createExtensionLock(manifest, filesA);
  const second = createExtensionLock(manifest, filesB);

  assert.equal(first.digest.algorithm, 'sha256');
  assert.equal(first.digest.value, second.digest.value);
  assert.deepEqual(first.files.map((file) => file.path), ['a.txt', 'b.txt']);
});
