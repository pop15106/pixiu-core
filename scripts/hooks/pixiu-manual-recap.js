#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const capture = require('./pixiu-deterministic-capture');

const MAX_STDIN = 1024 * 1024;

function run(rawInput, options = {}) {
  capture.assertPayloadWithinLimit(rawInput);
  const input = capture.parseJsonOrThrow(rawInput);
  capture.assertManualInput(input);
  return JSON.stringify(writeManualRecap(input, options));
}

function writeManualRecap(input, options = {}) {
  capture.assertManualInput(input);
  const corePath = resolveCorePath(options.corePath);
  const now = options.now || new Date();
  const recapRoot = path.join(corePath, 'vault', 'memory', 'recaps');
  const recapPath = resolveRecapPath(corePath, input.relative_path || input.recap_path || input.path);
  const recapRelativePath = toPosix(path.relative(corePath, recapPath));
  const content = input.content;

  preflightManualRecap({
    corePath,
    recapPath,
    recapRelativePath,
    content,
    now,
    lockOptions: options.lockOptions
  });

  capture.assertPathWithinRoot(recapRoot, corePath, 'recap root');
  capture.assertPathWithinRoot(path.dirname(recapPath), recapRoot, 'recap parent path');
  fs.mkdirSync(path.dirname(recapPath), { recursive: true });
  capture.assertPathWithinRoot(recapPath, recapRoot, 'recap path');
  const recapLockPath = `${recapPath}.lock`;
  capture.assertLexicalPathWithinRoot(recapLockPath, recapRoot, 'manual recap lock path');

  return capture.withFileLock(recapLockPath, () => {
    if (fs.existsSync(recapPath)) {
      if (fs.readFileSync(recapPath, 'utf8') !== content) {
        throw new Error('manual recap path already exists with different content');
      }
    } else {
      capture.atomicWriteTextExclusive(recapPath, content);
    }

    const memorySummaryResult = updateMemorySummary({
      corePath,
      recapRelativePath,
      recapText: content,
      now,
      lockOptions: options.lockOptions
    });
    const captureResult = capture.captureRecap({ recap_path: recapRelativePath }, {
      corePath,
      now,
      failAfterObservationCount: options.failAfterObservationCount,
      lockOptions: options.lockOptions
    });
    return {
      recap_path: recapRelativePath,
      memory_summary: memorySummaryResult,
      capture: captureResult
    };
  }, options.lockOptions);
}

function preflightManualRecap({ corePath, recapPath, recapRelativePath, content, now, lockOptions }) {
  if (!content.trim()) {
    throw new Error('manual recap content is required');
  }
  capture.assertSafeRecapText(content, 'manual recap input rejected');

  const frontmatter = capture.parseFrontmatter(content);
  const title = extractRecapTitle(content);
  const allowedStatuses = new Set(['done', 'follow-up', 'paused', 'verified-local', 'procedure-pending']);
  const valid = [
    path.extname(recapPath).toLowerCase() === '.md',
    /^vault\/memory\/recaps\/.+\.md$/i.test(recapRelativePath),
    frontmatter.type === 'session-recap',
    capture.isValidIsoDate(frontmatter.date),
    /^[A-Za-z0-9_-]{1,64}$/.test(String(frontmatter.project || '')),
    /^[A-Za-z0-9_-]{1,64}$/.test(String(frontmatter.system || '')),
    /^[A-Za-z0-9._-]{1,128}$/.test(String(frontmatter.repo || '')),
    /^[A-Za-z0-9._-]{1,128}$/.test(String(frontmatter.topic || '')),
    allowedStatuses.has(String(frontmatter.status || '')),
    frontmatter.recap_mode === 'manual',
    typeof frontmatter.tags === 'string' && /\brecap\b/i.test(frontmatter.tags),
    typeof frontmatter.summary === 'string' && frontmatter.summary.trim().length > 0 && frontmatter.summary.length <= 240,
    Boolean(title)
  ];
  if (valid.includes(false)) {
    throw new Error('manual recap input rejected');
  }

  try {
    capture.preflightRecapText({
      corePath,
      recapRelativePath,
      recapText: content,
      now,
      errorMessage: 'manual recap input rejected'
    });
  } catch {
    throw new Error('manual recap input rejected');
  }

  const summaryRoot = path.join(corePath, 'vault', 'memory');
  const summaryPath = path.join(summaryRoot, 'memory-summary.md');
  const summaryLockPath = `${summaryPath}.lock`;
  capture.assertPathWithinRoot(summaryRoot, corePath, 'memory summary root');
  capture.assertLexicalPathWithinRoot(summaryPath, summaryRoot, 'memory-summary path');
  capture.assertLexicalPathWithinRoot(summaryLockPath, summaryRoot, 'memory-summary lock path');
  capture.withFileLock(summaryLockPath, () => {
    if (!fs.existsSync(summaryPath)) {
      throw new Error('memory-summary.md not found');
    }
    prepareMemorySummary({
      original: fs.readFileSync(summaryPath, 'utf8'),
      recapRelativePath,
      recapText: content,
      now
    });
  }, lockOptions);
}

function resolveRecapPath(corePath, inputPath) {
  const recapRoot = path.join(corePath, 'vault', 'memory', 'recaps');
  const raw = String(inputPath || '').trim();
  if (!raw) throw new Error('invalid recap path');
  if (path.isAbsolute(raw)) throw new Error('absolute recap path is not allowed');

  const candidate = raw.startsWith('vault/') || raw.startsWith('vault\\')
    ? path.resolve(corePath, raw)
    : path.resolve(recapRoot, raw);

  capture.assertPathWithinRoot(candidate, recapRoot, 'recap path');
  return candidate;
}

function resolveCorePath(explicitCorePath) {
  return explicitCorePath ||
    process.env.PIXIU_CORE ||
    process.env.PIXIU_CORE_PATH ||
    path.join(process.env.USERPROFILE || process.env.HOME || '.', '.pixiu-core');
}

function updateMemorySummary({ corePath, recapRelativePath, recapText, now, lockOptions }) {
  const summaryRoot = path.join(corePath, 'vault', 'memory');
  const summaryPath = path.join(summaryRoot, 'memory-summary.md');
  const lockPath = `${summaryPath}.lock`;

  capture.assertPathWithinRoot(summaryRoot, corePath, 'memory summary root');
  capture.assertLexicalPathWithinRoot(summaryPath, summaryRoot, 'memory-summary path');
  capture.assertLexicalPathWithinRoot(lockPath, summaryRoot, 'memory-summary lock path');

  return capture.withFileLock(lockPath, () => {
    if (!fs.existsSync(summaryPath)) {
      throw new Error('memory-summary.md not found');
    }

    const original = fs.readFileSync(summaryPath, 'utf8');
    const { newline, updated } = prepareMemorySummary({
      original,
      recapRelativePath,
      recapText,
      now
    });
    capture.atomicWriteText(summaryPath, updated.endsWith(newline) ? updated : `${updated}${newline}`);

    return {
      updated: 1,
      path: 'vault/memory/memory-summary.md'
    };
  }, lockOptions);
}

function prepareMemorySummary({ original, recapRelativePath, recapText, now }) {
  const newline = detectNewline(original);
  const frontmatter = capture.parseFrontmatter(recapText);
  const row = buildSummaryRow({ recapRelativePath, recapText, frontmatter });
  const updated = upsertSummaryRow(
    updateLastUpdated(original, formatDate(now), newline),
    row,
    recapRelativePath,
    newline
  );
  return { newline, updated };
}

function buildSummaryRow({ recapRelativePath, recapText, frontmatter }) {
  const date = sanitizeTableCell(frontmatter.date || '');
  const status = statusLabel(frontmatter.status);
  const topic = sanitizeTitle(extractRecapTitle(recapText) || frontmatter.topic || path.basename(recapRelativePath, '.md'));
  const summary = sanitizeSummary(frontmatter.summary || topic);
  const link = `[[${recapRelativePath}\\|recap]]`;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('manual recap date is required for memory-summary update');
  }
  if (!topic) {
    throw new Error('manual recap title is required for memory-summary update');
  }

  return `| ${date} | ${status} | ${topic} | ${summary} | ${link} |`;
}

function extractRecapTitle(recapText) {
  const body = stripFrontmatter(recapText);
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^#\s+Session Recap[：:]\s*(.+?)\s*$/) || line.match(/^#\s+(.+?)\s*$/);
    if (match) return match[1].trim();
  }
  return '';
}

function stripFrontmatter(text) {
  const trimmed = String(text || '').replace(/^\uFEFF/, '');
  if (!trimmed.startsWith('---\n') && !trimmed.startsWith('---\r\n')) return trimmed;

  const lines = trimmed.split(/\r?\n/);
  let index = 1;
  while (index < lines.length && lines[index] !== '---') index += 1;
  return lines.slice(index + 1).join('\n');
}

function statusLabel(value) {
  const raw = String(value || '').trim().toLowerCase();
  const labels = {
    done: '已完成',
    'verified-local': '已驗證',
    paused: '已暫停',
    'procedure-pending': '程序待確認',
    'draft-auto': '草稿',
    'follow-up': '追蹤中'
  };
  return labels[raw] || '追蹤中';
}

function sanitizeTitle(value) {
  return sanitizeTableCell(String(value || '').replace(/^Session Recap[：:]\s*/i, ''), 64);
}

function sanitizeSummary(value) {
  return sanitizeTableCell(value, 160);
}

function sanitizeTableCell(value, maxLength = 120) {
  const normalized = String(value || '')
    .replace(/\[\[|\]\]/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '/')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';
  if (isSensitiveText(normalized)) {
    throw new Error('memory-summary update rejected sensitive recap metadata');
  }
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function isSensitiveText(value) {
  const text = String(value || '');
  return /(token|secret|password|authorization|api[_-]?key)\s*[:=]/i.test(text) ||
    /C:\\Users\\|\/Users\//i.test(text);
}

function detectNewline(content) {
  return String(content || '').includes('\r\n') ? '\r\n' : '\n';
}

function updateLastUpdated(content, today, newline) {
  const lines = String(content || '').split(/\r?\n/);
  if (lines[0] !== '---') {
    throw new Error('memory-summary frontmatter is missing');
  }

  let inFrontmatter = true;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') {
      inFrontmatter = false;
      break;
    }
    if (lines[index].startsWith('lastUpdated: ')) {
      lines[index] = `lastUpdated: ${today}`;
      return lines.join(newline);
    }
  }

  if (!inFrontmatter) {
    throw new Error('memory-summary frontmatter missing lastUpdated');
  }
  throw new Error('memory-summary frontmatter is malformed');
}

function upsertSummaryRow(content, row, recapRelativePath, newline) {
  const lines = String(content || '').split(/\r?\n/);
  const sectionIndex = lines.findIndex(line => line.trim() === '### 進行中的工作');
  if (sectionIndex === -1) {
    throw new Error('memory-summary missing 進行中的工作 section');
  }

  const headerIndex = lines.findIndex((line, index) =>
    index > sectionIndex && line.trim() === '| 日期 | 狀態 | 主題 | 摘要 | 連結 |'
  );
  if (headerIndex === -1 || lines[headerIndex + 1] == null || !lines[headerIndex + 1].trim().startsWith('|---')) {
    throw new Error('memory-summary missing 進行中的工作 table');
  }

  const dataStart = headerIndex + 2;
  let dataEnd = dataStart;
  while (dataEnd < lines.length && lines[dataEnd].trim().startsWith('|')) {
    dataEnd += 1;
  }

  const currentRows = lines.slice(dataStart, dataEnd);
  const matchIndex = currentRows.findIndex(existingRow => extractRecapPathFromRow(existingRow) === recapRelativePath);

  if (matchIndex >= 0) {
    currentRows[matchIndex] = row;
  } else {
    currentRows.unshift(row);
  }

  lines.splice(dataStart, dataEnd - dataStart, ...currentRows);
  return lines.join(newline);
}

function extractRecapPathFromRow(row) {
  const match = String(row || '').match(/\[\[([\s\S]+?)(?:\\\|[^\]]+|\|[^\]]+)?\]\]/);
  return match ? match[1].replace(/\\\|/g, '|').trim() : '';
}

function formatDate(value) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

if (require.main === module) {
  let raw = '';
  let rawBytes = 0;
  let overflow = false;

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    rawBytes += Buffer.byteLength(chunk, 'utf8');
    if (rawBytes > MAX_STDIN) {
      overflow = true;
      return;
    }
    raw += chunk;
  });
  process.stdin.on('end', () => {
    try {
      if (overflow) {
        throw new Error(`stdin payload exceeds ${MAX_STDIN} bytes`);
      }
      process.stdout.write(run(raw));
    } catch (err) {
      process.exitCode = 1;
      process.stderr.write(`[pixiu-manual-recap] ${capture.publicCliErrorMessage(err, 'manual recap failed')}\n`);
    }
  });
}

module.exports = {
  run,
  writeManualRecap,
  assertPathWithinRoot: capture.assertPathWithinRoot
};
