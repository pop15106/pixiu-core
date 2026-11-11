'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

function verifySnapshot(root = path.resolve(__dirname, '..')) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'references/snapshot.json'), 'utf8'));
  if (!/^[a-f0-9]{40}$/.test(manifest.sourceCommit) || !Array.isArray(manifest.files) || !manifest.files.length)
    throw Error('快照清單格式無效');
  const groups = [{ base: path.join(root, 'references/core'), files: manifest.files },
    { base: root, files: manifest.adapterFiles || [] },
    { base: root, files: manifest.generatedFiles || [] }];
  for (const { base: core, files } of groups) {
    const names = new Set();
    for (const item of files) {
    if (typeof item.path !== 'string' || !item.path || item.path.includes('\\') ||
        path.posix.isAbsolute(item.path) || item.path.split('/').some(p => !p || p === '.' || p === '..') ||
        names.has(item.path)) throw Error('快照含重複或無效路徑');
    names.add(item.path);
    const target = path.join(core, item.path);
    let current = core;
    for (const part of item.path.split('/')) {
      current = path.join(current, part);
      if (fs.lstatSync(current).isSymbolicLink()) throw Error('快照包含連結：' + item.path);
    }
    const bytes = fs.readFileSync(target);
    if (bytes.length !== item.bytes || createHash('sha256').update(bytes).digest('hex') !== item.sha256)
      throw Error('快照完整性驗證失敗：' + item.path);
    }
  }
  return manifest;
}
if (require.main === module) {
  try {
    const m = verifySnapshot();
    console.log(JSON.stringify({ status: 'PASS', sourceCommit: m.sourceCommit, files: m.files.length }));
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
module.exports = { verifySnapshot };
