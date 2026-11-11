'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { verifySnapshot } = require('./verify-snapshot.cjs');
const { readSection, MAX_BYTES } = require('./read-section.cjs');

function fixture(t, text) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-skill-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'references/core'), { recursive: true });
  fs.writeFileSync(path.join(root, 'references/core/source.md'), text);
  const m = { sourceCommit: 'a'.repeat(40), files: [{ path: 'source.md',
    bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') }] };
  fs.writeFileSync(path.join(root, 'references/snapshot.json'), JSON.stringify(m));
  return { root, m };
}

test('完整性檢查拒絕改動過的來源', t => {
  const { root } = fixture(t, '原始資料');
  assert.equal(verifySnapshot(root).files.length, 1);
  fs.writeFileSync(path.join(root, 'references/core/source.md'), '改動資料');
  assert.throws(() => verifySnapshot(root), /完整性/);
});

test('清單拒絕路徑穿越與重複路徑', t => {
  const { root, m } = fixture(t, '原始資料');
  const target = path.join(root, 'references/snapshot.json');
  m.files[0].path = '../outside';
  fs.writeFileSync(target, JSON.stringify(m));
  assert.throws(() => verifySnapshot(root), /路徑/);
  m.files[0].path = 'source.md'; m.files.push({ ...m.files[0] });
  fs.writeFileSync(target, JSON.stringify(m));
  assert.throws(() => verifySnapshot(root), /重複/);
});

test('分段載入守住預算且續讀後保留完整內容', t => {
  const text = Array.from({ length: 190 }, (_, i) => String(i) + '參考內容'.repeat(60)).join('\n');
  const { root } = fixture(t, text);
  let next = 1; const parts = [];
  while (next !== null) {
    const result = readSection(root, 'source.md', next);
    assert(result.bytes <= MAX_BYTES);
    assert(result.end - result.start + 1 <= 80);
    parts.push(result.text); next = result.nextLine;
  }
  assert.equal(parts.join('\n'), text);
  assert.throws(() => readSection(root, 'source.md', 1, 500), /80/);
  assert.throws(() => readSection(root, '../outside'), /清單/);
});

test('主入口與適配工具也必須符合母體來源', t => {
  const { root, m } = fixture(t, '母體規格');
  const data = '主入口';
  fs.writeFileSync(path.join(root, 'guide.md'), data);
  m.adapterFiles = [{ path: 'guide.md', bytes: Buffer.byteLength(data),
    sha256: createHash('sha256').update(data).digest('hex') }];
  fs.writeFileSync(path.join(root, 'references/snapshot.json'), JSON.stringify(m));
  assert.equal(verifySnapshot(root).adapterFiles.length, 1);
  fs.writeFileSync(path.join(root, 'guide.md'), '已改動的入口');
  assert.throws(() => verifySnapshot(root), /完整性/);
});
