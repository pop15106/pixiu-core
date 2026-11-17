#!/usr/bin/env node
'use strict';

// 從 Capability Manifest 產生精簡路由索引，給無法執行 Router 的工具查表。
// 能執行指令的工具仍以 resolve-capabilities.js 為準；本檔只負責把同一份資料轉成可讀表格。

const fs = require('node:fs');
const path = require('node:path');

const CORE_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_RELATIVE = 'vault/capabilities/capability-manifest.json';
const INDEX_RELATIVE = 'vault/capabilities/ROUTING.md';
const HARD_CAPABILITY_LIMIT = 3;

function capabilityLimit(manifest) {
  const value = manifest.maxCapabilitiesPerRequest;
  const requested = Number.isInteger(value) && value >= 0 ? value : HARD_CAPABILITY_LIMIT;
  return Math.min(requested, HARD_CAPABILITY_LIMIT);
}

function cell(value) {
  return String(value).replace(/\|/gu, '／').replace(/\s*\r?\n\s*/gu, ' ').trim();
}

function code(value) {
  return '`' + cell(value).replace(/`/gu, "'") + '`';
}

function listCell(values) {
  return values.length ? values.map(cell).join('、') : '—';
}

// 表格以「、」分隔清單；含分隔符號的值會讓查表產生歧義，直接擋下要求修正 Manifest。
function assertTableSafe(value, label) {
  if (typeof value !== 'string' || !value || value !== value.trim() || /[、|`\r\n]/u.test(value) || value === '—') {
    throw new Error(`${label} 無法安全寫入路由索引：${JSON.stringify(value)}`);
  }
}

function loadFiles(capability) {
  const load = capability.load || {};
  const files = [];
  for (const group of ['skills', 'contexts', 'governance']) {
    for (const file of load[group] || []) {
      if (!files.includes(file)) files.push(file);
    }
  }
  return files;
}

function isLocalOnly(file, manifest) {
  const localPrivate = manifest.resourcePolicy?.localPrivate || {};
  return file.startsWith('vault/memory/') || Object.hasOwn(localPrivate, file);
}

// 排序與 Router 的 rankMatches 一致：先比 priority，同分時以 id 固定順序。
function orderedCapabilities(manifest) {
  return [...(manifest.capabilities || [])].sort((left, right) => {
    const priorityDiff = (right.priority || 0) - (left.priority || 0);
    return priorityDiff !== 0 ? priorityDiff : left.id.localeCompare(right.id);
  });
}

function buildRoutingIndex(manifest) {
  if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) {
    throw new Error('Capability Manifest 沒有可用的 capabilities');
  }
  const limit = capabilityLimit(manifest);
  const lines = [
    '---',
    'type: capability-routing-index',
    'generatedBy: scripts/router/build-routing-index.js',
    `source: ${MANIFEST_RELATIVE}`,
    'alwaysApply: false',
    'readAt: on-demand',
    '---',
    '',
    '# Capability 路由索引',
    '',
    `> 由 \`scripts/router/build-routing-index.js\` 從 \`${MANIFEST_RELATIVE}\` 產生，請勿手改；Manifest 變更後重新執行該腳本。`,
    '> 能執行指令的工具一律用 `node scripts/router/resolve-capabilities.js "<本次需求>"`。本檔只給無法執行指令的工具查表。',
    '',
    '## 選取規則',
    '',
    '1. 比對前把需求轉成小寫、全形轉半形、連續空白併成一個；`CR研究` 與 `CR 研究` 視為相同。',
    '2. 需求含某能力的任一關鍵字或別名即命中。別名的英數開頭或結尾須獨立成詞，前後不能緊接其他英數字。',
    '3. 觸發詞前 12 個字內（中間沒有句號、問號或驚嘆號）出現「不要、不用、別、取消、關閉、不開、不是要、先不要、暫時不要」時，該次出現不算命中；「不」緊接「開」或「建立」開頭的觸發詞也不算。',
    `4. 先選標 ★ 且命中的能力，再選其餘命中的能力；兩組都依優先度由高到低，同優先度時命中觸發詞較多者優先。合計最多 ${limit} 個。`,
    '5. 依選取順序讀「載入檔案」，重複的只讀一次。標（本機）的檔案只存在工作機，讀不到就明說，不猜內容。',
    '6. 沒有命中時只用 Bootstrap 與專案原始碼，不全量掃描母體。',
    '',
    '## 能力表',
    '',
    '依優先度由高到低排列；★ 表示命中即必選。',
    '',
    '| 能力 | 優先度 | 關鍵字 | 別名 | 載入檔案 |',
    '| --- | ---: | --- | --- | --- |'
  ];

  for (const capability of orderedCapabilities(manifest)) {
    assertTableSafe(capability.id, 'capability id');
    for (const trigger of [...(capability.keywords || []), ...(capability.aliases || [])]) {
      assertTableSafe(trigger, `${capability.id} 的觸發詞`);
    }
    for (const file of loadFiles(capability)) assertTableSafe(file, `${capability.id} 的載入檔案`);
    const files = loadFiles(capability).map(file =>
      code(file) + (isLocalOnly(file, manifest) ? '（本機）' : ''));
    lines.push([
      '',
      (capability.requiredWhenMatched === true ? '★ ' : '') + code(capability.id),
      String(capability.priority || 0),
      listCell(capability.keywords || []),
      listCell(capability.aliases || []),
      files.length ? files.join('、') : '—',
      ''
    ].join(' | ').trim());
  }

  return lines.join('\n') + '\n';
}

function readManifest(coreRoot = CORE_ROOT) {
  return JSON.parse(fs.readFileSync(path.join(coreRoot, MANIFEST_RELATIVE), 'utf8'));
}

function checkRoutingIndex(coreRoot = CORE_ROOT) {
  const expected = buildRoutingIndex(readManifest(coreRoot));
  const target = path.join(coreRoot, INDEX_RELATIVE);
  // Windows checkout 可能把換行轉成 CRLF；比對內容時不計換行格式。
  const actual = fs.existsSync(target) ? fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') : null;
  return { upToDate: actual === expected, expected, actual, target };
}

if (require.main === module) {
  const mode = process.argv[2] || '--write';
  if (!['--write', '--check', '--stdout'].includes(mode)) {
    process.stderr.write('用法：node scripts/router/build-routing-index.js [--write|--check|--stdout]\n');
    process.exit(2);
  }
  const result = checkRoutingIndex();
  if (mode === '--stdout') {
    process.stdout.write(result.expected);
  } else if (mode === '--check') {
    if (!result.upToDate) {
      process.stderr.write(`${INDEX_RELATIVE} 與 Manifest 不一致，請執行 node scripts/router/build-routing-index.js\n`);
      process.exit(1);
    }
    process.stdout.write(`${INDEX_RELATIVE} 與 Manifest 一致。\n`);
  } else if (result.upToDate) {
    process.stdout.write(`${INDEX_RELATIVE} 已是最新，未寫入。\n`);
  } else {
    fs.writeFileSync(result.target, result.expected, 'utf8');
    process.stdout.write(`已更新 ${INDEX_RELATIVE}（${Buffer.byteLength(result.expected)} bytes）。\n`);
  }
}

module.exports = {
  INDEX_RELATIVE,
  MANIFEST_RELATIVE,
  buildRoutingIndex,
  capabilityLimit,
  checkRoutingIndex,
  loadFiles,
  orderedCapabilities
};
