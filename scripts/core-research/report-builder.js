'use strict';

const path = require('node:path');
const { mkdir, writeFile } = require('node:fs/promises');

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function escapeMarkdown(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '/')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function buildSelectedPayload(selection) {
  return {
    schemaVersion: 'pixiu.core-research/weekly-selection-v1',
    generatedAt: selection.policy.now,
    policy: selection.policy,
    statistics: selection.statistics,
    items: selection.selected,
  };
}

function buildRejectedPayload(selection) {
  return {
    schemaVersion: 'pixiu.core-research/weekly-rejections-v1',
    generatedAt: selection.policy.now,
    policy: selection.policy,
    statistics: selection.statistics,
    items: selection.rejected,
  };
}

function buildSelectedRows(selection) {
  if (selection.selected.length === 0) {
    return ['| — | — | — | — | — | — | — |'];
  }

  return selection.selected.map(({ candidate, score }) => [
    escapeMarkdown(candidate.title),
    escapeMarkdown(candidate.resourceType),
    escapeMarkdown(candidate.categories.join(', ')),
    score.totalScore,
    escapeMarkdown(score.disposition),
    escapeMarkdown(candidate.license),
    escapeMarkdown(candidate.commitSha || '未固定'),
  ].join(' | ')).map((row) => `| ${row} |`);
}

function buildRejectedRows(selection) {
  if (selection.rejected.length === 0) {
    return ['| — | — | — | — |'];
  }

  return selection.rejected.map(({ candidate, score, reasonCodes }) => [
    escapeMarkdown(candidate.title),
    score.totalScore,
    escapeMarkdown(score.disposition),
    escapeMarkdown(reasonCodes.join(', ')),
  ].join(' | ')).map((row) => `| ${row} |`);
}

function buildMarkdownReport(selection) {
  const lines = [
    '# PixiuCore 核心候選週評估',
    '',
    `- 產生時間：${selection.policy.now}`,
    `- 評估範圍：最近 ${selection.policy.days} 天`,
    `- 最低分數：${selection.policy.minimumScore}`,
    `- 全週上限：${selection.policy.totalLimit}`,
    `- 同分類上限：${selection.policy.perCategoryLimit}`,
    '',
    '## 統計',
    '',
    `- 考慮候選：${selection.statistics.considered}`,
    `- 入選：${selection.statistics.selected}`,
    `- 排除：${selection.statistics.rejected}`,
    '',
    '## 入選候選',
    '',
    '| 名稱 | 類型 | 分類 | 分數 | 建議 | License | Commit SHA |',
    '|---|---|---|---:|---|---|---|',
    ...buildSelectedRows(selection),
    '',
    '## 未入選候選',
    '',
    '| 名稱 | 分數 | 建議 | 原因碼 |',
    '|---|---:|---|---|',
    ...buildRejectedRows(selection),
    '',
    '## 執行邊界',
    '',
    '- 本報告只完成候選篩選，未 Clone、安裝或執行任何外部程式碼。',
    '- `Integrate Proposed` 仍需人工核准，不能直接修改正式核心。',
    '',
  ];
  return lines.join('\n');
}

async function writeWeeklyReport({ outputDir, selection } = {}) {
  if (typeof outputDir !== 'string' || outputDir.trim() === '') {
    throw createError('REPORT_INPUT_INVALID', 'outputDir 不可為空');
  }
  if (
    !selection
    || typeof selection !== 'object'
    || !selection.policy
    || !selection.statistics
    || !Array.isArray(selection.selected)
    || !Array.isArray(selection.rejected)
  ) {
    throw createError('REPORT_INPUT_INVALID', 'selection 格式不合法');
  }

  const resolvedOutputDir = path.resolve(outputDir);
  const files = Object.freeze({
    selected: path.join(resolvedOutputDir, 'selected.json'),
    rejected: path.join(resolvedOutputDir, 'rejected.json'),
    report: path.join(resolvedOutputDir, 'weekly-report.md'),
  });

  await mkdir(resolvedOutputDir, { recursive: true });
  await Promise.all([
    writeFile(files.selected, serializeJson(buildSelectedPayload(selection)), 'utf8'),
    writeFile(files.rejected, serializeJson(buildRejectedPayload(selection)), 'utf8'),
    writeFile(files.report, buildMarkdownReport(selection), 'utf8'),
  ]);

  return Object.freeze({
    outputDir: resolvedOutputDir,
    files,
  });
}

module.exports = {
  escapeMarkdown,
  buildMarkdownReport,
  writeWeeklyReport,
};
