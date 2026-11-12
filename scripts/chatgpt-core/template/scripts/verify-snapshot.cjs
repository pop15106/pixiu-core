'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

function relativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes(':') ||
      value.includes('\0') || path.posix.isAbsolute(value) ||
      value.split('/').some(part => !part || part === '.' || part === '..'))
    throw Error('快照含無效路徑');
  return value;
}

function checkedPath(root, relative, directory = false) {
  let current = root;
  const base = fs.lstatSync(current);
  if (base.isSymbolicLink() || !base.isDirectory()) throw Error('快照根目錄含連結或型別錯誤');
  const parts = relativePath(relative).split('/');
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw Error('快照包含連結：' + relative);
    const needsDirectory = index < parts.length - 1 || directory;
    if (needsDirectory ? !stat.isDirectory() : !stat.isFile())
      throw Error('快照檔案型別錯誤：' + relative);
  }
  return current;
}

function verifySnapshot(root = path.resolve(__dirname, '..')) {
  root = path.resolve(root);
  const manifest = JSON.parse(fs.readFileSync(checkedPath(root, 'references/snapshot.json'), 'utf8'));
  if (!/^[a-f0-9]{40}$/.test(manifest.sourceCommit) || !Array.isArray(manifest.files) || !manifest.files.length)
    throw Error('快照清單格式無效');
  const core = checkedPath(root, 'references/core', true);
  const groups = [{ prefix: 'references/core/', files: manifest.files },
    { prefix: '', files: manifest.adapterFiles || [] },
    { prefix: '', files: manifest.generatedFiles || [] }];
  for (const { prefix, files } of groups) {
    if (!Array.isArray(files)) throw Error('快照清單格式無效');
    const names = new Set();
    const storedNames = new Set();
    for (const item of files) {
      const name = relativePath(item.path);
      const stored = relativePath(item.storagePath || name);
      if (names.has(name)) throw Error('快照含重複路徑');
      if (storedNames.has(stored)) throw Error('快照含重複儲存路徑');
      if (!Number.isSafeInteger(item.bytes) || item.bytes < 0 || !/^[a-f0-9]{64}$/.test(item.sha256))
        throw Error('快照檔案紀錄無效：' + name);
      names.add(name);
      storedNames.add(stored);
      const bytes = fs.readFileSync(checkedPath(root, prefix + stored));
      if (bytes.length !== item.bytes || createHash('sha256').update(bytes).digest('hex') !== item.sha256)
        throw Error('快照完整性驗證失敗：' + name);
    }
  }
  // 檢查整個來源目錄，額外檔案與目錄連結不能落在清單之外。
  const expected = new Set(manifest.files.map(item => item.storagePath || item.path));
  function inspect(directory, prefix = '') {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (entry.isSymbolicLink()) throw Error('快照包含連結：' + relative);
      if (entry.isDirectory()) inspect(path.join(directory, entry.name), relative + '/');
      else if (!entry.isFile() || !expected.has(relative)) throw Error('快照包含未登錄檔案：' + relative);
    }
  }
  inspect(core);
  return manifest;
}
if (require.main === module) {
  try {
    const m = verifySnapshot();
    console.log(JSON.stringify({ status: 'PASS', sourceCommit: m.sourceCommit, files: m.files.length }));
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
module.exports = { verifySnapshot };
