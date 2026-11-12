'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { verifySnapshot } = require('./verify-snapshot.cjs');
const MAX_BYTES = 12000;

function response(manifest, relative, start, lines, selected) {
  const end = start + selected.length - 1;
  const text = selected.join('\n');
  const result = { sourceCommit: manifest.sourceCommit, path: relative, start, end,
    totalLines: lines.length, textBytes: Buffer.byteLength(text), bytes: 0,
    nextLine: end < lines.length ? end + 1 : null, text };
  // 計入 JSON 跳脫、欄位及 CLI 換行；bytes 欄位本身也占用輸出空間。
  let size = Buffer.byteLength(JSON.stringify(result, null, 2) + '\n');
  while (result.bytes !== size) {
    result.bytes = size;
    size = Buffer.byteLength(JSON.stringify(result, null, 2) + '\n');
  }
  return result;
}

function readSection(root, relative, start = 1, limit = 80) {
  const manifest = verifySnapshot(root);
  const source = manifest.files.find(item => item.path === relative);
  if (!source) throw Error('路徑不在來源快照清單');
  if (!Number.isSafeInteger(start) || start < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 80)
    throw Error('起始行需為正整數；每次讀取 1 至 80 行');
  const text = fs.readFileSync(path.join(root, 'references/core', source.storagePath || relative), 'utf8');
  const lines = text.split(/\r?\n/);
  if (start > lines.length) throw Error('起始行超出檔案範圍');
  const selected = []; let result = null;
  for (const line of lines.slice(start - 1, start - 1 + limit)) {
    if (Buffer.byteLength(line) > MAX_BYTES) break;
    const candidate = response(manifest, relative, start, lines, [...selected, line]);
    if (candidate.bytes > MAX_BYTES) break;
    selected.push(line); result = candidate;
  }
  if (!result) throw Error('單行編碼後超過輸出預算，請以精準符號或原生檔案工具查詢');
  return result;
}
if (require.main === module) {
  try {
    console.log(JSON.stringify(readSection(path.resolve(__dirname, '..'), process.argv[2],
      Number(process.argv[3] || 1), Number(process.argv[4] || 80)), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
module.exports = { readSection, MAX_BYTES };
