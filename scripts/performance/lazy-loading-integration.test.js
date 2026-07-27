#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildReport } = require('./measure-core-startup');
const { loadManifest, resolveCapabilities } = require('../router/resolve-capabilities');

const core = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(core, relativePath), 'utf8');
}

function testStartupPayloadStaysBelowBudget() {
  const report = buildReport(core);
  assert.strictEqual(report.missingStartupFiles.length, 0);
  assert.ok(report.startupFilesBytes <= 8192, `啟動內容過大：${report.startupFilesBytes} bytes`);
}

function testEntryFilesUseRouterBeforeManifest() {
  for (const relativePath of ['AGENTS.md', 'CODEX.md', 'CLAUDE.md', 'GEMINI.md', '.codex/AGENTS.md']) {
    const content = read(relativePath);
    assert.doesNotMatch(content, /Session (?:開始|啟動).*memory-summary/i);
    assert.match(content, /SESSION-BOOTSTRAP\.md/);
    assert.match(content, /resolve-capabilities\.js/);
    assert.doesNotMatch(content, /(?:讀取|load)\s+`?vault\/capabilities\/capability-manifest\.json/i);
  }
}

function testOnlyBootstrapKeepsAutoLoadMarkers() {
  const bootstrap = read('vault/bootstrap/SESSION-BOOTSTRAP.md');
  assert.match(bootstrap, /^alwaysApply:\s*true$/m);
  assert.match(bootstrap, /^readAt:\s*session-start$/m);

  for (const relativePath of [
    'user_rules.md',
    'vault/README.md',
    'vault/identity/founder-profile.md',
    'vault/identity/agent-persona.md',
    'vault/memory/memory-summary.md',
    'rules/common/prompt-engineering.md'
  ]) {
    const content = read(relativePath);
    assert.doesNotMatch(content, /^alwaysApply:\s*true$/m, `${relativePath} 仍標記 alwaysApply`);
    assert.doesNotMatch(content, /^readAt:\s*(?:session-start|session-init)$/m, `${relativePath} 仍標記 session auto-load`);
    assert.doesNotMatch(content, /^trigger:\s*always_on$/m, `${relativePath} 仍標記 always_on`);
  }
}

function testBootstrapPreservesCoreInteractionContract() {
  const bootstrap = read('vault/bootstrap/SESSION-BOOTSTRAP.md');
  assert.match(bootstrap, /資深 Tech Lead 顧問/);
  assert.match(bootstrap, /2[–-]3 個選項/);
  assert.match(bootstrap, /不替使用者.*決定/);
}

function testManifestReferencesExistingFiles() {
  const manifest = loadManifest(path.join(core, 'vault', 'capabilities', 'capability-manifest.json'));
  const missing = [];

  for (const capability of manifest.capabilities) {
    const load = capability.load || {};
    for (const relativePath of [
      ...(load.skills || []),
      ...(load.contexts || []),
      ...(load.governance || [])
    ]) {
      if (!fs.existsSync(path.join(core, relativePath))) {
        missing.push(`${capability.id}: ${relativePath}`);
      }
    }
  }

  assert.deepStrictEqual(missing, []);
}

function testRepresentativeRoutes() {
  const manifest = loadManifest(path.join(core, 'vault', 'capabilities', 'capability-manifest.json'));

  const pclms = resolveCapabilities('確認 PCLMS L1 Java 排程 procedure', manifest);
  assert.ok(pclms.capabilities.includes('legacy-java'));

  const recap = resolveCapabilities('幫我整理 recap 現在到哪', manifest);
  assert.ok(recap.capabilities.includes('recap-memory'));

  const plain = resolveCapabilities('把這句翻譯成英文', manifest);
  assert.deepStrictEqual(plain.capabilities, []);
}

function testRecentWorkflowPhrasesRemainRoutable() {
  const manifest = loadManifest(path.join(core, 'vault', 'capabilities', 'capability-manifest.json'));
  const cases = [
    ['確認目前進度', 'recap-memory'],
    ['你看一下這個專案的對話 去找一下', 'recap-memory'],
    ['幫我收尾，跑驗證', 'code-review'],
    ['auto mode 自動放行', 'runtime-control'],
    ['focus mode 只看結果', 'runtime-control'],
    ['確認不會影響現行操作跟功能', 'architecture-analysis'],
    ['根據你對我的了解，整理我的偏好', 'identity-calibration'],
    ['幫我優化這段 system prompt', 'prompt-engineering']
  ];

  for (const [request, expectedCapability] of cases) {
    const result = resolveCapabilities(request, manifest);
    assert.ok(
      result.capabilities.includes(expectedCapability),
      `${request} 未路由到 ${expectedCapability}: ${JSON.stringify(result.capabilities)}`
    );
  }
}

function testManifestUsesCanonicalSkillSources() {
  const manifest = loadManifest(path.join(core, 'vault', 'capabilities', 'capability-manifest.json'));
  const skillPaths = manifest.capabilities.flatMap(capability => capability.load?.skills || []);
  assert.ok(skillPaths.length > 0);
  assert.ok(skillPaths.every(relativePath => relativePath.startsWith('skills/')));
  assert.ok(skillPaths.includes('skills/pixiu-session-recap/SKILL.md'));
  assert.ok(skillPaths.includes('skills/pixiu-verify-loop/SKILL.md'));
  assert.ok(skillPaths.includes('skills/claude-code-auto-mode-policy/SKILL.md'));
}

for (const test of [
  testStartupPayloadStaysBelowBudget,
  testEntryFilesUseRouterBeforeManifest,
  testOnlyBootstrapKeepsAutoLoadMarkers,
  testBootstrapPreservesCoreInteractionContract,
  testManifestReferencesExistingFiles,
  testRepresentativeRoutes,
  testRecentWorkflowPhrasesRemainRoutable,
  testManifestUsesCanonicalSkillSources
]) {
  test();
  process.stdout.write(`ok ${test.name}\n`);
}
