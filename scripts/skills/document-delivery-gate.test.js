#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const core = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(core, relativePath), 'utf8');
}

function normalizedBody(text) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
    .replace(/^disable-model-invocation:\s*true\n/m, '').trim();
}

function testA01A02WorkModeDualPath() {
  const bootstrap = read('vault/bootstrap/SESSION-BOOTSTRAP.md');
  const workflow = read('skills/system-documentation/references/production-workflow.md');

  assert.match(bootstrap, /成功轉入.*沿用同一 Skill \/ Capability/);
  assert.match(bootstrap, /不可用.*轉入失敗.*被拒絕/);
  assert.match(bootstrap, /立即改用目前對話可用工具/);
  assert.match(bootstrap, /不再次要求切換/);
  assert.match(workflow, /Work mode 成功轉入/);
  assert.match(workflow, /Work mode 不可用、轉入失敗、被拒絕/);
  assert.match(workflow, /兩條路使用相同的 QA Gate、Artifact lifecycle 與交付規則/);
}

function testA03A04ValidatedDeliveryGate() {
  const skill = read('skills/system-documentation/SKILL.md');
  const workflow = read('skills/system-documentation/references/production-workflow.md');
  const verification = read('skills/system-documentation/references/verification.md');

  for (const content of [skill, verification]) {
    assert.match(content, /DRAFT -> VALIDATED -> DELIVERED -> POLISHING/);
  }
  assert.match(workflow, /驗證通過後標記 `VALIDATED`/);
  assert.match(workflow, /`VALIDATED` 後立即轉成 `DELIVERED`/);
  assert.match(verification, /截字、超出版面、真正空白頁、嚴重錯位或中文字型異常/);
  assert.match(workflow, /使用者要求的內容、標題或章節缺漏/);
}

function testA05PolishDoesNotBlockDelivery() {
  const workflow = read('skills/system-documentation/references/production-workflow.md');
  const verification = read('skills/system-documentation/references/verification.md');

  assert.match(workflow, /2 頁或 3 頁的差異/);
  assert.match(workflow, /最後一頁只有少量內容，但不是空白頁/);
  assert.match(workflow, /單純「3 頁可以壓成 2 頁」不是阻塞條件/);
  assert.match(verification, /段距、spacing、cell margin 還可微調/);
  assert.doesNotMatch(workflow, /是否出現一頁只剩 1~3 行文字/);
}

function testA06ProgressUpdates() {
  const skill = read('skills/system-documentation/SKILL.md');
  const makeDocx = read('skills/make-docx/SKILL.md');

  assert.match(skill, /「初版產出」「最低 QA 結果」「正式交付」三個節點/);
  assert.match(makeDocx, /「初版產出」「最低 QA 結果」「交付」回報一次/);
  assert.match(makeDocx, /剩餘工作只屬版面微調/);
}

function testA07ArtifactLifecycle() {
  const workflow = read('skills/system-documentation/references/production-workflow.md');
  const makeDocx = read('skills/make-docx/SKILL.md');

  for (const content of [workflow, makeDocx]) {
    assert.match(content, /working draft -> QA render -> final artifact/);
  }
  assert.match(workflow, /QA 用 PDF\/PNG 是工作產物/);
}

function testA08DownloadEntry() {
  const verification = read('skills/system-documentation/references/verification.md');
  const makeDocx = read('skills/make-docx/SKILL.md');

  assert.match(verification, /最終回覆必須提供可使用的下載入口/);
  assert.match(makeDocx, /直接提供使用者可用下載入口或 Host 可開啟的 Artifact reference/);
}

function testPublishedCopiesStayAligned() {
  const relativePaths = [
    'system-documentation/SKILL.md',
    'system-documentation/references/production-workflow.md',
    'system-documentation/references/verification.md',
    'make-docx/SKILL.md'
  ];

  for (const relativePath of relativePaths) {
    const source = read(`skills/${relativePath}`);
    const published = read(`.agents/skills/${relativePath}`);
    assert.strictEqual(
      normalizedBody(source),
      normalizedBody(published),
      `${relativePath} 主來源與 .agents 發布副本不一致`
    );
  }
}

for (const test of [
  testA01A02WorkModeDualPath,
  testA03A04ValidatedDeliveryGate,
  testA05PolishDoesNotBlockDelivery,
  testA06ProgressUpdates,
  testA07ArtifactLifecycle,
  testA08DownloadEntry,
  testPublishedCopiesStayAligned
]) {
  test();
  process.stdout.write(`ok ${test.name}\n`);
}
