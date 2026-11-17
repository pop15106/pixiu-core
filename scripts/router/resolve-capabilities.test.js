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
      keywords: ['對抗搜尋', '反證', '懷疑每個論點', 'critical relay'],
      aliases: ['cr 完整自動接力'],
      requiredWhenMatched: true,
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
      requiredWhenMatched: true,
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

function testCrShortcutNormalizesWhitespace() {
  for (const request of [
    'CR  完整自動接力',
    'CR\n完整自動接力',
    'CR　完整自動接力'
  ]) {
    const result = resolveCapabilities(request, manifest);
    assert.ok(result.capabilities.includes('critical-reasoning'), request);
    assert.ok(result.capabilities.includes('execution-progress'), request);
  }
}

function testCrShortcutUsesAsciiBoundary() {
  const result = resolveCapabilities('SCR 完整自動接力', manifest);
  assert.strictEqual(result.capabilities.includes('critical-reasoning'), false);
  assert.ok(result.capabilities.includes('execution-progress'));
}

function testNegatedCrShortcutDoesNotActivateModes() {
  const result = resolveCapabilities('先不要 CR 完整自動接力，先討論', manifest);
  assert.strictEqual(result.capabilities.includes('critical-reasoning'), false);
  assert.strictEqual(result.capabilities.includes('execution-progress'), false);
}

function testRequiredModesSurviveCapabilityPressure() {
  const result = resolveCapabilities(
    'CR 完整自動接力，DevSpace 斷線了，切 Git，處理資安漏洞',
    manifest
  );
  assert.deepStrictEqual(
    result.capabilities,
    ['critical-reasoning', 'execution-progress', 'git-fallback']
  );
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

function actualManifestPath() {
  return path.join(
    __dirname,
    '..',
    '..',
    'vault',
    'capabilities',
    'capability-manifest.json'
  );
}

function testActualManifestRoutesFullAutoRelayToProgressPolicy() {
  const result = safeResolveFromFile('完整自動接力', actualManifestPath());
  assert.strictEqual(result.degraded, false);
  assert.deepStrictEqual(result.capabilities, ['execution-progress']);
  assert.deepStrictEqual(result.filesToLoad, ['vault/governance/long-running-progress-policy.md']);
}

function testActualManifestRoutesGitFallbackToBootstrap() {
  const result = safeResolveFromFile('DevSpace 斷線了，切 Git 繼續', actualManifestPath());
  assert.strictEqual(result.degraded, false);
  assert.ok(result.capabilities.includes('git-fallback'));
  assert.ok(result.filesToLoad.includes('vault/bootstrap/GIT-FALLBACK-BOOTSTRAP.md'));
  assert.ok(result.filesToLoad.includes('vault/governance/long-running-progress-policy.md'));
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
  testCrShortcutNormalizesWhitespace,
  testCrShortcutUsesAsciiBoundary,
  testNegatedCrShortcutDoesNotActivateModes,
  testRequiredModesSurviveCapabilityPressure,
  testRoutesFullAutoRelayToExecutionProgress,
  testRoutesGitFallbackAndLoadsBootstrap,
  testPlainUnitTestDoesNotTriggerExecutionProgress,
  testActualManifestRoutesFullAutoRelayToProgressPolicy,
  testActualManifestRoutesGitFallbackToBootstrap
]) {
  require('node:test')(test.name, test);
}

require('node:test')('實際母體保留風險與純文字入口且沒有重複能力', () => {
  const manifest = JSON.parse(require('fs').readFileSync(actualManifestPath(), 'utf8'));
  assert.strictEqual(new Set(manifest.capabilities.map(item => item.id)).size, manifest.capabilities.length);
  for (const query of ['開 CR', 'CR 研究', 'CR 風險盤點', 'CR風險審查']) {
    const result = safeResolveFromFile(query, actualManifestPath());
    assert.strictEqual(result.degraded, false);
    assert.ok(result.capabilities.includes('critical-reasoning'), query);
    assert.ok(result.filesToLoad.includes('vault/governance/cr-risk-review.md'), query);
  }
  for (const [query, id] of [['Pro析', 'analyze-pro-style'], ['X析', 'analyze-xhigh-style'], ['CRD', 'cr-deep-reasoning-no-mcp']]) {
    const result = safeResolveFromFile(query, actualManifestPath());
    assert.ok(result.capabilities.includes(id), query);
    assert.strictEqual(result.capabilities.includes('critical-reasoning'), false, query);
  }
});

require('node:test')('findMissingFiles 只列出母體中不存在的檔案', () => {
  const { findMissingFiles } = require('./resolve-capabilities');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-router-missing-'));
  fs.mkdirSync(path.join(root, 'skills', 'a'), { recursive: true });
  fs.writeFileSync(path.join(root, 'skills', 'a', 'SKILL.md'), '# a');
  const missing = findMissingFiles(['skills/a/SKILL.md', 'vault/context/pclms-overview.md'], root);
  assert.deepStrictEqual(missing, ['vault/context/pclms-overview.md']);
  assert.deepStrictEqual(findMissingFiles(undefined, root), []);
});

require('node:test')('CLI 在 filesToLoad 有缺檔時輸出 missing 欄位', () => {
  const { execFileSync } = require('child_process');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-router-cli-'));
  const capDir = path.join(root, 'vault', 'capabilities');
  fs.mkdirSync(capDir, { recursive: true });
  fs.writeFileSync(path.join(root, 'legacy.md'), '# legacy');
  fs.writeFileSync(path.join(capDir, 'capability-manifest.json'), JSON.stringify(manifest));
  const out = JSON.parse(execFileSync(process.execPath, [
    path.join(__dirname, 'resolve-capabilities.js'), '追 PCLMS 流程', path.join(capDir, 'capability-manifest.json')
  ], { encoding: 'utf8' }));
  assert.deepStrictEqual(out.filesToLoad, ['legacy.md', 'pclms.md']);
  assert.deepStrictEqual(out.missing, ['pclms.md']);
});

require('node:test')('Pro析／X析 載入合併後的 analyze-style 與對應模式檔', () => {
  for (const [query, mode] of [['Pro析', 'pro'], ['X析', 'xhigh']]) {
    const result = safeResolveFromFile(query, actualManifestPath());
    assert.ok(result.filesToLoad.includes('skills/analyze-style/SKILL.md'), query);
    assert.ok(result.filesToLoad.includes(`skills/analyze-style/references/${mode}.md`), query);
    for (const file of result.filesToLoad) {
      assert.ok(fs.existsSync(path.join(path.dirname(actualManifestPath()), '..', '..', file)), file);
    }
  }
});

// Claude 專屬版本（.claude/skills/）必須與共用版保持相同骨架，且不含 ChatGPT 專屬限制
require('node:test')('Claude 版 analyze-style 與 critical-relay 骨架與共用版一致', () => {
  const core = path.resolve(path.dirname(actualManifestPath()), '..', '..');
  const read = rel => fs.readFileSync(path.join(core, rel), 'utf8');
  const headings = text => text.split('\n').filter(line => /^#{2,3} [PXA]\d/.test(line)).map(line => line.trim());
  for (const rel of ['analyze-style/references/pro.md', 'analyze-style/references/xhigh.md', 'analyze-style/SKILL.md']) {
    const shared = read(`skills/${rel}`);
    const claude = read(`.claude/skills/${rel}`);
    assert.deepStrictEqual(headings(claude), headings(shared), rel);
    assert.ok(!/純文字|Instant|pixiu-native-core|產品介面|宿主/.test(claude), `${rel} 仍含 ChatGPT 專屬寫法`);
  }
  assert.match(read('.claude/skills/analyze-style/SKILL.md'), /唯讀/);
  const crShared = read('skills/critical-relay/SKILL.md');
  const crClaude = read('.claude/skills/critical-relay/SKILL.md');
  for (const phase of ['UNDERSTAND', 'COUNTERSEARCH', 'VERIFY', 'RECHALLENGE', 'Completion Gate']) {
    assert.ok(crShared.includes(phase) && crClaude.includes(phase), phase);
  }
  assert.ok(!/ChatGPT|DevSpace|Dev 選擇|啟用 Dev 讀|Chat 啟動與 Dev/.test(crClaude), 'critical-relay Claude 版仍含 Chat／Dev 流程');
  assert.match(crClaude, /沒有 Dev 選項/);
  const caseReview = read('.claude/skills/critical-relay/references/case-and-review.md');
  for (const term of ['案件卡與跨輪續接', '最多八輪', 'VERIFY → RECHALLENGE']) assert.ok(caseReview.includes(term), term);
  assert.ok(!/Dev 選擇｜|workspaceId|DevSpace-work_new/.test(caseReview));
  assert.match(read('CLAUDE.md'), /cr-chat-dev-policy\.md` 不讀/);
  assert.strictEqual(read('.claude/skills/critical-relay/references/lifecycle.md').includes('ChatGPT'), false);
});
