'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { verifySnapshot } = require('./verify-snapshot.cjs');
const { readSection, MAX_BYTES } = require('./read-section.cjs');
const { materializeSource } = require('./materialize-source.cjs');

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
    assert.equal(result.bytes, Buffer.byteLength(JSON.stringify(result, null, 2) + '\n'));
    assert(result.end - result.start + 1 <= 80);
    parts.push(result.text); next = result.nextLine;
  }
  assert.equal(parts.join('\n'), text);
  assert.throws(() => readSection(root, 'source.md', 1, 500), /80/);
  assert.throws(() => readSection(root, '../outside'), /清單/);
});

test('特殊字元編碼後仍受輸出上限約束，續讀能還原原文', t => {
  const text = Array.from({ length: 180 }, (_, i) => i + ':"\\\t'.repeat(90)).join('\n');
  const { root } = fixture(t, text);
  const parts = []; let next = 1;
  while (next !== null) {
    const result = readSection(root, 'source.md', next);
    const actual = Buffer.byteLength(JSON.stringify(result, null, 2) + '\n');
    assert.equal(result.bytes, actual);
    assert(actual <= MAX_BYTES);
    parts.push(result.text); next = result.nextLine;
  }
  assert.equal(parts.join('\n'), text);
});

test('單行跳脫後超過預算時明確停止，不輸出超額內容', t => {
  const { root } = fixture(t, '"'.repeat(11999));
  assert.throws(() => readSection(root, 'source.md'), /編碼後超過輸出預算/);
});

test('來源根目錄與 references 目錄的連結都在讀取前拒絕', t => {
  for (const relative of ['references/core', 'references']) {
    const { root } = fixture(t, '只供測試的資料');
    const target = path.join(root, relative);
    const external = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-link-target-'));
    t.after(() => fs.rmSync(external, { recursive: true, force: true }));
    const moved = path.join(external, 'moved');
    fs.renameSync(target, moved);
    fs.symlinkSync(moved, target, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => verifySnapshot(root), /連結/);
    assert.equal(fs.existsSync(path.join(moved, relative === 'references' ? 'core/source.md' : 'source.md')), true);
  }
});

test('來源目錄中的未登錄檔案會阻擋完整性驗證', t => {
  const { root } = fixture(t, '原始資料');
  fs.writeFileSync(path.join(root, 'references/core/unlisted.js'), '未登錄測試資料');
  assert.throws(() => verifySnapshot(root), /未登錄/);
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

test('嵌入技能以參考檔儲存，原始路徑讀取及完整還原保留位元組', t => {
  const text = '---\nname: nested-source\n---\n原始技能規格';
  const { root, m } = fixture(t, text);
  m.files[0].path = 'skills/example/SKILL.md';
  m.files[0].storagePath = 'skills/example/SKILL.reference.md';
  const target = path.join(root, 'references/core', m.files[0].storagePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(path.join(root, 'references/core/source.md'), target);
  fs.writeFileSync(path.join(root, 'references/snapshot.json'), JSON.stringify(m));
  assert.equal(readSection(root, m.files[0].path).text, text);
  const restored = materializeSource(root);
  t.after(() => fs.rmSync(restored.root, { recursive: true, force: true }));
  assert.equal(fs.readFileSync(path.join(restored.root, m.files[0].path), 'utf8'), text);
  assert.equal(fs.existsSync(path.join(root, 'references/core', m.files[0].path)), false);
  m.files.push({ ...m.files[0], path: 'another-source.md' });
  fs.writeFileSync(path.join(root, 'references/snapshot.json'), JSON.stringify(m));
  assert.throws(() => verifySnapshot(root), /儲存路徑/);
});
