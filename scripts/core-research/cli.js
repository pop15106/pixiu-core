#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { readFile } = require('node:fs/promises');

const {
  importCandidates,
  readRegistry,
  listLatestCandidates,
  selectWeeklyCandidates,
  writeWeeklyReport,
} = require('./index');

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) {
      throw createError('ARGUMENT_INVALID', `不支援的參數：${token}`);
    }
    const key = token.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw createError('ARGUMENT_REQUIRED', `${token} 缺少值`);
    }
    if (Object.hasOwn(options, key)) {
      throw createError('ARGUMENT_INVALID', `${token} 不可重複`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function requireOption(options, key) {
  const value = options[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw createError('ARGUMENT_REQUIRED', `缺少 --${key}`);
  }
  return value;
}

function assertAllowedOptions(options, allowedKeys) {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(options)) {
    if (!allowed.has(key)) {
      throw createError('ARGUMENT_INVALID', `不支援的參數：--${key}`);
    }
  }
}

function parseNumberOption(options, key, fallback) {
  if (!Object.hasOwn(options, key)) return fallback;
  const value = Number(options[key]);
  if (!Number.isFinite(value)) {
    throw createError('ARGUMENT_INVALID', `--${key} 必須是數字`);
  }
  return value;
}

async function readInputJson(inputPath) {
  let text;
  try {
    text = await readFile(inputPath, 'utf8');
  } catch {
    throw createError('INPUT_FILE_READ_FAILED', `無法讀取輸入檔：${inputPath}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw createError('INPUT_JSON_INVALID', '輸入檔不是有效 JSON');
  }
}

async function runImport(options) {
  assertAllowedOptions(options, ['input', 'registry', 'imported-at']);
  const inputPath = path.resolve(requireOption(options, 'input'));
  const registryPath = path.resolve(requireOption(options, 'registry'));
  const input = await readInputJson(inputPath);
  const candidates = Array.isArray(input) ? input : [input];
  const result = await importCandidates({
    registryPath,
    candidates,
    importedAt: options['imported-at'],
  });

  process.stdout.write(
    `完成：匯入 ${result.imported.length} 項，重複 ${result.duplicates.length} 項，Registry：${registryPath}\n`,
  );
}

async function runWeeklySelect(options) {
  assertAllowedOptions(options, [
    'registry',
    'output',
    'now',
    'days',
    'minimum-score',
    'limit',
    'per-category',
  ]);
  const registryPath = path.resolve(requireOption(options, 'registry'));
  const outputDir = path.resolve(requireOption(options, 'output'));
  const events = await readRegistry(registryPath);
  const candidates = listLatestCandidates(events);
  const selection = selectWeeklyCandidates(candidates, {
    now: options.now,
    days: parseNumberOption(options, 'days', 7),
    minimumScore: parseNumberOption(options, 'minimum-score', 70),
    totalLimit: parseNumberOption(options, 'limit', 5),
    perCategoryLimit: parseNumberOption(options, 'per-category', 2),
  });
  const report = await writeWeeklyReport({ outputDir, selection });

  process.stdout.write(
    `完成：考慮 ${selection.statistics.considered} 項，入選 ${selection.statistics.selected} 項，排除 ${selection.statistics.rejected} 項，報告：${report.files.report}\n`,
  );
}

async function run(argv = process.argv.slice(2)) {
  const [command, ...optionArgs] = argv;
  if (!command) {
    throw createError('COMMAND_REQUIRED', '請指定 import 或 weekly-select');
  }
  const options = parseOptions(optionArgs);

  if (command === 'import') {
    await runImport(options);
    return;
  }
  if (command === 'weekly-select') {
    await runWeeklySelect(options);
    return;
  }
  throw createError('COMMAND_UNSUPPORTED', `不支援的命令：${command}`);
}

function formatError(error) {
  const code = error?.code || 'CORE_RESEARCH_FAILED';
  const message = String(error?.message || '執行失敗').replace(/\r?\n/g, ' ').trim();
  return `CORE_RESEARCH_ERROR ${code}: ${message}`;
}

if (require.main === module) {
  run().catch((error) => {
    process.stderr.write(`${formatError(error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  run,
  parseOptions,
  formatError,
};
