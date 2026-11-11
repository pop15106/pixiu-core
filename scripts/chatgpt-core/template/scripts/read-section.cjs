'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { verifySnapshot } = require('./verify-snapshot.cjs');
const MAX_BYTES = 12000;
function readSection(root, relative, start = 1, limit = 80) {
  const manifest = verifySnapshot(root);
  if (!manifest.files.some(item => item.path === relative)) throw Error('路徑不在來源快照清單');
  if (!Number.isSafeInteger(start) || start < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 80)
    throw Error('起始行需為正整數；每次讀取 1 至 80 行');
  const text = fs.readFileSync(path.join(root, 'references/core', relative), 'utf8');
  const lines = text.split(/\r?\n/);
  if (start > lines.length) throw Error('起始行超出檔案範圍');
  const selected = []; let size = 0;
  for (const line of lines.slice(start - 1, start - 1 + limit)) {
    const bytes = Buffer.byteLength(line + '\n');
    if (size + bytes > MAX_BYTES) break;
    selected.push(line); size += bytes;
  }
  if (!selected.length) throw Error('單行超過輸出預算，請以精準符號或原生檔案工具查詢');
  const end = start + selected.length - 1;
  return { sourceCommit: manifest.sourceCommit, path: relative, start, end, totalLines: lines.length,
    bytes: size, nextLine: end < lines.length ? end + 1 : null, text: selected.join('\n') };
}
if (require.main === module) {
  try {
    console.log(JSON.stringify(readSection(path.resolve(__dirname, '..'), process.argv[2],
      Number(process.argv[3] || 1), Number(process.argv[4] || 80)), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
module.exports = { readSection, MAX_BYTES };
