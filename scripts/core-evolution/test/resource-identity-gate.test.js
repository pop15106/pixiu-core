const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  normalizeResourceIdentity,
  verifyResourceIdentity,
  decideResourceAccess,
} = require('../resource-identity-gate');

test('正規化資源身分並產生穩定 resourceId', () => {
  const identity = normalizeResourceIdentity({
    resourceType: 'mcp-server',
    namespace: 'Pixiu',
    name: 'Example Search',
    publisherId: 'Pixiu-Labs',
    canonicalUri: 'HTTPS://EXAMPLE.COM/repo/',
    version: '1.0.0',
  });

  assert.equal(identity.resourceId, 'pixiu.example-search');
  assert.equal(identity.namespace, 'pixiu');
  assert.equal(identity.publisher.id, 'pixiu-labs');
  assert.equal(identity.source.canonicalUri, 'https://example.com/repo');
});

test('Digest 與發布者證據一致時為 VERIFIED', () => {
  const content = '可信內容';
  const digest = crypto.createHash('sha256').update(content).digest('hex');
  const identity = normalizeResourceIdentity({
    resourceType: 'skill',
    namespace: 'pixiu',
    name: 'safe-skill',
    publisherId: 'pixiu',
    canonicalUri: 'https://example.com/safe-skill',
    version: '1.0.0',
    digest,
  });

  const verification = verifyResourceIdentity(identity, {
    exists: true,
    publisherVerified: true,
    content,
  });

  assert.equal(verification.trustLevel, 'VERIFIED');
  assert.deepEqual(verification.reasonCodes, []);
});

test('Digest 不符時直接 BLOCKED', () => {
  const identity = normalizeResourceIdentity({
    resourceType: 'skill',
    namespace: 'pixiu',
    name: 'tampered-skill',
    publisherId: 'pixiu',
    canonicalUri: 'https://example.com/tampered-skill',
    version: '1.0.0',
    digest: '0'.repeat(64),
  });

  const verification = verifyResourceIdentity(identity, {
    exists: true,
    publisherVerified: true,
    content: '遭竄改內容',
  });

  assert.equal(verification.trustLevel, 'BLOCKED');
  assert.ok(verification.reasonCodes.includes('INTEGRITY_MISMATCH'));
});

test('不存在或疑似名稱冒用的資源不得安裝', () => {
  const identity = normalizeResourceIdentity({
    resourceType: 'repository',
    namespace: 'pixiu',
    name: 'imagined-repo',
    publisherId: 'unknown',
    canonicalUri: 'https://example.com/imagined-repo',
    version: '1.0.0',
  });

  const verification = verifyResourceIdentity(identity, {
    exists: false,
    publisherVerified: false,
    lookalikeDetected: true,
  });
  const decision = decideResourceAccess(verification, 'install');

  assert.equal(decision.allowed, false);
  assert.equal(decision.code, 'RESOURCE_BLOCKED');
});

test('KNOWN 資源只允許讀取，不允許執行', () => {
  const identity = normalizeResourceIdentity({
    resourceType: 'resource',
    namespace: 'pixiu',
    name: 'known-doc',
    publisherId: 'pixiu',
    canonicalUri: 'https://example.com/known-doc',
    version: '1.0.0',
  });
  const verification = verifyResourceIdentity(identity, {
    exists: true,
    publisherVerified: true,
  });

  assert.equal(verification.trustLevel, 'KNOWN');
  assert.equal(decideResourceAccess(verification, 'read').allowed, true);
  assert.equal(decideResourceAccess(verification, 'execute').allowed, false);
});
