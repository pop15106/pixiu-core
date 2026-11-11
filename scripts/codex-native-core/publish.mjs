import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCHEMA = 1;
const BEGIN = '<!-- PIXIU-NATIVE-CORE:BEGIN -->';
const END = '<!-- PIXIU-NATIVE-CORE:END -->';
const MARKER = '<!-- PIXIU-NATIVE-SKILL:1 -->';
const ENTRY = 'AGENTS.md';
const SKILL = '.agents/skills/pixiu-native-core/SKILL.md';
const STATIC_ROOTS = [
  'user_rules.md', 'vault/bootstrap', 'vault/capabilities', 'vault/governance',
  'vault/context', 'vault/sop', 'vault/identity', 'rules',
  '.agent/workflows', 'scripts/router', 'scripts/critical-relay'
];
const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.venv', 'backups', 'backup', 'sessions', 'recaps']);
const hash = value => createHash('sha256').update(value).digest('hex');
const exists = value => fs.existsSync(value);
const readJson = value => {
  const bytes = bytesOrNull(value);
  if (bytes === null) fail('找不到必要 JSON 檔案：' + value);
  return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
};

function fail(message) { throw new Error(message); }
function relativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || /[:\x00-\x1f]/.test(value) ||
      path.posix.isAbsolute(value) || value.split('/').some(x => !x || x === '.' || x === '..')) {
    fail('不安全的相對路徑：' + value);
  }
  return value;
}
function absolutePath(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || /[\x00-\x1f]/.test(value)) fail('需要有效絕對路徑。');
  return path.resolve(value);
}
function safeTarget(root, relative) { return path.join(root, ...relativePath(relative).split('/')); }
function noLinks(target) {
  const absolute = absolutePath(target);
  let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) fail('目標含連結或 junction，請先人工核對：' + current);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}
function bytesOrNull(target) {
  noLinks(target);
  if (!exists(target)) return null;
  if (!fs.statSync(target).isFile()) fail('目標不是一般檔案：' + target);
  return fs.readFileSync(target);
}
function digestOrNull(bytes) { return bytes === null ? null : hash(bytes); }
function writeNew(target, bytes) {
  noLinks(target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes, { flag: 'wx' });
}
function atomicWrite(target, bytes) {
  noLinks(target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = target + '.pixiu-' + randomUUID() + '.tmp';
  fs.writeFileSync(temporary, bytes, { flag: 'wx' });
  try { fs.renameSync(temporary, target); }
  finally { if (exists(temporary)) fs.unlinkSync(temporary); }
}
function identity(manifest) {
  return hash(JSON.stringify({
    schemaVersion: manifest.schemaVersion, sourceRoot: manifest.sourceRoot,
    legacyEntrySha256: manifest.legacyEntrySha256, liveReferences: manifest.liveReferences,
    files: manifest.files
  })).slice(0, 16);
}
function collect(root, relative, result, skipped, privatePaths = new Set()) {
  // 在讀取內容前排除母體已標記的私人來源。
  if (privatePaths.has(relative)) { skipped.push(relative); return; }
  const target = safeTarget(root, relative);
  if (!exists(target)) return;
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) fail('發布來源含連結，需明確核對來源：' + relative);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(target).sort()) {
      if (SKIP_DIRS.has(name)) continue;
      collect(root, relative + '/' + name, result, skipped, privatePaths);
    }
    return;
  }
  if (!stat.isFile()) return;
  const base = path.basename(relative);
  if (/^(?:\.env(?:\..*)?|auth\.json|credentials(?:\..*)?|id_rsa|id_ed25519)$/i.test(base) ||
      /\.(?:pem|key|pfx|p12|pyc|log)$/i.test(base)) {
    skipped.push(relative); return;
  }
  const bytes = fs.readFileSync(target);
  // 僅回報檔案路徑，不輸出偵測到的憑證內容。
  if (/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/.test(bytes.toString('utf8'))) fail('來源含私鑰，停止發布：' + relative);
  result.set(relative, bytes);
}
function routeAdapter(sourceRoot) {
  return [
    "'use strict';",
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    "const { safeResolveFromFile } = require('../router/resolve-capabilities.js');",
    "const root = path.resolve(__dirname, '../..');",
    'const liveRoot = ' + JSON.stringify(sourceRoot) + ';',
    "const result = safeResolveFromFile(process.argv[2] || '', path.join(root, 'vault/capabilities/capability-manifest.json'));",
    "const paths = result.filesToLoad || [];",
    "const invalid = paths.filter(p => typeof p !== 'string' || p.includes('..') || p.includes('\\\\') || path.isAbsolute(p));",
    "if (invalid.length) { process.stderr.write('Router 含無效路徑。\\n'); process.exit(2); }",
    "const policy = JSON.parse(fs.readFileSync(path.join(root, 'vault/capabilities/capability-manifest.json'), 'utf8')).resourcePolicy;",
    "const live = p => p.startsWith('vault/memory/') || Object.hasOwn(policy?.localPrivate || {}, p);",

    "const missing = paths.filter(p => !live(p) && !fs.existsSync(path.join(root, p)));",
    "result.snapshotFiles = paths.filter(p => !live(p)).map(p => path.join(root, p));",
    "result.liveFiles = paths.filter(live).map(p => path.join(liveRoot, p));",
    "result.liveStateRoot = liveRoot;",
    "result.missingSnapshotFiles = missing;",
    "result.note = '快照僅供規範讀取；即時記憶、CR 狀態、Handoff 與所有寫入需回到正式來源或目標專案並核對權限。';",
    "process.stdout.write(JSON.stringify(result, null, 2) + '\\n');",
    "if (result.degraded || missing.length) process.exitCode = 2;",
    ''
  ].join('\n');
}

export function buildRelease({ coreRoot, outDir }) {
  const core = absolutePath(coreRoot);
  const output = absolutePath(outDir);
  noLinks(core); noLinks(output);
  if (output === core || STATIC_ROOTS.some(p => output === safeTarget(core, p) || output.startsWith(safeTarget(core, p) + path.sep))) {
    fail('發布目錄必須與規範來源分開。');
  }
  const sourceManifest = readJson(safeTarget(core, 'vault/capabilities/capability-manifest.json'));
  const privatePaths = new Set(Object.keys(sourceManifest.resourcePolicy?.localPrivate || {}).map(relativePath));
  const content = new Map();
  const skipped = [];
  for (const relative of STATIC_ROOTS) collect(core, relative, content, skipped, privatePaths);
  for (const required of ['user_rules.md', 'vault/bootstrap/SESSION-BOOTSTRAP.md', 'vault/capabilities/capability-manifest.json', 'scripts/router/resolve-capabilities.js']) {
    if (!content.has(required)) fail('缺少必要來源：' + required);
  }
  const capabilities = JSON.parse(content.get('vault/capabilities/capability-manifest.json').toString('utf8'));
  const skillRoots = new Set(['skills/cr-deep-reasoning-no-mcp']);
  for (const capability of capabilities.capabilities || []) {
    for (const relative of capability.load?.skills || []) {
      relativePath(relative);
      if (!/^skills\/[a-zA-Z0-9_-]+\/SKILL\.md$/.test(relative)) fail('技能入口格式不符：' + relative);
      skillRoots.add(path.posix.dirname(relative));
    }
  }
  for (const skillRoot of skillRoots) collect(core, skillRoot, content, skipped, privatePaths);
  // 依文件中具體引用的技能目錄補齊依賴，不掃描未使用的第三方技能庫。
  const visited = new Set();
  for (let pass = 0; pass < 20; pass++) {
    let added = false;
    for (const [relative, bytes] of [...content]) {
      if (!relative.endsWith('.md') || visited.has(relative)) continue;
      visited.add(relative);
      for (const match of bytes.toString('utf8').matchAll(/(?:^|[^a-zA-Z0-9_.-])skills\/([a-zA-Z0-9_-]+)\/(?:SKILL\.md|references\/)/g)) {
        const candidate = 'skills/' + match[1];
        if (!skillRoots.has(candidate) && exists(safeTarget(core, candidate + '/SKILL.md'))) {
          skillRoots.add(candidate);
          collect(core, candidate, content, skipped, privatePaths);
          added = true;
        }
      }
    }
    if (!added) break;
    if (pass === 19) fail('技能依賴超過檢查上限，請核對循環或異常依賴。');
  }
  const liveReferences = new Set();
  const ids = new Set();
  const warnings = [];
  for (const capability of capabilities.capabilities || []) {
    if (ids.has(capability.id)) warnings.push('來源 Manifest 已有重複 capability id：' + capability.id);
    ids.add(capability.id);
    for (const relative of Object.values(capability.load || {}).flat()) {
      relativePath(relative);
      if (relative.startsWith('vault/memory/') || privatePaths.has(relative)) liveReferences.add(relative);
      else if (!content.has(relative)) fail('Capability 所需檔案未納入發布：' + relative);
    }
  }
  content.set('scripts/native/route.cjs', Buffer.from(routeAdapter(core)));
  const legacyPath = path.join(core, 'scripts/entry-sync/templates/codex.md');
  const legacy = bytesOrNull(legacyPath);
  const files = [...content].sort(([a], [b]) => a.localeCompare(b)).map(([relative, bytes]) => ({
    path: relative, bytes: bytes.length, sha256: hash(bytes)
  }));
  const revision = spawnSync('git', ['-C', core, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true });
  const manifest = {
    schemaVersion: SCHEMA, createdAt: new Date().toISOString(), sourceRoot: core,
    sourceRevision: revision.status === 0 ? revision.stdout.trim() : null,
    sourcePolicy: '以目前工作樹內容逐檔計算雜湊；未提交內容亦包含在來源快照。',
    legacyEntrySha256: digestOrNull(legacy), liveReferences: [...liveReferences].sort(),
    files, skillRoots: [...skillRoots].sort(), skipped, warnings
  };
  manifest.releaseId = identity(manifest);
  if (exists(output)) {
    const previous = readRelease(output);
    if (previous.releaseId !== manifest.releaseId) fail('發布目錄已有不同版本，請使用新的輸出目錄。');
    return previous;
  }
  fs.mkdirSync(output, { recursive: true });
  for (const [relative, bytes] of content) writeNew(safeTarget(path.join(output, 'core'), relative), bytes);
  writeNew(path.join(output, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  readRelease(output);
  return manifest;
}
function readRelease(bundleDir) {
  const bundle = absolutePath(bundleDir);
  noLinks(bundle);
  const manifest = readJson(path.join(bundle, 'release.json'));
  if (manifest.schemaVersion !== SCHEMA || !Array.isArray(manifest.files) || !Array.isArray(manifest.liveReferences)) fail('發布 manifest 格式不符。');
  absolutePath(manifest.sourceRoot);
  const seen = new Set();
  for (const file of manifest.files) {
    relativePath(file.path);
    if (seen.has(file.path)) fail('發布含重複路徑：' + file.path);
    seen.add(file.path);
    if (!/^[a-f0-9]{64}$/.test(file.sha256)) fail('發布檔案雜湊格式不符。');
    const bytes = bytesOrNull(safeTarget(path.join(bundle, 'core'), file.path));
    if (bytes === null || bytes.length !== file.bytes || hash(bytes) !== file.sha256) fail('發布內容雜湊不符：' + file.path);
  }
  if (manifest.releaseId !== identity(manifest)) fail('發布版本識別不符。');
  return manifest;
}
function locations(userProfile, codexHome) {
  const profile = absolutePath(userProfile || process.env.USERPROFILE || process.env.HOME);
  const home = absolutePath(codexHome || path.join(profile, '.codex'));
  return {
    profile, home, native: path.join(home, 'pixiu-native-core'),
    agents: path.join(home, ENTRY), skill: path.join(profile, ...SKILL.split('/'))
  };
}
function releaseLocation(loc, id) {
  if (!/^[a-f0-9]{16}$/.test(id)) fail('無效的發布版本識別。');
  return path.join(loc.native, 'releases', id);
}
function entryBlock(manifest, loc) {
  const core = '<codex-home>/pixiu-native-core/releases/' + manifest.releaseId + '/core';
  return [
    BEGIN,
    '<!-- PIXIU-NATIVE-CORE-RELEASE:' + manifest.releaseId + ' -->',
    '## PixiuCore 原生規範入口',
    '',
    'Codex home 以這份全域 AGENTS.md 所在目錄為準，記為 \x60<codex-home>\x60；通常由 CODEX_HOME 或 %USERPROFILE%\\.codex 解析。',
    '本機規範副本：\x60' + core + '\x60；正式母體與即時狀態位置讀取該版本 release.json 的 sourceRoot。',
    '1. 本入口採「規範副本、正式狀態」分離。規範的相對路徑以本機副本為準；原始母體是修改與重新發布的來源。',
    '2. 先讀副本的 \x60vault/bootstrap/SESSION-BOOTSTRAP.md\x60；這個部署入口已指定規範位置，Bootstrap 的原母體探索只用於尋找正式狀態。',
    '3. 一般任務執行 \x60node "' + path.join(core, 'scripts/native/route.cjs') + '" "<本次需求>"\x60。',
    '4. 只讀 Router 的 snapshotFiles；最多 3 個 Capability。liveFiles 是正式來源的即時資料，接續任務時重新確認存取與最新內容。',
    '5. CRD、/crd、CR深推、/crdeep、/icr、InstantCR、/crx：直接讀副本的 \x60skills/cr-deep-reasoning-no-mcp/SKILL.md\x60，載入後依純推理契約執行，不再呼叫 Router、工具或派工。',
    '6. CR 最新 taskId、owner、revision、Workflow ledger、Handoff、記憶索引與寫入目的地，一律以正式來源或當前目標專案為準。副本不充當即時狀態。',
    '7. 按需參考檔在副本中缺失時回報路徑。外部工具、連線、腳本的執行依賴另行確認，不宣稱已具備未安裝的能力。',
    '8. 副本僅供讀取；修改規範在正式母體進行，再重新發布。保留原授權、Review、人工 Merge 與繁體中文規範。',
    '9. 本入口不寫入 Codex Memories，不調整模型、MCP、hooks、權限或背景記憶開關。',
    END
  ].join('\n');
}
function skillText(manifest, loc) {
  const core = '<codex-home>/pixiu-native-core/releases/' + manifest.releaseId + '/core';
  return [
    '---',
    'name: pixiu-native-core',
    'description: 使用 PixiuCore 原生規範副本。當要求依母體規範工作、載入核心技能、CR 完整接力或 CRD 純推理時，沿用 Bootstrap 與 Capability Router；最新任務狀態仍讀正式來源。',
    '---', '', MARKER,
    '<!-- PIXIU-NATIVE-CORE-RELEASE:' + manifest.releaseId + ' -->',
    '# PixiuCore 原生入口', '',
    '依使用者全域 AGENTS.md 的 PixiuCore 原生入口操作。',
    '規範副本位於 \x60' + core + '\x60。',
    '<codex-home> 以已載入的全域 AGENTS.md 所在目錄為準；正式母體與即時狀態讀取該版本 release.json 的 sourceRoot。',
    '先讀規範副本的 vault/bootstrap/SESSION-BOOTSTRAP.md，按任務載入內容。',
    '一般任務使用副本 scripts/native/route.cjs；只讀 snapshotFiles，liveFiles 另核對正式來源。',
    'CRD 等純推理要求直接載入副本 skills/cr-deep-reasoning-no-mcp/SKILL.md，開始執行後遵守其工具限制。',
    'CR 即時狀態、Handoff 與記憶更新一律使用正式紀錄；不把副本當成最新進度。',
    '保留原規範的授權、覆核與人工合併界線。外部工具仍需在當前環境可用。',
    ''
  ].join('\n');
}
function oldRelease(text, loc) {
  const ids = [...text.matchAll(/<!-- PIXIU-NATIVE-CORE-RELEASE:([a-f0-9]{16}) -->/g)];
  if (ids.length !== 1) fail('既有原生入口的版本標記不完整。');
  return readRelease(releaseLocation(loc, ids[0][1]));
}
function nextAgents(before, manifest, loc) {
  const text = before === null ? '' : before.toString('utf8');
  const block = entryBlock(manifest, loc);
  if (text.includes(BEGIN) || text.includes(END)) {
    if (text.split(BEGIN).length !== 2 || text.split(END).length !== 2) fail('既有原生入口標記重複。');
    const start = text.indexOf(BEGIN), finish = text.indexOf(END) + END.length;
    if (finish < start) fail('既有原生入口標記順序錯誤。');
    const managed = text.slice(start, finish);
    if (managed !== entryBlock(oldRelease(managed, loc), loc)) fail('原生入口有外部變更，需人工核對。');
    return text.slice(0, start) + block + text.slice(finish);
  }
  if (text.includes('PIXIU-GLOBAL-ENTRY:')) {
    if (digestOrNull(before) !== manifest.legacyEntrySha256) fail('舊 Pixiu 入口與已知範本不同，請先核對並保留個人設定。');
    return block + '\n';
  }
  return text + (text && !text.endsWith('\n') ? '\n\n' : text ? '\n' : '') + block + '\n';
}
export function planInstall({ bundleDir, userProfile, codexHome }) {
  const manifest = readRelease(bundleDir);
  const loc = locations(userProfile, codexHome);
  for (const target of [loc.native, loc.agents, loc.skill]) noLinks(target);
  const override = bytesOrNull(path.join(loc.home, 'AGENTS.override.md'));
  if (override && override.toString('utf8').trim()) fail('存在 AGENTS.override.md，會優先於 AGENTS.md；請先核對 override。');
  const oldAgents = bytesOrNull(loc.agents);
  const oldSkill = bytesOrNull(loc.skill);
  if (oldSkill !== null) {
    const text = oldSkill.toString('utf8');
    if (!text.includes(MARKER)) fail('已有未知的同名技能，保留原檔並停止。');
    if (text !== skillText(oldRelease(text, loc), loc)) fail('同名技能有外部變更，需人工核對。');
  }
  const items = [
    { target: loc.agents, before: oldAgents, after: Buffer.from(nextAgents(oldAgents, manifest, loc)) },
    { target: loc.skill, before: oldSkill, after: Buffer.from(skillText(manifest, loc)) }
  ].map(x => ({ ...x, beforeSha256: digestOrNull(x.before), afterSha256: hash(x.after) }));
  const releaseRoot = releaseLocation(loc, manifest.releaseId);
  const current = items.every(x => x.beforeSha256 === x.afterSha256) && exists(releaseRoot);
  if (exists(releaseRoot)) readRelease(releaseRoot);
  return { action: current ? 'none' : 'install', manifest, loc, releaseRoot, items };
}
function withLock(loc, work) {
  noLinks(loc.native);
  fs.mkdirSync(loc.native, { recursive: true });
  const lock = path.join(loc.native, 'install.lock');
  let fd;
  try { fd = fs.openSync(lock, 'wx'); }
  catch (error) { if (error.code === 'EEXIST') fail('另一個安裝程序正在執行，或前次鎖定需人工確認。'); throw error; }
  fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
  try { return work(); }
  finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
function copyRelease(bundleDir, plan) {
  if (exists(plan.releaseRoot)) return;
  const stage = plan.releaseRoot + '.staging-' + randomUUID();
  fs.mkdirSync(stage, { recursive: true });
  for (const file of plan.manifest.files) {
    writeNew(safeTarget(path.join(stage, 'core'), file.path), fs.readFileSync(safeTarget(path.join(bundleDir, 'core'), file.path)));
  }
  writeNew(path.join(stage, 'release.json'), JSON.stringify(plan.manifest, null, 2) + '\n');
  readRelease(stage);
  fs.renameSync(stage, plan.releaseRoot);
}
function saveBackup(plan) {
  const backupSet = path.join(plan.loc.native, 'backups', new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID());
  fs.mkdirSync(backupSet, { recursive: true });
  const items = plan.items.map((item, index) => {
    const file = String(index) + '.original.bin';
    if (item.before !== null) writeNew(path.join(backupSet, file), item.before);
    return { target: item.target, file, beforeSha256: item.beforeSha256, afterSha256: item.afterSha256 };
  });
  writeNew(path.join(backupSet, 'backup.json'), JSON.stringify({
    schemaVersion: SCHEMA, userProfile: plan.loc.profile, codexHome: plan.loc.home,
    releaseId: plan.manifest.releaseId, createdAt: new Date().toISOString(), items
  }, null, 2) + '\n');
  return backupSet;
}
export function applyInstall(options) {
  if (options.confirm !== true) fail('安裝需要明確確認：加上 --confirm。');
  const preview = planInstall(options);
  if (preview.action === 'none') return { status: 'current', releaseId: preview.manifest.releaseId };
  return withLock(preview.loc, () => {
    const plan = planInstall(options);
    if (plan.action === 'none') return { status: 'current', releaseId: plan.manifest.releaseId };
    copyRelease(options.bundleDir, plan);
    const backupSet = saveBackup(plan);
    try {
      for (const item of plan.items) {
        if (digestOrNull(bytesOrNull(item.target)) !== item.beforeSha256) fail('寫入前偵測到外部變更：' + item.target);
        if (item.beforeSha256 !== item.afterSha256) atomicWrite(item.target, item.after);
      }
      verifyInstall(options);
      return { status: 'installed', releaseId: plan.manifest.releaseId, backupSet, releaseRoot: plan.releaseRoot, targets: plan.items.map(x => x.target) };
    } catch (error) {
      // 回復只接受原始或本次寫入版本，外部變更一律保留。
      try { restoreBackup(backupSet); }
      catch (restoreError) { fail(error.message + '；自動回復未完成：' + restoreError.message + '；備份：' + backupSet); }
      fail(error.message + '；本次入口變更已回復。備份：' + backupSet);
    }
  });
}
export function verifyInstall(options) {
  const plan = planInstall(options);
  if (plan.action !== 'none') fail('安裝尚未完成，或已安裝的版本與此發布內容不同。');
  readRelease(plan.releaseRoot);
  return { status: 'current', releaseId: plan.manifest.releaseId, checkedFiles: plan.manifest.files.length, targets: plan.items.map(x => x.target) };
}
function backupPlan(backupSet) {
  const set = absolutePath(backupSet);
  noLinks(set);
  const record = readJson(path.join(set, 'backup.json'));
  if (record.schemaVersion !== SCHEMA || !Array.isArray(record.items) || record.items.length !== 2) fail('備份格式不符。');
  const loc = locations(record.userProfile, record.codexHome);
  if (path.resolve(set, '../../..') !== loc.home) fail('備份路徑與 Codex 目錄不符。');
  const allowed = [loc.agents, loc.skill];
  const items = record.items.map((item, index) => {
    if (item.target !== allowed[index] || item.file !== String(index) + '.original.bin') fail('備份目標路徑不符。');
    const before = item.beforeSha256 === null ? null : bytesOrNull(path.join(set, item.file));
    if (digestOrNull(before) !== item.beforeSha256) fail('備份雜湊不符。');
    const current = digestOrNull(bytesOrNull(item.target));
    if (current !== item.beforeSha256 && current !== item.afterSha256) fail('回復遭外部變更阻擋：' + item.target);
    return { ...item, before, current };
  });
  return { loc, items };
}
function restoreBackup(backupSet) {
  const plan = backupPlan(backupSet);
  if (plan.items.every(x => x.current === x.beforeSha256)) return { status: 'already-restored', backupSet };
  for (const item of plan.items) {
    const current = digestOrNull(bytesOrNull(item.target));
    if (current !== item.current) fail('回復前偵測到外部變更：' + item.target);
    if (current === item.beforeSha256) continue;
    if (item.before === null) fs.unlinkSync(item.target);
    else atomicWrite(item.target, item.before);
  }
  for (const item of plan.items) {
    if (digestOrNull(bytesOrNull(item.target)) !== item.beforeSha256) fail('回復後核對失敗。');
  }
  return { status: 'restored', backupSet, note: '發布副本及備份保留供查核；原本不存在的入口檔已移除。' };
}
export function restoreInstall({ backupSet, confirm }) {
  if (confirm !== true) fail('回復需要明確確認：加上 --confirm。');
  const plan = backupPlan(backupSet);
  return withLock(plan.loc, () => restoreBackup(backupSet));
}
function cli() {
  const [action, ...args] = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--confirm') options.confirm = true;
    else if (['--core', '--out', '--bundle', '--profile', '--codex-home', '--backup'].includes(args[i])) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) fail('參數缺少值：' + args[i]);
      options[args[i].slice(2)] = args[++i];
    } else fail('不支援的參數：' + args[i]);
  }
  const common = {
    bundleDir: options.bundle && path.resolve(options.bundle),
    userProfile: options.profile && path.resolve(options.profile),
    codexHome: options['codex-home'] ? path.resolve(options['codex-home']) : (!options.profile && process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : undefined),
    confirm: options.confirm
  };
  let result;
  if (action === 'build') {
    if (!options.out) fail('build 需要 --out；請指定母體內的發布目錄。');
    result = buildRelease({ coreRoot: path.resolve(options.core || process.cwd()), outDir: path.resolve(options.out) });
    result = { status: 'built', releaseId: result.releaseId, fileCount: result.files.length, bytes: result.files.reduce((sum, x) => sum + x.bytes, 0), liveReferences: result.liveReferences, skipped: result.skipped, warnings: result.warnings, bundleDir: path.resolve(options.out) };
  } else if (action === 'plan') {
    const plan = planInstall(common);
    result = { status: 'planned', action: plan.action, releaseId: plan.manifest.releaseId, targets: plan.items.map(x => ({ path: x.target, exists: x.before !== null, changed: x.beforeSha256 !== x.afterSha256 })), releaseRoot: plan.releaseRoot };
  } else if (action === 'install') result = applyInstall(common);
  else if (action === 'check') result = verifyInstall(common);
  else if (action === 'restore') result = restoreInstall({ backupSet: path.resolve(options.backup || ''), confirm: options.confirm });
  else fail('用法：node publish.mjs build|plan|install|check|restore；安裝與回復需 --confirm。');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { cli(); }
  catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
