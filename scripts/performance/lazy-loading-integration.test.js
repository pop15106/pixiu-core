#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('assert');
const { inspectResources, validatePolicy, assertOnDemandContent } = require('../router/resource-policy');
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
  const expectedBudgets = { codex: 8192, claude: 6144, gemini: 6144, generic: 6144 };

  for (const [profileName, budgetBytes] of Object.entries(expectedBudgets)) {
    const profile = report.startupProfiles[profileName];
    assert.ok(profile, `缺少 ${profileName} 啟動 profile`);
    assert.strictEqual(profile.budgetBytes, budgetBytes);
    assert.deepStrictEqual(profile.missingStartupFiles, []);
    assert.strictEqual(
      profile.withinBudget,
      true,
      `${profileName} 啟動內容過大：${profile.startupFilesBytes}/${budgetBytes} bytes`
    );
  }

  assert.strictEqual(report.startupFilesBytes, report.startupProfiles.codex.startupFilesBytes);
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
    const policy = validatePolicy(loadManifest(path.join(core, 'vault/capabilities/capability-manifest.json')));
    // 私人檔案使用中性內容驗證契約；真實私人資料不屬公共測試輸入。
    const content = Object.hasOwn(policy.localPrivate, relativePath)
      ? '---\ntype: neutral-fixture\n---\n# 中性測試內容\n' : read(relativePath);
    assertOnDemandContent(content, relativePath);
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
  assert.match(bootstrap, /Skill 先判，環境後選/);
  assert.match(bootstrap, /遵守平台規則與權限/);
  assert.match(bootstrap, /Work mode 合適時優先嘗試/);
  assert.match(bootstrap, /成功轉入後沿用同一能力/);
  assert.match(bootstrap, /環境不可用、轉入失敗或使用者留在目前對話/);
  assert.match(bootstrap, /用現有工具沿用同一流程，不重複要求切換/);
  assert.match(bootstrap, /安全或權限拒絕時停止該動作並回報，不換介面重試/);
  assert.doesNotMatch(bootstrap, /不可用、轉入失敗、被拒絕/);
}

function testManifestReferencesExistingFiles() {
  const manifest = loadManifest(path.join(core, 'vault', 'capabilities', 'capability-manifest.json'));
  const readiness = inspectResources(core, manifest);
  assert.deepStrictEqual(readiness.missingPublic, []);
  assert.strictEqual(readiness.canRunPublicCore, true);
  assert.ok(readiness.privateResources.every(item => item.status === 'NOT_INSPECTED'));
}

function testRepresentativeRoutes() {
  const manifest = loadManifest(path.join(core, 'vault', 'capabilities', 'capability-manifest.json'));

  const pclms = resolveCapabilities('確認 PCLMS L1 Java 排程 procedure', manifest);
  assert.ok(pclms.capabilities.includes('legacy-java'));

  const recap = resolveCapabilities('幫我整理 recap 現在到哪', manifest);
  assert.ok(recap.capabilities.includes('recap-memory'));

  const plain = resolveCapabilities('把這句翻譯成英文', manifest);
  assert.deepStrictEqual(plain.capabilities, []);

  const gitFallback = resolveCapabilities('DevSpace 斷線了，切 Git 繼續', manifest);
  assert.ok(gitFallback.capabilities.includes('git-fallback'));
  assert.ok(gitFallback.filesToLoad.includes('vault/bootstrap/GIT-FALLBACK-BOOTSTRAP.md'));

  const fullAuto = resolveCapabilities('完整自動接力', manifest);
  assert.ok(fullAuto.capabilities.includes('execution-progress'));
  assert.ok(fullAuto.filesToLoad.includes('vault/governance/long-running-progress-policy.md'));

  const criticalRelay = resolveCapabilities('對抗搜尋，懷疑每個論點並找反證', manifest);
  assert.ok(criticalRelay.capabilities.includes('critical-reasoning'));
  assert.ok(criticalRelay.filesToLoad.includes('skills/critical-relay/SKILL.md'));

  const combinedRelay = resolveCapabilities('對抗搜尋，開完整自動接力', manifest);
  assert.ok(combinedRelay.capabilities.includes('critical-reasoning'));
  assert.ok(combinedRelay.capabilities.includes('execution-progress'));
  assert.ok(combinedRelay.filesToLoad.includes('skills/critical-relay/SKILL.md'));
  assert.ok(combinedRelay.filesToLoad.includes('vault/governance/long-running-progress-policy.md'));

  const unitTest = resolveCapabilities('幫我跑 unit test', manifest);
  assert.strictEqual(unitTest.capabilities.includes('execution-progress'), false);
}

function testRecentWorkflowPhrasesRemainRoutable() {
  const manifest = loadManifest(path.join(core, 'vault', 'capabilities', 'capability-manifest.json'));
  const cases = [
    ['確認目前進度', 'recap-memory'],
    ['你看一下這個專案的對話 去找一下', 'recap-memory'],
    ['幫我收尾，跑驗證', 'code-review'],
    ['auto mode 自動放行', 'runtime-control'],
    ['focus mode 只看結果', 'runtime-control'],
    ['DevSpace 斷線，切 Git 繼續', 'git-fallback'],
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

function testGitFallbackBootstrapAndTemplatesStayMinimal() {
  const bootstrap = read('vault/bootstrap/SESSION-BOOTSTRAP.md');
  const fallback = read('vault/bootstrap/GIT-FALLBACK-BOOTSTRAP.md');
  assert.match(bootstrap, /Git fallback／切 Git/);
  assert.match(fallback, /pop15106\/pixiu-core/);
  assert.match(fallback, /獨立暫存|獨立.*快取/);
  assert.doesNotMatch(read('AGENTS.md'), /GIT-FALLBACK-BOOTSTRAP/);
  assert.doesNotMatch(read('.codex/AGENTS.md'), /GIT-FALLBACK-BOOTSTRAP/);

  for (const name of ['codex', 'claude', 'gemini']) {
    const template = read(`scripts/entry-sync/templates/${name}.md`);
    assert.match(template, /GIT-FALLBACK-BOOTSTRAP\.md/);
    assert.match(template, /pop15106\/pixiu-core/);
    assert.match(template, /明確報錯/);
  }
}

function startupBlock(content) {
  const match = content.replace(/\r\n/g, '\n').match(/^## 啟動\n\n((?:\d+\. .*\n)+)/m);
  return match ? match[1] : null;
}

function testEntryFilesShareOneStartupSequence() {
  const canonical = startupBlock(read('AGENTS.md'));
  assert.ok(canonical, 'AGENTS.md 缺少「啟動」編號清單');
  assert.match(canonical, /`PIXIU_CORE` → `PIXIU_CORE_PATH`/);
  assert.match(canonical, /%USERPROFILE%\\\.pixiu-core/);
  assert.match(canonical, /含 `vault\/bootstrap\/SESSION-BOOTSTRAP\.md` 的目前 repo/);
  assert.match(canonical, /vault\/capabilities\/ROUTING\.md/);
  assert.match(canonical, /vault\/governance\/INDEX\.md/);

  // 工具入口保留同一段啟動流程，複製到其他專案時仍能獨立運作；以逐字比對防止各自漂移。
  for (const relativePath of ['CLAUDE.md', 'CODEX.md', 'GEMINI.md']) {
    assert.strictEqual(
      startupBlock(read(relativePath)),
      canonical,
      `${relativePath} 的啟動流程必須與 AGENTS.md 逐字相同`
    );
  }

  for (const relativePath of ['AGENTS.md', 'CLAUDE.md', 'CODEX.md', 'GEMINI.md', '.codex/AGENTS.md']) {
    const lines = read(relativePath).split(/\r?\n/).length;
    assert.ok(lines <= 60, `${relativePath} 超過入口檔 60 行上限：${lines}`);
  }
}

function testCommonEntryStaysToolNeutral() {
  const agents = read('AGENTS.md');
  assert.doesNotMatch(agents, /SourceEntrance|hermes-submit/i);
  for (const delta of ['CLAUDE.md', '.codex/AGENTS.md', 'GEMINI.md']) {
    assert.ok(agents.includes('`' + delta + '`'), `共同入口未指向 ${delta}`);
  }

  // Hermes 指令改為 Codex 按需載入；觸發條件仍常駐於 Codex 差異檔。
  const codexDelta = read('.codex/AGENTS.md');
  assert.match(codexDelta, /明確要求「用 Hermes」/);
  assert.match(codexDelta, /hermes-routing\.md/);
  assert.match(read('.codex/hermes-routing.md'), /hermes-submit-and-run\.ps1/);

  const bridge = read('scripts/entry-sync/templates/generic.md');
  assert.match(bridge, /PIXIU-GLOBAL-ENTRY:1 tool=generic/);
  assert.match(bridge, /<core>\/AGENTS\.md/);
  assert.match(bridge, /SESSION-BOOTSTRAP\.md/);
  assert.match(bridge, /GIT-FALLBACK-BOOTSTRAP\.md/);
  assert.match(bridge, /明確報錯/);
}

function testBootstrapCarriesConstitutionHardGates() {
  const bootstrap = read('vault/bootstrap/SESSION-BOOTSTRAP.md');
  assert.match(bootstrap, /先對齊理解.*我理解你要的是.*不做什麼/);
  assert.match(bootstrap, /問句＝討論.*不改檔/);
  assert.match(bootstrap, /先判斷是否建議啟用並說明原因/);
  assert.match(bootstrap, /母體載入狀態.*實際讀取的入口與本次能力/);
  assert.match(bootstrap, /第二大腦先查.*回讀.*驗證/);
  assert.match(bootstrap, /\$HOME\/\.pixiu-core/);
  assert.match(bootstrap, /vault\/capabilities\/ROUTING\.md/);
}

for (const scenario of [
  testStartupPayloadStaysBelowBudget,
  testEntryFilesUseRouterBeforeManifest,
  testOnlyBootstrapKeepsAutoLoadMarkers,
  testBootstrapPreservesCoreInteractionContract,
  testManifestReferencesExistingFiles,
  testRepresentativeRoutes,
  testRecentWorkflowPhrasesRemainRoutable,
  testManifestUsesCanonicalSkillSources,
  testGitFallbackBootstrapAndTemplatesStayMinimal,
  testEntryFilesShareOneStartupSequence,
  testCommonEntryStaysToolNeutral,
  testBootstrapCarriesConstitutionHardGates
]) {
  test(scenario.name, scenario);
}
