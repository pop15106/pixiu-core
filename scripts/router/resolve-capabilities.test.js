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
      id: 'security-review',
      keywords: ['資安', '漏洞', 'secret'],
      load: { skills: ['security.md'], contexts: [], governance: ['security-policy.md'] },
      priority: 30
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

function testHigherPriorityCapabilitySuppressesGenericMatch() {
  const suppressionManifest = {
    schemaVersion: 1,
    capabilities: [
      {
        id: 'full-automatic-handoff',
        keywords: ['完整自動模式'],
        suppresses: ['runtime-control'],
        load: { skills: ['full-auto.md'], contexts: [], governance: [] },
        priority: 80
      },
      {
        id: 'runtime-control',
        keywords: ['自動模式'],
        load: { skills: ['auto-mode.md'], contexts: [], governance: [] },
        priority: 45
      }
    ]
  };
  const result = resolveCapabilities('完整自動模式', suppressionManifest);
  assert.deepStrictEqual(result.capabilities, ['full-automatic-handoff']);
  assert.deepStrictEqual(result.filesToLoad, ['full-auto.md']);
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

for (const test of [
  testSelectsMatchingCapability,
  testLimitsNormalRequestToThreeCapabilities,
  testUsesManifestCapabilityLimitWhenOptionsAreAbsent,
  testOptionsCapabilityLimitOverridesManifest,
  testInvalidManifestCapabilityLimitsFallBackToDefault,
  testExplicitZeroCapabilityLimitSelectsNoCapabilities,
  testOptionsCapabilityLimitNeverExceedsHardCap,
  testManifestCapabilityLimitNeverExceedsHardCap,
  testHigherPriorityCapabilitySuppressesGenericMatch,
  testReturnsBootstrapOnlyWhenNoMatch,
  testDeduplicatesFiles,
  testMissingManifestDegradesWithoutFullScan
]) {
  test();
  process.stdout.write(`ok ${test.name}\n`);
}
