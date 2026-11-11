'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifySnapshot } = require('./verify-snapshot.cjs');

function materializeSource(root = path.resolve(__dirname, '..')) {
  const manifest = verifySnapshot(root);
  // 新建獨立暫存目錄，保留使用者現有來源與工作成果。
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-core-source-'));
  for (const item of manifest.files) {
    const target = path.join(output, item.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, 'references/core', item.storagePath || item.path), target);
  }
  return { sourceCommit: manifest.sourceCommit, root: output, files: manifest.files.length };
}
if (require.main === module) {
  try { console.log(JSON.stringify(materializeSource())); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
module.exports = { materializeSource };
