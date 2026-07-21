const test = require('node:test');
const assert = require('node:assert/strict');

const { validateExtensionCandidate } = require('../index');

const candidate = {
  manifest: {
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
      digest: '35ab14b4a7b597c4cb3c568cddf39ee07c557cdd7e19f2eb8b83467eafd70609',
    },
    compatibility: {
      pixiuCore: '>=1.0.0',
      mcp: ['2025-11-25'],
      hosts: ['chatgpt'],
    },
    permissions: {
      filesystem: ['docs/**'],
      network: ['api.example.com'],
      process: [],
      secrets: [],
    },
    entrypoints: { tools: ['search_docs'] },
  },
  files: {
    'tools/search-docs.js': 'module.exports = {}',
  },
};

test('候選擴充通過身分、MCP、權限與鎖定檔驗證', () => {
  const result = validateExtensionCandidate(candidate, {
    host: 'chatgpt',
    clientMcpVersions: ['2025-11-25'],
    identityEvidence: {
      exists: true,
      publisherVerified: true,
      content: 'module.exports = {}',
    },
    hostPermissions: candidate.manifest.permissions,
    userPermissions: candidate.manifest.permissions,
    policyPermissions: candidate.manifest.permissions,
  });

  assert.equal(result.valid, true);
  assert.equal(result.installDecision.allowed, true);
  assert.equal(result.lock.digest.algorithm, 'sha256');
  assert.deepEqual(result.effectivePermissions, candidate.manifest.permissions);
});

test('被冒名的候選擴充不得安裝', () => {
  const result = validateExtensionCandidate(candidate, {
    host: 'chatgpt',
    clientMcpVersions: ['2025-11-25'],
    identityEvidence: {
      exists: false,
      publisherVerified: false,
      lookalikeDetected: true,
    },
    hostPermissions: candidate.manifest.permissions,
    userPermissions: candidate.manifest.permissions,
    policyPermissions: candidate.manifest.permissions,
  });

  assert.equal(result.valid, false);
  assert.equal(result.installDecision.allowed, false);
  assert.ok(result.errors.includes('RESOURCE_BLOCKED'));
});
