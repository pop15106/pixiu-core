'use strict';

const path = require('node:path');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const {
  lstat,
  readFile,
  readdir,
} = require('node:fs/promises');

const { verifyEvaluationTask } = require('./evaluation-task-builder');
const { parseGitHubRepository } = require('./repository-source-gate');

const execFileAsync = promisify(execFile);
const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.next',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
  'vendor',
]);
const DEFAULT_LIMITS = Object.freeze({
  maxFiles: 5000,
  maxFileBytes: 1024 * 1024,
  maxTotalBytes: 50 * 1024 * 1024,
});

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nestedValue of Object.values(value)) deepFreeze(nestedValue);
  return Object.freeze(value);
}

function toRelativePath(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

function isBinary(buffer) {
  const limit = Math.min(buffer.length, 8192);
  for (let index = 0; index < limit; index += 1) {
    if (buffer[index] === 0) return true;
  }
  return false;
}

function createFinding(code, severity, relativePath, line, summary) {
  return Object.freeze({
    code,
    severity,
    path: relativePath,
    line,
    summary,
  });
}

function scanLines(relativePath, text, definitions) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const definition of definitions) {
      definition.pattern.lastIndex = 0;
      if (definition.pattern.test(line)) {
        findings.push(createFinding(
          definition.code,
          definition.severity,
          relativePath,
          index + 1,
          definition.summary,
        ));
      }
    }
  }
  return findings;
}

const SECRET_DEFINITIONS = Object.freeze([
  {
    code: 'SECRET_PRIVATE_KEY',
    severity: 'HIGH',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
    summary: '偵測到私鑰標頭：[REDACTED]',
  },
  {
    code: 'SECRET_GITHUB_TOKEN',
    severity: 'HIGH',
    pattern: /gh[pousr]_[A-Za-z0-9_]{20,}/,
    summary: '偵測到 GitHub Token 格式：[REDACTED]',
  },
  {
    code: 'SECRET_OPENAI_KEY',
    severity: 'HIGH',
    pattern: /sk-[A-Za-z0-9_-]{20,}/,
    summary: '偵測到 API Key 格式：[REDACTED]',
  },
  {
    code: 'SECRET_AWS_ACCESS_KEY',
    severity: 'HIGH',
    pattern: /AKIA[0-9A-Z]{16}/,
    summary: '偵測到 AWS Access Key 格式：[REDACTED]',
  },
  {
    code: 'SECRET_GENERIC_CREDENTIAL',
    severity: 'MEDIUM',
    pattern: /\b(?:password|passwd|token|secret)\s*[:=]\s*['"]?[^\s'"]{8,}/i,
    summary: '偵測到疑似硬編碼憑證：[REDACTED]',
  },
]);

const STATIC_DEFINITIONS = Object.freeze([
  {
    code: 'STATIC_EVAL',
    severity: 'HIGH',
    pattern: /\beval\s*\(/,
    summary: '偵測到動態 eval 呼叫',
  },
  {
    code: 'STATIC_CHILD_PROCESS',
    severity: 'MEDIUM',
    pattern: /(?:node:)?child_process|\b(?:exec|execSync|spawn)\s*\(/,
    summary: '偵測到程序或命令執行能力',
  },
  {
    code: 'STATIC_TLS_VERIFY_DISABLED',
    severity: 'HIGH',
    pattern: /rejectUnauthorized\s*:\s*false|verify\s*=\s*False/i,
    summary: '偵測到 TLS 驗證被關閉',
  },
  {
    code: 'STATIC_PIPE_TO_SHELL',
    severity: 'HIGH',
    pattern: /\b(?:curl|wget)\b[^|\n]*\|\s*(?:ba)?sh\b/i,
    summary: '偵測到下載後直接交給 Shell 執行',
  },
]);

const PROMPT_DEFINITIONS = Object.freeze([
  {
    code: 'PROMPT_INJECTION_IGNORE_RULES',
    severity: 'HIGH',
    pattern: /ignore (?:all |the )?(?:previous|prior) instructions|忽略(?:先前|之前|所有)指令/i,
    summary: '偵測到要求忽略既有規則的文字',
  },
  {
    code: 'PROMPT_INJECTION_READ_SECRETS',
    severity: 'HIGH',
    pattern: /read (?:the )?(?:secret|token|credential|\.env)|讀取.{0,8}(?:秘密|權杖|憑證|\.env)/i,
    summary: '偵測到要求讀取秘密的文字',
  },
  {
    code: 'PROMPT_INJECTION_EXFILTRATE',
    severity: 'HIGH',
    pattern: /(?:send|upload|exfiltrate).{0,40}(?:secret|token|credential|data)|外傳.{0,20}(?:秘密|憑證|資料)/i,
    summary: '偵測到資料外傳指令',
  },
  {
    code: 'PROMPT_INJECTION_BYPASS',
    severity: 'HIGH',
    pattern: /bypass.{0,20}(?:permission|security|approval)|繞過.{0,20}(?:權限|安全|核准)/i,
    summary: '偵測到要求繞過安全或核准的文字',
  },
  {
    code: 'PROMPT_INJECTION_CORE_WRITE',
    severity: 'HIGH',
    pattern: /(?:modify|write|overwrite).{0,30}(?:master|formal core|pixiucore)|修改.{0,20}(?:master|正式核心|PixiuCore)/i,
    summary: '偵測到要求修改正式核心的文字',
  },
]);

async function defaultGitRunner({ args, cwd }) {
  const { stdout } = await execFileAsync('git', args, {
    cwd,
    timeout: 10000,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  return String(stdout).trim();
}

function normalizeOrigin(value) {
  const parsed = parseGitHubRepository(String(value || '').trim().replace(/\.git$/i, ''));
  return parsed?.canonicalUri || null;
}

async function enumerateFiles(root, limits) {
  const files = [];
  const skipped = [];
  let totalBytes = 0;

  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = toRelativePath(root, absolutePath);

      if (entry.isSymbolicLink()) {
        skipped.push({ path: relativePath, reason: 'SYMLINK_SKIPPED' });
        continue;
      }
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRECTORIES.has(entry.name)) {
          skipped.push({ path: relativePath, reason: 'EXCLUDED_DIRECTORY' });
          continue;
        }
        await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;

      if (files.length >= limits.maxFiles) {
        throw createError('WORKSPACE_SCAN_LIMIT_EXCEEDED', '工作區檔案數超過掃描上限');
      }
      const stats = await lstat(absolutePath);
      if (stats.size > limits.maxFileBytes) {
        skipped.push({ path: relativePath, reason: 'FILE_TOO_LARGE' });
        continue;
      }
      if (totalBytes + stats.size > limits.maxTotalBytes) {
        throw createError('WORKSPACE_SCAN_LIMIT_EXCEEDED', '工作區總讀取量超過掃描上限');
      }

      const buffer = await readFile(absolutePath);
      totalBytes += buffer.length;
      if (isBinary(buffer)) {
        skipped.push({ path: relativePath, reason: 'BINARY_FILE' });
        continue;
      }
      files.push({
        absolutePath,
        relativePath,
        text: buffer.toString('utf8'),
      });
    }
  }

  await walk(root);
  return { files, skipped, totalBytes };
}

function scanLicense(task, files) {
  const licenseFiles = files.filter((file) => /^(?:license|copying|notice)(?:\.|$)/i.test(path.basename(file.relativePath)));
  const findings = [];
  if (licenseFiles.length === 0) {
    findings.push(createFinding(
      'LICENSE_FILE_MISSING',
      'MEDIUM',
      '.',
      1,
      `未找到授權檔；候選宣告為 ${task.source.license}`,
    ));
  } else {
    const combined = licenseFiles.map((file) => file.text).join('\n');
    const expected = task.source.license.toLowerCase();
    const matched = expected === 'mit'
      ? /mit license/i.test(combined)
      : combined.toLowerCase().includes(expected);
    if (!matched) {
      findings.push(createFinding(
        'LICENSE_DECLARATION_MISMATCH',
        'HIGH',
        licenseFiles[0].relativePath,
        1,
        `授權檔內容與宣告 ${task.source.license} 不一致`,
      ));
    }
  }
  return { status: findings.length === 0 ? 'PASS' : 'FINDINGS', findings };
}

function scanSupplyChain(files) {
  const findings = [];
  const fileNames = new Set(files.map((file) => path.basename(file.relativePath).toLowerCase()));
  const packageFile = files.find((file) => file.relativePath === 'package.json');
  if (packageFile) {
    try {
      const packageJson = JSON.parse(packageFile.text);
      for (const lifecycleName of ['preinstall', 'install', 'postinstall', 'prepare']) {
        if (typeof packageJson.scripts?.[lifecycleName] === 'string') {
          findings.push(createFinding(
            'SUPPLY_CHAIN_LIFECYCLE_SCRIPT',
            'HIGH',
            'package.json',
            1,
            `偵測到 ${lifecycleName} lifecycle script`,
          ));
        }
      }
      const dependencyCount = Object.keys({
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {}),
        ...(packageJson.optionalDependencies || {}),
      }).length;
      if (dependencyCount > 200) {
        findings.push(createFinding(
          'SUPPLY_CHAIN_EXCESSIVE_DEPENDENCIES',
          'MEDIUM',
          'package.json',
          1,
          `依賴數量偏高：${dependencyCount}`,
        ));
      }
      if (dependencyCount > 0 && !['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock'].some((name) => fileNames.has(name))) {
        findings.push(createFinding(
          'SUPPLY_CHAIN_LOCKFILE_MISSING',
          'MEDIUM',
          'package.json',
          1,
          '有 Node.js 依賴但未找到 lockfile',
        ));
      }
    } catch {
      findings.push(createFinding(
        'SUPPLY_CHAIN_MANIFEST_INVALID',
        'HIGH',
        'package.json',
        1,
        'package.json 不是有效 JSON',
      ));
    }
  }

  for (const file of files) {
    findings.push(...scanLines(file.relativePath, file.text, [STATIC_DEFINITIONS[3]])
      .map((finding) => ({ ...finding, code: 'SUPPLY_CHAIN_PIPE_TO_SHELL' })));
  }
  return { status: findings.length === 0 ? 'PASS' : 'FINDINGS', findings };
}

async function scanCandidateWorkspace({
  task: inputTask,
  workspacePath,
  gitRunner = defaultGitRunner,
  limits = DEFAULT_LIMITS,
  scannedAt,
} = {}) {
  const task = verifyEvaluationTask(inputTask);
  const normalizedWorkspacePath = path.resolve(String(workspacePath || ''));
  if (normalizedWorkspacePath !== path.resolve(task.workspace.worktreePath)) {
    throw createError('WORKSPACE_PATH_MISMATCH', 'workspacePath 與 Task 固定路徑不一致');
  }
  const stats = await lstat(normalizedWorkspacePath).catch(() => null);
  if (!stats?.isDirectory()) {
    throw createError('WORKSPACE_NOT_FOUND', '候選工作區不存在');
  }

  const head = String(await gitRunner({ args: ['rev-parse', 'HEAD'], cwd: normalizedWorkspacePath })).trim().toLowerCase();
  if (head !== task.source.commitSha) {
    throw createError('WORKSPACE_COMMIT_MISMATCH', '工作區 HEAD 與固定 Commit SHA 不一致');
  }
  const originRaw = String(await gitRunner({ args: ['remote', 'get-url', 'origin'], cwd: normalizedWorkspacePath })).trim();
  const origin = normalizeOrigin(originRaw);
  if (origin !== task.source.canonicalUri) {
    throw createError('WORKSPACE_ORIGIN_MISMATCH', '工作區 origin 與 canonical URL 不一致');
  }

  const enumerated = await enumerateFiles(normalizedWorkspacePath, {
    ...DEFAULT_LIMITS,
    ...(limits || {}),
  });
  const secretFindings = [];
  const staticFindings = [];
  const promptFindings = [];
  for (const file of enumerated.files) {
    secretFindings.push(...scanLines(file.relativePath, file.text, SECRET_DEFINITIONS));
    staticFindings.push(...scanLines(file.relativePath, file.text, STATIC_DEFINITIONS));
    if (/\.(?:md|mdx|txt|rst|adoc|json|ya?ml)$/i.test(file.relativePath)) {
      promptFindings.push(...scanLines(file.relativePath, file.text, PROMPT_DEFINITIONS));
    }
  }

  const check = (findings) => ({
    status: findings.length === 0 ? 'PASS' : 'FINDINGS',
    findings,
  });
  const timestamp = scannedAt === undefined ? Date.now() : Date.parse(scannedAt);
  if (!Number.isFinite(timestamp)) {
    throw createError('WORKSPACE_SCAN_TIME_INVALID', 'scannedAt 必須是有效日期');
  }

  return deepFreeze({
    schemaVersion: 'pixiu.core-research/workspace-evidence-v1',
    taskId: task.taskId,
    taskDigest: task.integrity.value,
    scannedAt: new Date(timestamp).toISOString(),
    workspace: {
      path: normalizedWorkspacePath,
      head,
      origin,
    },
    limits: {
      maxFiles: limits.maxFiles ?? DEFAULT_LIMITS.maxFiles,
      maxFileBytes: limits.maxFileBytes ?? DEFAULT_LIMITS.maxFileBytes,
      maxTotalBytes: limits.maxTotalBytes ?? DEFAULT_LIMITS.maxTotalBytes,
    },
    statistics: {
      scannedFiles: enumerated.files.length,
      scannedBytes: enumerated.totalBytes,
      skippedFiles: enumerated.skipped.length,
    },
    skipped: enumerated.skipped,
    checks: {
      license: scanLicense(task, enumerated.files),
      secret: check(secretFindings),
      static: check(staticFindings),
      supplyChain: scanSupplyChain(enumerated.files),
      promptInjection: check(promptFindings),
    },
  });
}

module.exports = {
  DEFAULT_LIMITS,
  scanCandidateWorkspace,
};
