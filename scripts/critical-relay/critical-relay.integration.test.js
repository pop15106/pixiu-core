#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadManifest, resolveCapabilities } = require('../router/resolve-capabilities');

const core = path.resolve(__dirname, '..', '..');
const manifest = loadManifest(path.join(core, 'vault', 'capabilities', 'capability-manifest.json'));

function testAdversarialSearchLoadsCriticalRelay() {
  const result = resolveCapabilities('對抗搜尋，懷疑每個論點並找反證', manifest);
  assert.ok(result.capabilities.includes('critical-reasoning'));
  assert.ok(result.filesToLoad.includes('skills/critical-relay/SKILL.md'));
}

function testFullAutoLoadsBothLayers() {
  const result = resolveCapabilities('對抗搜尋，開完整自動接力', manifest);
  assert.ok(result.capabilities.includes('critical-reasoning'));
  assert.ok(result.capabilities.includes('execution-progress'));
  assert.ok(result.filesToLoad.includes('skills/critical-relay/SKILL.md'));
  assert.ok(result.filesToLoad.includes('vault/governance/long-running-progress-policy.md'));
}

function testCrFullAutoShortcutUsesRealManifest() {
  const result = resolveCapabilities('CR 完整自動接力', manifest);
  assert.ok(result.capabilities.includes('critical-reasoning'));
  assert.ok(result.capabilities.includes('execution-progress'));
  assert.ok(result.filesToLoad.includes('skills/critical-relay/SKILL.md'));
  assert.ok(result.filesToLoad.includes('vault/governance/long-running-progress-policy.md'));
}

function testCrShortcutRealManifestBoundaries() {
  for (const request of ['CR  完整自動接力', 'CR\n完整自動接力', 'CR　完整自動接力']) {
    const result = resolveCapabilities(request, manifest);
    assert.ok(result.capabilities.includes('critical-reasoning'), request);
    assert.ok(result.capabilities.includes('execution-progress'), request);
  }

  const falsePositive = resolveCapabilities('SCR 完整自動接力', manifest);
  assert.strictEqual(falsePositive.capabilities.includes('critical-reasoning'), false);
  assert.ok(falsePositive.capabilities.includes('execution-progress'));

  const negated = resolveCapabilities('不要 CR 完整自動接力，先討論', manifest);
  assert.strictEqual(negated.capabilities.includes('critical-reasoning'), false);
  assert.strictEqual(negated.capabilities.includes('execution-progress'), false);
}

function testCrModesStayLoadedUnderCapabilityPressure() {
  const result = resolveCapabilities(
    'CR 完整自動接力，DevSpace 斷線了，切 Git，處理資安漏洞',
    manifest
  );
  assert.ok(result.capabilities.includes('critical-reasoning'));
  assert.ok(result.capabilities.includes('execution-progress'));
  assert.ok(result.capabilities.includes('git-fallback'));
}

function testCriticalRelayFilesExistInCleanCheckout() {
  for (const relativePath of [
    'skills/critical-relay/SKILL.md',
    'scripts/critical-relay/critical-relay.js',
    'vault/governance/long-running-progress-policy.md'
  ]) {
    assert.strictEqual(
      fs.existsSync(path.join(core, relativePath)),
      true,
      `乾淨 checkout 缺少 ${relativePath}`
    );
  }
}

for (const test of [
  testAdversarialSearchLoadsCriticalRelay,
  testFullAutoLoadsBothLayers,
  testCrFullAutoShortcutUsesRealManifest,
  testCrShortcutRealManifestBoundaries,
  testCrModesStayLoadedUnderCapabilityPressure,
  testCriticalRelayFilesExistInCleanCheckout
]) {
  test();
  process.stdout.write(`ok ${test.name}\n`);
}
