#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveCapabilities, safeResolveFromFile } = require('./resolve-capabilities');

const manifest = {
  schemaVersion: 1,
  capabilities: [
    {
      id: 'legacy-java',
      keywords: ['java', 'pclms', 'struts', 'procedure'],
      load: { skills: ['legacy.md'], contexts: ['pclms.md'], governance: [] },
      priority: 20
    },
    {
      id: 'research',
      keywords: ['repo', '論文', '研究'],
      load: { skills: ['research.md'], contexts: [], governance: [] },
      priority: 10
    },
    {
      id: 'critical-reasoning',
      keywords: ['對抗搜尋', '反證', '懷疑每個論點', 'critical relay', 'cr 完整自動接力'],
      load: { skills: ['critical-relay.md'], contexts: [], governance: [] },
      priority: 47
    },
    {
      id: 'security-review',
      keywords: ['資安', '漏洞', 'secret'],
      load: { skills: ['security.md'], contexts: [], governance: ['security-policy.md'] },
      priority: 30
    },
    {
      id: 'execution-progress',
      keywords: ['完整自動接力', '自動接力', 'github actions', '輪詢', 'test 等待'],
      load: { skills: [], contexts: [], governance: ['long-running-progress-policy.md'] },
      priority: 46
    },
    {
      id: 'git-fallback',
      keywords: ['切 git', 'git fallback', 'devspace 斷線'],
      load: { skills: [], contexts: ['GIT-FALLBACK-BOOTSTRAP.md'], governance: ['long-running-progress-policy.md'] },
      priority: 55
    }
  ]
};

const fourCapabilityManifest = {
  ...manifest,
  capabilities: [
    ...manifest.capabilities,
    {
      id: 'performance',
      keywords: ['效能'],
      load: { skills: ['performance.md'], contexts: [], governance: [] },
      priority: 5
    }
  ]
};

function testSelectsMatchingCapability() {
  const result = resolveCapabilities('幫我追 PCLMS Java procedure 流程', manifest);
  assert.deepStrictEqual(result.capabilities, ['legacy-java']);
  assert.deepStrictEqual(result.filesToLoad, ['legacy.md', 'pclms.md']);
}

function testLimitsNormalRequestToThreeCapabilities() {
  const result = resolveCapabilities('Java PCLMS repo 論文 資安 漏洞', manifest, { maxCapabilities: 2 });
  assert.deepStrictEqual(result.capabilities, ['security-review', 'legacy-java']);
}

function testUsesManifestCapabilityLimitWhenOptionsAreAbsent() {
  const limitedManifest = { ...manifest, maxCapabilitiesPerRequest: 1 };
  const result = resolveCapabilities('Java PCLMS repo 論文 資安 漏洞', limitedManifest);
  assert.deepStrictEqual(result.capabilities, ['security-review']);
}

function testOptionsCapabilityLimitOverridesManifest() {
  const limitedManifest = { ...manifest, maxCapabilitiesPerRequest: 1 };
  const result = resolveCapabilities(
    'Java PCLMS repo 論文 資安 漏洞',
    limitedManifest,
    { maxCapabilities: 2 }
  );
  assert.deepStrictEqual(result.capabilities, ['security-review', 'legacy-java']);
}

function testInvalidManifestCapabilityLimitsFallBackToDefault() {
  for (const invalidLimit of [-1, 1.5, '9']) {
    const invalidManifest = { ...manifest, maxCapabilitiesPerRequest: invalidLimit };
    const result = resolveCapabilities('Java PCLMS repo 論文 資安 漏洞', invalidManifest);
    assert.strictEqual(result.capabilities.length, 3);
  }
}

function testExplicitZeroCapabilityLimitSelectsNoCapabilities() {
  const request = 'Java PCLMS repo 論文 資安 漏洞';
  const optionsResult = resolveCapabilities(
    request,
    { ...manifest, maxCapabilitiesPerRequest: 1 },
    { maxCapabilities: 0 }
  );
  const manifestResult = resolveCapabilities(
    request,
    { ...manifest, maxCapabilitiesPerRequest: 0 }
  );
  assert.deepStrictEqual(optionsResult.capabilities, []);
  assert.deepStrictEqual(manifestResult.capabilities, []);
}

function testOptionsCapabilityLimitNeverExceedsHardCap() {
  const result = resolveCapabilities(
    'Java PCLMS repo 論文 資安 漏洞 效能',
    fourCapabilityManifest,
    { maxCapabilities: 5 }
  );
  assert.deepStrictEqual(result.capabilities, ['security-review', 'legacy-java', 'research']);
}

function testManifestCapabilityLimitNeverExceedsHardCap() {
  const result = resolveCapabilities(
    'Java PCLMS repo 論文 資安 漏洞 效能',
    { ...fourCapabilityManifest, maxCapabilitiesPerRequest: 5 }
  );
  assert.deepStrictEqual(result.capabilities, ['security-review', 'legacy-java', 'research']);
}

function testReturnsBootstrapOnlyWhenNoMatch() {
  const result = resolveCapabilities('今天天氣如何', manifest);
  assert.deepStrictEqual(result.capabilities, []);
  assert.deepStrictEqual(result.filesToLoad, []);
}

function testDeduplicatesFiles() {
  const duplicated = JSON.parse(JSON.stringify(manifest));
  duplicated.capabilities[1].load.skills = ['legacy.md'];
  const result = resolveCapabilities('Java repo', duplicated);
  assert.deepStrictEqual(result.filesToLoad, ['legacy.md', 'pclms.md']);
}

function testMissingManifestDegradesWithoutFullScan() {
  const missingPath = path.join(os.tmpdir(), `missing-manifest-${Date.now()}.json`);
  assert.strictEqual(fs.existsSync(missingPath), false);
  const result = safeResolveFromFile('Java PCLMS', missingPath);
  assert.strictEqual(result.degraded, true);
  assert.deepStrictEqual(result.capabilities, []);
  assert.deepStrictEqual(result.filesToLoad, []);
  assert.match(result.error, /找不到 Capability Manifest/);
}

function testRoutesAdversarialSearchToCriticalRelay() {
  const result = resolveCapabilities('對抗搜尋，懷疑每個論點並找反證', manifest);
  assert.ok(result.capabilities.includes('critical-reasoning'));
  assert.ok(result.filesToLoad.includes('critical-relay.md'));
}

function testCombinesCriticalRelayWithFullAuto() {
  const result = resolveCapabilities('對抗搜尋，開完整自動接力', manifest);
  assert.ok(result.capabilities.includes('critical-reasoning'));
  assert.ok(result.capabilities.includes('execution-progress'));
  assert.ok(result.filesToLoad.includes('critical-relay.md'));
  assert.ok(result.filesToLoad.includes('long-running-progress-policy.md'));
}

function testCrFullAutoShortcutLoadsBothLayers() {
  const result = resolveCapabilities('CR 完整自動接力', manifest);
  assert.ok(result.capabilities.includes('critical-reasoning'));
  assert.ok(result.capabilities.includes('execution-progress'));
  assert.ok(result.filesToLoad.includes('critical-relay.md'));
  assert.ok(result.filesToLoad.includes('long-running-progress-policy.md'));
}

function testRoutesFullAutoRelayToExecutionProgress() {
  const result = resolveCapabilities('完整自動接力', manifest);
  assert.ok(result.capabilities.includes('execution-progress'));
  assert.ok(result.filesToLoad.includes('long-running-progress-policy.md'));
}

function testRoutesGitFallbackAndLoadsBootstrap() {
  const result = resolveCapabilities('DevSpace 斷線了，切 Git 繼續', manifest);
  assert.ok(result.capabilities.includes('git-fallback'));
  assert.ok(result.filesToLoad.includes('GIT-FALLBACK-BOOTSTRAP.md'));
}

function testPlainUnitTestDoesNotTriggerExecutionProgress() {
  const result = resolveCapabilities('幫我跑 unit test', manifest);
  assert.strictEqual(result.capabilities.includes('execution-progress'), false);
}

for (const test of [
  testSelectsMatchingCapability,
  testLimitsNormalRequestToThreeCapabilities,
  testUsesManifestCapabilityLimitWhenOptionsAreAbsent,
  testOptionsCapabilityLimitOverridesManifest,
  testInvalidManifestCapabilityLimitsFallBackToDefault,
  testExplicitZeroCapabilityLimitSelectsNoCapabilities,
  testOptionsCapabilityLimitNeverExceedsHardCap,
  testManifestCapabilityLimitNeverExceedsHardCap,
  testReturnsBootstrapOnlyWhenNoMatch,
  testDeduplicatesFiles,
  testMissingManifestDegradesWithoutFullScan,
  testRoutesAdversarialSearchToCriticalRelay,
  testCombinesCriticalRelayWithFullAuto,
  testCrFullAutoShortcutLoadsBothLayers,
  testRoutesFullAutoRelayToExecutionProgress,
  testRoutesGitFallbackAndLoadsBootstrap,
  testPlainUnitTestDoesNotTriggerExecutionProgress
]) {
  test();
  process.stdout.write(`ok ${test.name}\n`);
}
