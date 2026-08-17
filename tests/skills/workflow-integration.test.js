'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('Recap 使用 pointer-only 且沒有舊版完整規劃正文區塊', () => {
  const recap = read('skills/pixiu-session-recap/SKILL.md');
  assert.match(recap, /Source of Truth pointer-only/);
  assert.match(recap, /Unresolved Decision IDs/);
  assert.doesNotMatch(recap, /## 📐 當前規劃完整內容/);
});

test('spec 有 Decision Trace、Test Seams 與 Shared Understanding Gate', () => {
  const spec = read('skills/spec/SKILL.md');
  assert.match(spec, /Decision Trace/);
  assert.match(spec, /## Test Seams/);
  assert.match(spec, /Shared Understanding Gate/);
});

test('prd-create 的 prd-breakdown dependency 已存在', () => {
  assert.equal(fs.existsSync(path.join(root, 'skills', 'prd-breakdown', 'SKILL.md')), true);
  assert.match(read('skills/prd-create/SKILL.md'), /`prd-breakdown`/);
});

test('code review 維持四軸且 verification 缺證據不可宣稱完成', () => {
  const reviewer = read('agents/code-reviewer.md');
  for (const axis of ['Standards', 'Spec', 'Security', 'Verification']) assert.match(reviewer, new RegExp(axis));
  assert.match(reviewer, /NO_SPEC_SOURCE/);
  assert.match(reviewer, /INCOMPLETE_EVIDENCE/);
});

test('TDD workflow 先定 Test Seam 且 expected result 必須獨立', () => {
  const tdd = read('skills/tdd-workflow/SKILL.md');
  assert.match(tdd, /Identify the Test Seam First/);
  assert.match(tdd, /independent authoritative source/);
});

test('grill-me 與 grill-with-docs 維持 side-effect contract', () => {
  const grillMe = read('skills/grill-me/SKILL.md');
  const grillDocs = read('skills/grill-with-docs/SKILL.md');
  assert.match(grillMe, /不建立檔案/);
  assert.match(grillMe, /不派 sub-agent/);
  assert.match(grillDocs, /不直接修改 `CONTEXT\.md`、ADR、spec 或 Vault/);
});
