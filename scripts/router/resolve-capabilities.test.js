#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveCapabilities, loadManifest, safeResolveFromFile } = require('./resolve-capabilities');

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

function testNaturalWorkDocumentPhrasesRouteToRouter() {
  const actualManifest = loadManifest(
    path.join(__dirname, '..', '..', 'vault', 'capabilities', 'capability-manifest.json')
  );
  const phrases = [
    '現在有個需求，PM 說 L6 要再調整',
    'SA 剛交代這個先不要上',
    '客戶報修，這張單有異常',
    '這筆資料怪怪的，我要手動修資料',
    '這次要上版，幫我把文件留起來',
    '這次資安復掃要送排除說明'
  ];

  for (const phrase of phrases) {
    const result = resolveCapabilities(phrase, actualManifest);
    assert.ok(
      result.capabilities.includes('work-document-routing'),
      `自然語句未命中 work-document-routing：${phrase}`
    );
    assert.ok(
      result.filesToLoad.includes('skills/work-document-router/SKILL.md'),
      `自然語句未載入 work-document-router：${phrase}`
    );
  }
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
  testNaturalWorkDocumentPhrasesRouteToRouter
]) {
  test();
  process.stdout.write(`ok ${test.name}\n`);
}
