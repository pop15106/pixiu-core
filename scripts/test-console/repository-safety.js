#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TEXT_EXTENSIONS = new Set([
  '.bat', '.cjs', '.cmd', '.css', '.env', '.html', '.ini', '.java', '.js', '.json',
  '.jsx', '.md', '.mjs', '.properties', '.ps1', '.sh', '.toml', '.ts', '.tsx', '.txt',
  '.xml', '.yaml', '.yml'
]);

const CREDENTIAL_PATTERNS = [
  { name: 'OpenAI API key', pattern: /sk-[A-Za-z0-9_-]{20,}/g },
  { name: 'GitHub token', pattern: /gh[pousr]_[A-Za-z0-9]{20,}/g },
  { name: 'Slack token', pattern: /xox[baprs]-[A-Za-z0-9-]{20,}/g },
  { name: 'Google API key', pattern: /AIza[0-9A-Za-z_-]{30,}/g },
  { name: 'Private key header', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g }
];

function findConflictMarkers(text) {
  const matches = [];
  String(text).split(/\r?\n/).forEach((line, index) => {
    if (/^(?:<<<<<<<(?: .*)?|=======|>>>>>>>(?: .*)?)$/.test(line)) {
      matches.push(index + 1);
    }
  });
  return matches;
}

function findCredentialLikeValues(text) {
  const findings = [];
  for (const { name, pattern } of CREDENTIAL_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(String(text))) !== null) {
      findings.push({ name, index: match.index, preview: `${match[0].slice(0, 6)}…` });
    }
  }
  return findings;
}

function runGit(rootDir, args) {
  const result = spawnSync('git', args, {
    cwd: rootDir,
    encoding: 'utf8',
    shell: false,
    windowsHide: true
  });
  return {
    exitCode: Number.isInteger(result.status) ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || result.error?.message || ''
  };
}

function parsePathLines(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function collectChangedFiles(rootDir) {
  const commands = [
    ['diff', '--name-only', '--diff-filter=ACMRTUXB'],
    ['diff', '--cached', '--name-only', '--diff-filter=ACMRTUXB'],
    ['ls-files', '--others', '--exclude-standard']
  ];
  const files = new Set();
  for (const args of commands) {
    const result = runGit(rootDir, args);
    if (result.exitCode !== 0) {
      throw new Error(`git ${args.join(' ')} 失敗：${result.stderr.trim()}`);
    }
    for (const relativePath of parsePathLines(result.stdout)) {
      files.add(relativePath);
    }
  }
  return [...files].sort((left, right) => left.localeCompare(right, 'en'));
}

function listTrackedTextFiles(rootDir) {
  const result = runGit(rootDir, ['ls-files']);
  if (result.exitCode !== 0) {
    throw new Error(`git ls-files 失敗：${result.stderr.trim()}`);
  }
  return parsePathLines(result.stdout).filter((relativePath) => {
    const fullPath = path.join(rootDir, relativePath);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      return false;
    }
    if (fs.statSync(fullPath).size > 2 * 1024 * 1024) {
      return false;
    }
    return TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
  });
}

function scanRepository(rootDir) {
  const diffCheck = runGit(rootDir, ['diff', '--check']);
  const issues = [];
  if (diffCheck.exitCode !== 0) {
    issues.push({ type: 'diff-check', detail: `${diffCheck.stdout}${diffCheck.stderr}`.trim() });
  }

  for (const relativePath of listTrackedTextFiles(rootDir)) {
    const fullPath = path.join(rootDir, relativePath);
    const text = fs.readFileSync(fullPath, 'utf8');
    for (const line of findConflictMarkers(text)) {
      issues.push({ type: 'conflict-marker', path: relativePath, line });
    }
  }

  for (const relativePath of collectChangedFiles(rootDir)) {
    const fullPath = path.join(rootDir, relativePath);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
      continue;
    }
    const extension = path.extname(relativePath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(extension) || fs.statSync(fullPath).size > 2 * 1024 * 1024) {
      continue;
    }
    const text = fs.readFileSync(fullPath, 'utf8');
    for (const finding of findCredentialLikeValues(text)) {
      issues.push({
        type: 'credential-pattern',
        path: relativePath,
        name: finding.name,
        preview: finding.preview
      });
    }
  }

  return {
    changedFiles: collectChangedFiles(rootDir),
    issues
  };
}

function main() {
  const rootDir = path.resolve(__dirname, '..', '..');
  const result = scanRepository(rootDir);
  if (result.issues.length > 0) {
    process.stderr.write('Repository Safety 發現問題：\n');
    for (const issue of result.issues) {
      const location = issue.path ? ` ${issue.path}${issue.line ? `:${issue.line}` : ''}` : '';
      process.stderr.write(`- ${issue.type}${location}${issue.name ? ` ${issue.name}` : ''}${issue.detail ? ` ${issue.detail}` : ''}\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`Repository Safety 通過；已檢查 ${result.changedFiles.length} 個變更檔案的憑證樣式。\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  collectChangedFiles,
  findConflictMarkers,
  findCredentialLikeValues,
  scanRepository
};
