#!/usr/bin/env node
'use strict';

// 由 resolve-capabilities.test.js 載入，讓既有 router 測試指令一併涵蓋；也可單獨以 node --test 執行。

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {
  INDEX_RELATIVE,
  MANIFEST_RELATIVE,
  buildRoutingIndex,
  checkRoutingIndex,
  loadFiles
} = require('./build-routing-index');
const { normalizeText, resolveCapabilities } = require('./resolve-capabilities');
const { assertOnDemandContent } = require('./resource-policy');

const core = path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(core, MANIFEST_RELATIVE), 'utf8'));
// 內容比對不計換行格式；Windows checkout 可能是 CRLF。
const index = fs.readFileSync(path.join(core, INDEX_RELATIVE), 'utf8').replace(/\r\n/g, '\n');
const SINGLE_READ_BUDGET_BYTES = 12000;

// 只依索引表格與「選取規則」重建路由，用來證明查表結果與 Router 相同。
function parseIndexTable(content) {
  return content.split('\n')
    .filter(line => /^\| (?:★ )?`/u.test(line))
    .map(line => {
      const cells = line.split(' | ').map(value => value.replace(/^\| |\s*\|$/gu, '').trim());
      const [name, priority, keywords, aliases, files] = cells;
      const list = value => (value === '—' ? [] : value.split('、'));
      return {
        id: name.replace(/^★ /u, '').replace(/`/gu, ''),
        required: name.startsWith('★ '),
        priority: Number(priority),
        keywords: list(keywords),
        aliases: list(aliases),
        files: list(files).map(value => value.replace(/`/gu, '').replace(/（本機）$/u, ''))
      };
    });
}

function isWordChar(value) {
  return typeof value === 'string' && /^[a-z0-9_]$/iu.test(value);
}

function negated(text, position, phrase) {
  const prefix = text.slice(Math.max(0, position - 24), position);
  return (/不\s*$/u.test(prefix) && /^(?:開|建立)/u.test(phrase)) ||
    /(?:先不要|暫時不要|不是要|不要|不用|別|取消|關閉|不開)[^。！？!?]{0,12}$/u.test(prefix);
}

function hits(text, phrase, bounded) {
  for (let position = text.indexOf(phrase); position >= 0; position = text.indexOf(phrase, position + 1)) {
    const left = position > 0 ? text[position - 1] : '';
    const right = text[position + phrase.length] || '';
    const blocked = bounded && (
      (isWordChar(phrase[0]) && isWordChar(left)) ||
      (isWordChar(phrase[phrase.length - 1]) && isWordChar(right)));
    if (!blocked && !negated(text, position, phrase)) return true;
  }
  return false;
}

function resolveFromIndex(request, rows, limit = 3) {
  const text = normalizeText(request);
  const matched = rows.map(row => {
    const found = new Set([
      ...row.keywords.map(normalizeText).filter(phrase => phrase && hits(text, phrase, false)),
      ...row.aliases.map(normalizeText).filter(phrase => phrase && hits(text, phrase, true))
    ]);
    return { row, score: found.size };
  }).filter(item => item.score > 0)
    .sort((left, right) => (right.row.priority - left.row.priority) ||
      (right.score - left.score) || left.row.id.localeCompare(right.row.id));
  const selected = [...matched.filter(item => item.row.required), ...matched.filter(item => !item.row.required)]
    .slice(0, limit).map(item => item.row);
  const files = [];
  for (const row of selected) for (const file of row.files) if (!files.includes(file)) files.push(file);
  return { capabilities: selected.map(row => row.id), filesToLoad: files };
}

test('路由索引與 Manifest 同步', () => {
  const result = checkRoutingIndex(core);
  assert.strictEqual(result.upToDate, true,
    `${INDEX_RELATIVE} 已過期，請執行 node scripts/router/build-routing-index.js`);
  assert.strictEqual(buildRoutingIndex(manifest), buildRoutingIndex(manifest), '產生結果必須固定');
});

test('路由索引完整列出每個能力、觸發詞與載入檔案', () => {
  const rows = parseIndexTable(index);
  assert.deepStrictEqual(rows.map(row => row.id).sort(), manifest.capabilities.map(item => item.id).sort());
  for (const capability of manifest.capabilities) {
    const row = rows.find(item => item.id === capability.id);
    assert.strictEqual(row.required, capability.requiredWhenMatched === true, capability.id);
    assert.strictEqual(row.priority, capability.priority || 0, capability.id);
    assert.deepStrictEqual(row.keywords, capability.keywords || [], capability.id);
    assert.deepStrictEqual(row.aliases, capability.aliases || [], capability.id);
    assert.deepStrictEqual(row.files, loadFiles(capability), capability.id);
  }
  const priorities = rows.map(row => row.priority);
  assert.deepStrictEqual(priorities, [...priorities].sort((left, right) => right - left), '表格須依優先度排序');
});

test('路由索引維持按需載入且單次可讀完', () => {
  assertOnDemandContent(index, INDEX_RELATIVE);
  const diskBytes = fs.statSync(path.join(core, INDEX_RELATIVE)).size;
  assert.ok(diskBytes <= SINGLE_READ_BUDGET_BYTES,
    `路由索引過大：${diskBytes}/${SINGLE_READ_BUDGET_BYTES} bytes`);
  for (const file of Object.keys(manifest.resourcePolicy?.localPrivate || {})) {
    if (index.includes('`' + file + '`')) assert.ok(index.includes('`' + file + '`（本機）'), file);
  }
});

test('依索引查表的結果與 Router 一致', () => {
  const rows = parseIndexTable(index);
  const requests = [
    '把這句翻譯成英文',
    '確認 PCLMS L1 Java 排程 procedure',
    '幫我整理 recap 現在到哪',
    '幫我收尾，跑驗證',
    'DevSpace 斷線了，切 Git 繼續',
    '完整自動接力',
    '對抗搜尋，開完整自動接力',
    '開 CR',
    'CR研究',
    '不要開 CR，先看程式',
    '先不要完整自動接力',
    'Pro析',
    'X析',
    'CRD',
    'scrd 不是別名',
    '修 bug：登入流程的 token 驗證測試失敗',
    '幫我產出報修覆核單',
    'PM 說要追加需求，幫我做需求確認',
    '這個 SQL 查詢效能很差，幫我找根因',
    'auto mode 自動放行',
    '根據你對我的了解，整理我的偏好',
    '幫我優化這段 system prompt',
    '第二大腦 qdrant 查不到',
    'agent team 平行處理',
    'ＣＲ　風險盤點'
  ];
  for (const request of requests) {
    const expected = resolveCapabilities(request, manifest);
    const actual = resolveFromIndex(request, rows);
    assert.deepStrictEqual(actual.capabilities, expected.capabilities, request);
    assert.deepStrictEqual(actual.filesToLoad, expected.filesToLoad, request);
  }
});
