#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 只打包明確的 runtime 依賴，不複製整個母體、測試、私人資料或憑證。
export const runtimeFiles = [
  'scripts/devspace-portable/DevSpace.WorkflowStore.mjs',
  'scripts/critical-relay/critical-relay.js',
  'scripts/critical-relay/execution-contract.js',
  'scripts/critical-relay/test-plan.js',
  'scripts/critical-relay/test-runner.js',
  'scripts/critical-relay/evidence-parser.js',
  'scripts/critical-relay/evidence-reporter.js',
  'scripts/critical-relay/evidence-verifier.js',
  'scripts/critical-relay/relay-evidence.js',
  'scripts/critical-relay/run-journal.js',
  'scripts/critical-relay/run-recovery.js',
  'scripts/critical-relay/plan-migration.js',
  'scripts/router/resource-policy.js'
];
const schema = 'pixiu.workflow-bundle.v1';
const manifestName = 'WORKFLOW-BUNDLE.json';
const hash = value => createHash('sha256').update(value).digest('hex');
const serialize = value => JSON.stringify(value, null, 2) + '\n';
const moduleName = 'DevSpace.WorkflowStore.mjs';
const sourceEntry = runtimeFiles[0];

function safePath(root, relative, missing = false) {
  if (typeof relative !== 'string' || /[:\\\x00]/u.test(relative) ||
      relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('BUNDLE_UNSAFE_PATH');
  let full = path.resolve(root);
  // 根目錄的父層也檢查，避免安裝根目錄本身是 junction。
  for (let current = full; current !== path.dirname(current); current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('BUNDLE_LINK_BLOCKED');
  }
  for (const part of relative.split('/')) {
    full = path.join(full, part);
    try { if (fs.lstatSync(full).isSymbolicLink()) throw new Error('BUNDLE_LINK_BLOCKED'); }
    catch (error) { if (error.code !== 'ENOENT' || !missing) throw error; }
  }
  return full;
}
function readJson(root, name) { return JSON.parse(fs.readFileSync(safePath(root, name), 'utf8')); }
function writeNew(root, relative, content) {
  const target = safePath(root, relative, true);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(safePath(root, relative, true), content, { flag: 'wx', mode: 0o600 });
}
function atomicReplace(root, relative, bytes) {
  const target = safePath(root, relative, true);
  const temp = `${relative}.${randomUUID()}.tmp`;
  writeNew(root, temp, bytes);
  const fd = fs.openSync(safePath(root, temp), 'r+');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(safePath(root, temp), target);
}
function fingerprint(entries) { return hash(JSON.stringify(entries.map(item => [item.path, item.sha256]))); }
function filesBelow(root, prefix = '') {
  return fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).flatMap(item => {
    const relative = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isSymbolicLink()) throw new Error('BUNDLE_LINK_BLOCKED');
    return item.isDirectory() ? filesBelow(root, relative) : [relative];
  }).sort();
}

export function assembleBundle(sourceRoot, destination) {
  const entries = runtimeFiles.map(relative => {
    const bytes = fs.readFileSync(safePath(sourceRoot, relative));
    return { path: relative, bytes, sha256: hash(bytes), length: bytes.length };
  });
  let sourceCommit = null;
  try { sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8', windowsHide: true }).trim(); }
  catch { throw new Error('BUNDLE_SOURCE_COMMIT_REQUIRED'); }
  if (!/^[a-f0-9]{40,64}$/u.test(sourceCommit)) throw new Error('BUNDLE_SOURCE_COMMIT_INVALID');
  const sourceDirty = execFileSync('git', ['status', '--porcelain=v1', '--', ...runtimeFiles],
    { cwd: sourceRoot, encoding: 'utf8', windowsHide: true }).trim().length > 0;
  const manifest = { schemaVersion: schema, sourceCommit, sourceDirty, contentDigest: fingerprint(entries),
    executionSchema: 'pixiu.cr-execution.v2', entry: sourceEntry,
    files: entries.map(({ bytes, ...entry }) => entry) };
  // 新目的地專用；不覆蓋正在使用或曾經驗證的套件。
  if (fs.existsSync(destination)) throw new Error('BUNDLE_DESTINATION_EXISTS');
  safePath(path.dirname(destination), path.basename(destination), true);
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of entries) writeNew(destination, entry.path, entry.bytes);
  writeNew(destination, manifestName, serialize(manifest));
  return verifyBundle(destination);
}

export function verifyBundle(bundleRoot) {
  const manifest = readJson(bundleRoot, manifestName);
  if (typeof manifest.sourceDirty !== 'boolean' || !/^[a-f0-9]{40,64}$/u.test(manifest.sourceCommit) || manifest.schemaVersion !== schema || manifest.entry !== sourceEntry || manifest.executionSchema !== 'pixiu.cr-execution.v2' ||
      !Array.isArray(manifest.files) || manifest.files.length !== runtimeFiles.length ||
      new Set(manifest.files.map(item => item.path)).size !== runtimeFiles.length ||
      runtimeFiles.some(name => !manifest.files.some(item => item.path === name))) throw new Error('BUNDLE_MANIFEST_INVALID');
  for (const entry of manifest.files) {
    const target = safePath(bundleRoot, entry.path);
    if (!fs.statSync(target).isFile()) throw new Error(`BUNDLE_FILE_INVALID:${entry.path}`);
    const bytes = fs.readFileSync(target);
    if (hash(bytes) !== entry.sha256 || bytes.length !== entry.length) throw new Error(`BUNDLE_HASH_MISMATCH:${entry.path}`);
  }
  if (fingerprint(manifest.files) !== manifest.contentDigest ||
      JSON.stringify(filesBelow(bundleRoot)) !== JSON.stringify([...runtimeFiles, manifestName].sort())) throw new Error('BUNDLE_FILE_SET_MISMATCH');
  return manifest;
}

export function probeBundle(bundleRoot) {
  const manifest = verifyBundle(bundleRoot);
  const entryUrl = pathToFileURL(safePath(bundleRoot, sourceEntry)).href;
  const schemaUrl = pathToFileURL(safePath(bundleRoot, 'scripts/critical-relay/execution-contract.js')).href;
  const code = `const m=await import(${JSON.stringify(entryUrl)}); const c=(await import(${JSON.stringify(schemaUrl)})).default;
    if(typeof m.createWorkflowController!=='function'||c.EVIDENCE_SCHEMA_VERSION!=='pixiu.cr-execution.v2') throw Error('BUNDLE_RUNTIME_INVALID');
    console.log(JSON.stringify({node:process.version,executionSchema:c.EVIDENCE_SCHEMA_VERSION,loadedModule:${JSON.stringify(entryUrl)}}));`;
  const value = execFileSync(process.execPath, ['--input-type=module', '-e', code],
    { cwd: bundleRoot, encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 });
  return { ...JSON.parse(value.trim()), sourceCommit: manifest.sourceCommit, sourceDirty: manifest.sourceDirty, contentDigest: manifest.contentDigest };
}

function installLock(bin) {
  fs.mkdirSync(bin, { recursive: true });
  const lockPath = safePath(bin, 'workflow-install.lock', true);
  const fd = fs.openSync(lockPath, 'wx', 0o600);
  fs.writeFileSync(fd, serialize({ pid: process.pid, owner: os.userInfo().username }));
  return () => { fs.closeSync(fd); fs.unlinkSync(lockPath); };
}
function pointerFor(manifest) {
  return `// 此入口由受驗證的 workflow 套件產生；舊版本與資料保留以供回復。\n` +
    `export * from './workflow-releases/${manifest.contentDigest}/${sourceEntry}';\n` +
    `export const workflowBundleDigest = '${manifest.contentDigest}';\n`;
}

export function installBundle(bundleRoot, bin) {
  const manifest = verifyBundle(bundleRoot);
  probeBundle(bundleRoot);
  const release = `workflow-releases/${manifest.contentDigest}`;
  const releasePath = safePath(bin, release, true);
  const target = safePath(bin, moduleName, true);
  const nextBytes = Buffer.from(pointerFor(manifest));
  const releaseLock = installLock(bin);
  try {
    const before = fs.existsSync(target) ? fs.readFileSync(target) : null;
    if (fs.existsSync(releasePath)) {
      if (verifyBundle(releasePath).contentDigest !== manifest.contentDigest) throw new Error('BUNDLE_EXISTING_RELEASE_INVALID');
    } else {
      const stage = `${release}.stage-${randomUUID()}`;
      fs.mkdirSync(safePath(bin, stage, true), { recursive: true });
      for (const name of [...runtimeFiles, manifestName]) writeNew(bin, `${stage}/${name}`, fs.readFileSync(safePath(bundleRoot, name)));
      probeBundle(safePath(bin, stage));
      fs.renameSync(safePath(bin, stage), releasePath);
    }
    const actual = probeBundle(releasePath);
    if (before && before.equals(nextBytes)) return { Path: target, Changed: false, ...actual };
    const receiptId = randomUUID();
    const receiptDir = `workflow-receipts/${receiptId}`;
    fs.mkdirSync(safePath(bin, receiptDir, true), { recursive: true });
    if (before) writeNew(bin, `${receiptDir}/previous.mjs`, before);
    const receipt = { schemaVersion: 'pixiu.workflow-install.v1', receiptId, target: moduleName,
      previousDigest: before ? hash(before) : null, installedDigest: hash(nextBytes), bundleDigest: manifest.contentDigest };
    writeNew(bin, `${receiptDir}/receipt.json`, serialize(receipt));
    // 全部模組先驗證，再以單一入口的原子替換切換版本。
    if (before && (!fs.existsSync(target) || !fs.readFileSync(target).equals(before))) throw new Error('BUNDLE_TARGET_CHANGED');
    if (!before && fs.existsSync(target)) throw new Error('BUNDLE_TARGET_CHANGED');
    atomicReplace(bin, moduleName, nextBytes);
    return { Path: target, Changed: true, receiptId, ...actual };
  } finally { releaseLock(); }
}

export function rollbackBundle(bin, receiptId) {
  if (!/^[a-f0-9-]{36}$/u.test(receiptId)) throw new Error('BUNDLE_RECEIPT_INVALID');
  const releaseLock = installLock(bin);
  try {
    const dir = `workflow-receipts/${receiptId}`;
    const receipt = readJson(bin, `${dir}/receipt.json`);
    if (receipt.receiptId !== receiptId || receipt.target !== moduleName || receipt.schemaVersion !== 'pixiu.workflow-install.v1') throw new Error('BUNDLE_RECEIPT_INVALID');
    const target = safePath(bin, moduleName);
    const bytes = fs.readFileSync(target);
    if (hash(bytes) !== receipt.installedDigest) throw new Error('BUNDLE_ROLLBACK_TARGET_CHANGED');
    if (receipt.previousDigest === null) throw new Error('BUNDLE_NO_PREVIOUS_VERSION');
    const previous = fs.readFileSync(safePath(bin, `${dir}/previous.mjs`));
    if (hash(previous) !== receipt.previousDigest) throw new Error('BUNDLE_BACKUP_CHANGED');
    atomicReplace(bin, moduleName, previous);
    return { Path: target, restoredDigest: receipt.previousDigest, receiptId, restarted: false };
  } finally { releaseLock(); }
}

export function installFromSource(sourceFile, bin) {
  const sourceDirectory = path.dirname(path.resolve(sourceFile));
  if (path.basename(sourceFile) !== moduleName) throw new Error('BUNDLE_SOURCE_ENTRY_INVALID');
  safePath(sourceDirectory, moduleName);
  const prepared = path.join(sourceDirectory, 'workflow-runtime');
  if (fs.existsSync(prepared)) {
    const manifest = verifyBundle(prepared);
    const expected = manifest.files.find(item => item.path === sourceEntry);
    if (hash(fs.readFileSync(sourceFile)) !== expected.sha256) throw new Error('BUNDLE_SOURCE_ENTRY_MISMATCH');
    return installBundle(prepared, bin);
  }
  if (path.basename(sourceDirectory) !== 'devspace-portable' || path.basename(path.dirname(sourceDirectory)) !== 'scripts') {
    throw new Error('BUNDLE_PREPARED_RUNTIME_REQUIRED');
  }
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-workflow-bundle-'));
  try {
    const preparedTemp = path.join(temp, 'runtime');
    assembleBundle(path.resolve(sourceDirectory, '../..'), preparedTemp);
    return installBundle(preparedTemp, bin);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [action, a, b] = process.argv.slice(2);
    let result;
    if (action === 'assemble') result = assembleBundle(path.resolve(a), path.resolve(b));
    else if (action === 'verify') result = probeBundle(path.resolve(a));
    else if (action === 'install') result = installFromSource(path.resolve(a), path.resolve(b));
    else if (action === 'rollback') result = rollbackBundle(path.resolve(a), b);
    else throw new Error('用法：workflow-bundle.mjs assemble|verify|install|rollback <path> [path或receiptId]');
    console.log(JSON.stringify(result));
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
