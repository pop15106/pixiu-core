import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRelease, planInstall, applyInstall, verifyInstall, restoreInstall } from './publish.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runRoot = path.join(repoRoot, '.cr', 'codex-native-core-tests-' + process.pid + '-' + Date.now());
fs.mkdirSync(runRoot, { recursive: true });
let serial = 0;

function put(root, relative, text) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, 'utf8');
}

function fixture() {
  const root = path.join(runRoot, String(++serial));
  const core = path.join(root, 'core');
  const profile = path.join(root, 'profile');
  fs.mkdirSync(profile, { recursive: true });
  put(core, 'user_rules.md', '# 核心規範\n所有註解使用繁體中文。\n');
  put(core, 'vault/bootstrap/SESSION-BOOTSTRAP.md', '# 啟動\n僅載入相關能力。\n');
  put(core, 'vault/capabilities/capability-manifest.json', JSON.stringify({
    maxCapabilitiesPerRequest: 3,
    capabilities: [
      { id: 'core', keywords: ['核心'], load: { skills: ['skills/example/SKILL.md'] } },
      { id: 'recap', keywords: ['接續'], load: { contexts: ['vault/memory/SESSION-INDEX.md'] } }
    ]
  }));
  put(core, 'scripts/router/resolve-capabilities.js', 'module.exports = { safeResolveFromFile: () => ({ degraded: false, capabilities: ["core"], filesToLoad: ["skills/example/SKILL.md"], reasons: [] }) };\n');
  put(core, 'skills/example/SKILL.md', '---\nname: example\ndescription: 核心範例\n---\n依規範執行。\n');
  put(core, 'skills/example/references/detail.md', '# 詳細規範\n');
  put(core, 'skills/cr-deep-reasoning-no-mcp/SKILL.md', '---\nname: cr-deep-reasoning-no-mcp\ndescription: CRD 純推理\n---\n不呼叫工具。\n');
  put(core, 'vault/memory/SESSION-INDEX.md', '這是即時狀態，不能包進副本。\n');
  put(core, '.cr/live-state.json', '{"owner":"另一個工作"}');
  put(core, 'skills/example/.env', 'TEST_SECRET=不可複製');
  put(core, 'skills/unrelated-training/SKILL.md', '未被能力索引引用的教材。\n');
  put(core, 'scripts/entry-sync/templates/codex.md', '# PixiuCore Codex Global Entry\n\n<!-- PIXIU-GLOBAL-ENTRY:1 tool=codex -->\n\n既有母體橋接。\n');
  const bundleDir = path.join(root, 'bundle');
  const release = buildRelease({ coreRoot: core, outDir: bundleDir });
  return { root, core, profile, bundleDir, release };
}

test('發布副本保留技能參考檔，將即時記憶列為外部資料', () => {
  const f = fixture();
  const names = f.release.files.map(x => x.path);
  assert(names.includes('skills/example/references/detail.md'));
  assert(!names.some(x => x.startsWith('vault/memory/') || x.startsWith('.cr/') || x.endsWith('.env')));
  assert(!names.some(x => x.startsWith('skills/unrelated-training/')));
  assert.deepEqual(f.release.liveReferences, ['vault/memory/SESSION-INDEX.md']);
  assert(fs.existsSync(path.join(f.bundleDir, 'core', 'scripts/native/route.cjs')));
});

test('預覽不改使用者設定，正式安裝需要明確確認旗標', () => {
  const f = fixture();
  const p = planInstall({ bundleDir: f.bundleDir, userProfile: f.profile });
  assert.equal(p.action, 'install');
  assert(!fs.existsSync(path.join(f.profile, '.codex')));
  assert.throws(() => applyInstall({ bundleDir: f.bundleDir, userProfile: f.profile }), /確認/);
});

test('安裝、核對與重複安裝不增加備份', () => {
  const f = fixture();
  const result = applyInstall({ bundleDir: f.bundleDir, userProfile: f.profile, confirm: true });
  assert.equal(result.status, 'installed');
  assert.equal(verifyInstall({ bundleDir: f.bundleDir, userProfile: f.profile }).status, 'current');
  const again = applyInstall({ bundleDir: f.bundleDir, userProfile: f.profile, confirm: true });
  assert.equal(again.status, 'current');
  const backups = fs.readdirSync(path.join(f.profile, '.codex', 'pixiu-native-core', 'backups'));
  assert.equal(backups.length, 1);
  assert(result.backupSet);
});

test('保留個人指示，使用唯一原生入口並保留純推理捷徑', () => {
  const f = fixture();
  const original = '# 個人規範\r\n保留我的原文。\r\n';
  put(f.profile, '.codex/AGENTS.md', original);
  applyInstall({ bundleDir: f.bundleDir, userProfile: f.profile, confirm: true });
  const actual = fs.readFileSync(path.join(f.profile, '.codex/AGENTS.md'), 'utf8');
  assert(actual.startsWith(original));
  assert.match(actual, /CRD/);
  assert.match(actual, /即時/);
  assert(!actual.includes(f.profile));
  assert(!actual.includes(f.core));
  const skill = fs.readFileSync(path.join(f.profile, '.agents/skills/pixiu-native-core/SKILL.md'), 'utf8');
  assert.match(skill, /name: pixiu-native-core/);
  assert(!fs.existsSync(path.join(f.profile, '.agents/skills/example')));
});

test('完全相符的舊橋接可替換，未知的舊橋接須保留並停止', () => {
  const f = fixture();
  const known = fs.readFileSync(path.join(f.core, 'scripts/entry-sync/templates/codex.md'), 'utf8');
  put(f.profile, '.codex/AGENTS.md', known);
  applyInstall({ bundleDir: f.bundleDir, userProfile: f.profile, confirm: true });
  assert(!fs.readFileSync(path.join(f.profile, '.codex/AGENTS.md'), 'utf8').includes('既有母體橋接'));
  const g = fixture();
  put(g.profile, '.codex/AGENTS.md', known + '我的額外規範\n');
  assert.throws(() => planInstall({ bundleDir: g.bundleDir, userProfile: g.profile }), /舊.*入口/);
  assert.equal(fs.readFileSync(path.join(g.profile, '.codex/AGENTS.md'), 'utf8'), known + '我的額外規範\n');
});

test('全域 override 與未知同名技能在寫入前阻擋', () => {
  const f = fixture();
  put(f.profile, '.codex/AGENTS.override.md', '# 優先入口\n');
  assert.throws(() => planInstall({ bundleDir: f.bundleDir, userProfile: f.profile }), /override/);
  assert(!fs.existsSync(path.join(f.profile, '.codex/pixiu-native-core')));
  const g = fixture();
  put(g.profile, '.agents/skills/pixiu-native-core/SKILL.md', '# 使用者原檔\n');
  assert.throws(() => planInstall({ bundleDir: g.bundleDir, userProfile: g.profile }), /同名/);
});

test('正常回復還原原始位元組，重複回復保持原狀', () => {
  const f = fixture();
  const original = '\uFEFF# 個人規範\r\n保留編碼與換行。\r\n';
  put(f.profile, '.codex/AGENTS.md', original);
  const installed = applyInstall({ bundleDir: f.bundleDir, userProfile: f.profile, confirm: true });
  const restored = restoreInstall({ backupSet: installed.backupSet, confirm: true });
  assert.equal(restored.status, 'restored');
  assert.equal(fs.readFileSync(path.join(f.profile, '.codex/AGENTS.md'), 'utf8'), original);
  assert(!fs.existsSync(path.join(f.profile, '.agents/skills/pixiu-native-core/SKILL.md')));
  assert.equal(restoreInstall({ backupSet: installed.backupSet, confirm: true }).status, 'already-restored');
});

test('回復拒絕覆蓋安裝後的外部變更', () => {
  const f = fixture();
  const installed = applyInstall({ bundleDir: f.bundleDir, userProfile: f.profile, confirm: true });
  fs.appendFileSync(path.join(f.profile, '.codex/AGENTS.md'), '\n外部新增內容\n');
  assert.throws(() => restoreInstall({ backupSet: installed.backupSet, confirm: true }), /外部變更/);
  assert.match(fs.readFileSync(path.join(f.profile, '.codex/AGENTS.md'), 'utf8'), /外部新增內容/);
});

test('受竄改的發布內容和路徑穿越在安裝前阻擋', () => {
  const f = fixture();
  fs.appendFileSync(path.join(f.bundleDir, 'core/user_rules.md'), '被改動');
  assert.throws(() => planInstall({ bundleDir: f.bundleDir, userProfile: f.profile }), /雜湊/);
  assert(!fs.existsSync(path.join(f.profile, '.codex')));
  const g = fixture();
  const manifestPath = path.join(g.bundleDir, 'release.json');
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  m.files[0].path = '../outside.md';
  fs.writeFileSync(manifestPath, JSON.stringify(m));
  assert.throws(() => planInstall({ bundleDir: g.bundleDir, userProfile: g.profile }), /路徑|識別/);
});

test('使用者技能目錄為 junction 時停止，不寫入連結目的地', () => {
  const f = fixture();
  const elsewhere = path.join(f.root, 'elsewhere');
  fs.mkdirSync(elsewhere);
  fs.mkdirSync(path.join(f.profile, '.agents'));
  fs.symlinkSync(elsewhere, path.join(f.profile, '.agents/skills'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => planInstall({ bundleDir: f.bundleDir, userProfile: f.profile }), /連結/);
  assert.deepEqual(fs.readdirSync(elsewhere), []);
});

test('新版來源建立新副本，回復後指回前一版', () => {
  const f = fixture();
  applyInstall({ bundleDir: f.bundleDir, userProfile: f.profile, confirm: true });
  const first = fs.readFileSync(path.join(f.profile, '.codex/AGENTS.md'), 'utf8');
  put(f.core, 'user_rules.md', '# 核心規範\n新版規範。\n');
  const nextBundle = path.join(f.root, 'bundle-next');
  const next = buildRelease({ coreRoot: f.core, outDir: nextBundle });
  assert.notEqual(next.releaseId, f.release.releaseId);
  const update = applyInstall({ bundleDir: nextBundle, userProfile: f.profile, confirm: true });
  assert.equal(verifyInstall({ bundleDir: nextBundle, userProfile: f.profile }).status, 'current');
  restoreInstall({ backupSet: update.backupSet, confirm: true });
  assert.equal(fs.readFileSync(path.join(f.profile, '.codex/AGENTS.md'), 'utf8'), first);
});

test('發布實際母體保留 Router 與 CR runtime 相依', async () => {
  const output = path.join(runRoot, 'real-core');
  const release = buildRelease({ coreRoot: repoRoot, outDir: output });
  const files = new Set(release.files.map(item => item.path));
  for (const required of ['scripts/router/resource-policy.js', 'scripts/critical-relay/risk-review.js',
    'scripts/critical-relay/lifecycle.js', 'scripts/critical-relay/execution-contract.js']) assert(files.has(required), required);
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const router = require(path.join(output, 'core/scripts/router/resolve-capabilities.js'));
  const result = router.safeResolveFromFile('CR 風險審查',
    path.join(output, 'core/vault/capabilities/capability-manifest.json'));
  assert.equal(result.degraded, false);
  assert(result.filesToLoad.includes('vault/governance/cr-risk-review.md'));
  assert.equal(typeof require(path.join(output, 'core/scripts/critical-relay/critical-relay.js')).evaluateCriticalRelay, 'function');
});

test('發布前排除已標記的私人身分與公司脈絡', () => {
  const f = fixture();
  const manifestPath = path.join(f.core, 'vault/capabilities/capability-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.resourcePolicy = { schemaVersion: 1, localPrivate: {
    'vault/identity/founder-profile.md': '私人身分',
    'vault/context/internal.md': '公司脈絡'
  } };
  manifest.capabilities.push({ id: 'identity', keywords: ['身分'],
    load: { contexts: Object.keys(manifest.resourcePolicy.localPrivate) } });
  put(f.core, 'vault/capabilities/capability-manifest.json', JSON.stringify(manifest));
  for (const name of Object.keys(manifest.resourcePolicy.localPrivate)) put(f.core, name, '私人測試資料');
  const release = buildRelease({ coreRoot: f.core, outDir: path.join(f.root, 'public-only') });
  for (const name of Object.keys(manifest.resourcePolicy.localPrivate)) {
    assert(!release.files.some(item => item.path === name));
    assert(release.liveReferences.includes(name));
  }
});
