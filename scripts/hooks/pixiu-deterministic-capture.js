#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const MAX_RECAP_FILENAME_LENGTH = 180;
const UNSAFE_RECAP_PATTERNS = [
  /(?:\b(?:token|password|secret|authorization|api[_-]?key|aws_secret_access_key)\b|(?:密碼|密码|密鑰|密钥|權杖|权杖|令牌|憑證|凭证))[^\p{L}\p{N}\r\n]*[\p{L}\p{N}][\p{L}\p{N}._~+/=-]{3,}/iu,
  /\bbearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /\b(?:sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})\b/i,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  /-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----/i,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /(?:\b[A-Za-z]:[\\/][^\s"'`<>|]*|\\\\[^\\\s]+\\[^\\\s]+)/m,
  /(?:^|[^:])\/\/[^/\s]+\/[^\s"'`<>|]+/m,
  /(?:^|[^A-Za-z0-9:/])\/(?!\/|recap(?:\b|$)|go(?:\b|$)|simplify(?:\b|$))[\p{L}\p{N}._-]+(?:\/[\p{L}\p{N}._-]+)*/imu,
  /~\/[^\s"'`]*/m,
  /\bfull\s+(?:conversation\s+)?transcript\b/i,
  /\braw\s+(?:tool\s+)?payload\b/i,
  /(?:transcript\s*原文|完整\s*(?:對話|會話)?\s*transcript|原始\s*(?:工具)?\s*payload)/i,
  /\b(?:ignore|disregard|forget|override|bypass)[\s\p{P}\p{S}]+(?:(?:all|any)[\s\p{P}\p{S}]+)?(?:previous|prior|earlier)[\s\p{P}\p{S}]+(?:instructions?|prompts?|directives?|rules?)\b/iu,
  /(?:忽略|無視|跳過|忘記|忘记|覆寫|覆蓋|覆盖)[\s\p{P}\p{S}]*(?:所有|全部)?[\s\p{P}\p{S}]*(?:先前|之前|前面|原本)[\s\p{P}\p{S}]*(?:的[\s\p{P}\p{S}]*)?(?:(?:所有|全部)[\s\p{P}\p{S}]*)?(?:指令|指示|規則|规则|提示)/iu
];
const PATTERN_RULES = [
  {
    topic: 'governance-priority',
    title: 'Governance Priority',
    confidence: 0.47,
    match: /(governance|治理).*(優先序|優先權)|(優先序|優先權).*(governance|治理)/i,
    recommendation: '當入口檔互相矛盾時，先依 governance 優先序處理，再把衝突保留在 observation 候選。 Promotion destination: keep as candidate until independently verified.'
  },
  {
    topic: 'relative-source-paths-only',
    title: 'Relative Source Paths Only',
    confidence: 0.43,
    match: /(repo|vault).*(相對路徑|relative path)|(相對路徑|relative path).*(repo|vault)/i,
    recommendation: 'Observation 只保留 repo 或 vault 內可回讀的相對 source_paths，避免機器專屬路徑進入候選記憶。 Promotion destination: keep as candidate until independently verified.'
  },
  {
    topic: 'effective-config-readback',
    title: 'Effective Config Readback',
    confidence: 0.49,
    match: /(回讀|read-?back).*(生效設定|effective config)|(生效設定|effective config).*(回讀|read-?back)/i,
    recommendation: '遇到 hook 或設定行為異常時，先回讀實際生效設定，再判斷 repo 本體是否需要修改。 Promotion destination: keep as candidate until independently verified.'
  }
];

function run(rawInput, options = {}) {
  assertPayloadWithinLimit(rawInput);
  const input = parseJsonOrThrow(rawInput);
  assertCaptureInput(input);
  return JSON.stringify(captureRecap(input, options));
}

function captureRecap(input, options = {}) {
  assertCaptureInput(input);
  const corePath = resolveCorePath(options.corePath);
  const now = options.now || new Date();
  const recapRoot = path.join(corePath, 'vault', 'memory', 'recaps');
  const recapPath = resolveRecapPath(corePath, input.recap_path || input.relative_path || input.path);
  const recapRelativePath = toPosix(path.relative(corePath, recapPath));
  const observationsRoot = path.join(corePath, 'vault', 'memory', 'agent-learning', 'observations');
  const ledgerRoot = path.join(corePath, 'vault', 'memory', 'agent-learning', 'consolidation-runs');

  assertPathWithinRoot(recapRoot, corePath, 'recap root');
  assertPathWithinRoot(recapPath, recapRoot, 'recap path');
  const recapText = fs.readFileSync(recapPath, 'utf8');
  const { candidates, recapHash } = preflightRecapText({
    corePath,
    recapRelativePath,
    recapText,
    now,
    errorMessage: 'capture input rejected'
  });

  ensureDirectoryWithinRoot(observationsRoot, corePath, 'observation root');
  ensureDirectoryWithinRoot(ledgerRoot, corePath, 'ledger root');
  const ledgerPath = path.join(
    ledgerRoot,
    `recap-${sha256(recapRelativePath).slice(0, 16)}-${recapHash.slice(0, 12)}.json`
  );

  assertPathWithinRoot(ledgerPath, ledgerRoot, 'ledger path');

  const captureLockPath = path.join(ledgerRoot, '.pixiu-deterministic-capture.lock');
  assertLexicalPathWithinRoot(captureLockPath, ledgerRoot, 'capture lock path');

  return withFileLock(captureLockPath, () => {
    const existingLedger = readLedger(ledgerPath);
    const existingEntries = existingLedger
      ? validateLedger({
        corePath,
        observationsRoot,
        ledger: existingLedger,
        candidates,
        recapRelativePath,
        recapHash
      })
      : null;
    if (existingLedger && existingLedger.status === 'complete') {
      return {
        invoked: 1,
        created: [],
        existing: existingEntries.map(entry => entry.relative_path),
        recap_path: recapRelativePath
      };
    }

    const entries = existingEntries || buildNewEntries({
      corePath,
      observationsRoot,
      candidates
    });

    if (!existingLedger) {
      writeLedgerAtomic(ledgerPath, {
        status: 'pending',
        recap_path: recapRelativePath,
        recap_hash: recapHash,
        observations: entries.map(entry => ({
          relative_path: entry.relative_path,
          topic: entry.topic,
          content_hash: entry.content_hash
        }))
      });
    }

    let observationWrites = 0;
    for (const entry of entries) {
      const observationPath = path.join(corePath, entry.relative_path.replace(/\//g, path.sep));
      assertPathWithinRoot(observationPath, observationsRoot, 'observation path');

      if (fs.existsSync(observationPath)) {
        const existingContent = fs.readFileSync(observationPath, 'utf8');
        if (sha256(existingContent) !== entry.content_hash) {
          throw new Error(`pending observation content mismatch: ${entry.relative_path}`);
        }
      } else {
        atomicWriteText(observationPath, entry.content);
      }

      observationWrites += 1;
      if (options.failAfterObservationCount && observationWrites >= options.failAfterObservationCount) {
        throw new Error('simulated observation write failure');
      }
    }

    writeLedgerAtomic(ledgerPath, {
      status: 'complete',
      recap_path: recapRelativePath,
      recap_hash: recapHash,
      observations: entries.map(entry => ({
        relative_path: entry.relative_path,
        topic: entry.topic,
        content_hash: entry.content_hash
      }))
    });

    return {
      invoked: 1,
      created: entries.map(entry => entry.relative_path),
      existing: [],
      recap_path: recapRelativePath
    };
  }, options.lockOptions);
}

function preflightRecapText({ corePath, recapRelativePath, recapText, now, errorMessage = 'capture input rejected' }) {
  assertSafeRecapText(recapText, errorMessage);
  const frontmatter = assertFormalManualRecapSchema(recapText, errorMessage);
  assertCanonicalRecapPath(recapRelativePath, frontmatter, errorMessage);
  const safeSourcePaths = collectSafeSourcePaths({
    corePath,
    recapRelativePath,
    sourcePaths: frontmatter.source_paths
  });
  const sections = parseSections(stripFrontmatter(recapText));
  const candidates = extractCandidates({
    frontmatter,
    sections,
    recapRelativePath,
    safeSourcePaths,
    now
  }).slice(0, 3);

  for (const candidate of candidates) {
    assertObservationCandidate(candidate);
  }

  return {
    frontmatter,
    candidates,
    recapHash: sha256(recapText)
  };
}

function buildNewEntries({ corePath, observationsRoot, candidates }) {
  const reserved = new Set();
  return candidates.map(candidate => {
    assertObservationCandidate(candidate);
    const content = renderObservation(candidate);
    const absolutePath = reserveObservationPath({
      observationsRoot,
      date: candidate.date,
      project: candidate.project,
      topic: candidate.topic,
      reserved
    });
    const relativePath = toPosix(path.relative(corePath, absolutePath));
    reserved.add(absolutePath);
    return {
      topic: candidate.topic,
      relative_path: relativePath,
      content,
      content_hash: sha256(content)
    };
  });
}

function validateLedger({
  corePath,
  observationsRoot,
  ledger,
  candidates,
  recapRelativePath,
  recapHash
}) {
  const requiredKeys = ['observations', 'recap_hash', 'recap_path', 'status'];
  if (!isPlainObject(ledger) ||
      JSON.stringify(Object.keys(ledger).sort()) !== JSON.stringify(requiredKeys)) {
    throw new Error('ledger schema mismatch');
  }
  if (ledger.status !== 'pending' && ledger.status !== 'complete') {
    throw new Error('ledger status is invalid');
  }
  if (typeof ledger.recap_path !== 'string' || ledger.recap_path !== recapRelativePath) {
    throw new Error('ledger recap path mismatch');
  }
  if (typeof ledger.recap_hash !== 'string' || !/^[a-f0-9]{64}$/.test(ledger.recap_hash) ||
      ledger.recap_hash !== recapHash) {
    throw new Error('ledger recap hash mismatch');
  }

  const entries = hydrateEntriesFromLedger({
    corePath,
    observationsRoot,
    ledger,
    candidates
  });
  for (const entry of entries) {
    const observationPath = path.join(corePath, entry.relative_path.replace(/\//g, path.sep));
    const exists = fs.existsSync(observationPath);
    if (ledger.status === 'complete' && !exists) {
      throw new Error(`complete ledger observation missing: ${entry.relative_path}`);
    }
    if (exists && sha256(fs.readFileSync(observationPath, 'utf8')) !== entry.content_hash) {
      throw new Error(`ledger observation content mismatch: ${entry.relative_path}`);
    }
  }
  return entries;
}

function hydrateEntriesFromLedger({ corePath, observationsRoot, ledger, candidates }) {
  if (!ledger || !Array.isArray(ledger.observations)) {
    throw new Error('pending ledger is malformed');
  }
  if (ledger.observations.length !== candidates.length) {
    throw new Error('pending ledger candidate count mismatch');
  }

  const seenPaths = new Set();
  return ledger.observations.map((reservedEntry, index) => {
    const candidate = candidates[index];
    assertObservationCandidate(candidate);
    const content = renderObservation(candidate);
    const contentHash = sha256(content);
    const requiredEntryKeys = ['content_hash', 'relative_path', 'topic'];

    if (!isPlainObject(reservedEntry) ||
        JSON.stringify(Object.keys(reservedEntry).sort()) !== JSON.stringify(requiredEntryKeys)) {
      throw new Error('ledger observation schema mismatch');
    }
    if (reservedEntry.topic !== candidate.topic) {
      throw new Error(`pending ledger topic mismatch: ${reservedEntry.relative_path}`);
    }
    if (typeof reservedEntry.content_hash !== 'string' || !/^[a-f0-9]{64}$/.test(reservedEntry.content_hash) ||
        reservedEntry.content_hash !== contentHash) {
      throw new Error(`pending ledger content mismatch: ${reservedEntry.relative_path}`);
    }
    if (typeof reservedEntry.relative_path !== 'string' || !reservedEntry.relative_path ||
        reservedEntry.relative_path.includes('\\') || seenPaths.has(reservedEntry.relative_path)) {
      throw new Error('ledger observation path is invalid');
    }

    const absolutePath = path.resolve(corePath, reservedEntry.relative_path);
    assertPathWithinRoot(absolutePath, observationsRoot, 'observation path');
    if (toPosix(path.relative(corePath, absolutePath)) !== reservedEntry.relative_path) {
      throw new Error('ledger observation path is not canonical');
    }
    seenPaths.add(reservedEntry.relative_path);
    return {
      topic: reservedEntry.topic,
      relative_path: reservedEntry.relative_path,
      content,
      content_hash: contentHash
    };
  });
}

function reserveObservationPath({ observationsRoot, date, project, topic, reserved }) {
  const stem = `${date}-${project.toLowerCase()}-${topic}`;
  for (let counter = 0; counter < 100; counter += 1) {
    const suffix = counter === 0 ? '' : `-${counter + 1}`;
    const candidate = path.join(observationsRoot, `${stem}${suffix}.md`);
    if (reserved.has(candidate)) {
      continue;
    }
    if (!fs.existsSync(candidate)) return candidate;
  }
  return path.join(observationsRoot, `${stem}-${Date.now()}.md`);
}

function readLedger(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return null;
  const ledger = parseJsonOrThrow(fs.readFileSync(ledgerPath, 'utf8'));
  if (!ledger || typeof ledger !== 'object') {
    throw new Error('ledger is malformed');
  }
  return ledger;
}

function writeLedgerAtomic(ledgerPath, payload) {
  atomicWriteText(ledgerPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function withFileLock(lockPath, callback, options = {}) {
  if (typeof callback !== 'function') {
    throw new Error('lock callback is required');
  }

  const waitMs = normalizePositiveInteger(options.waitMs, 5000);
  const retryMs = normalizePositiveInteger(options.retryMs, 10);
  const staleMs = normalizePositiveInteger(options.staleMs, 30 * 1000);
  const token = `${process.pid}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  const candidatePath = `${lockPath}.${token}.candidate`;
  const deadline = Date.now() + waitMs;
  const settleUntil = Date.now() + Math.min(waitMs, Math.max(2, retryMs * 2));

  try {
    fs.writeFileSync(candidatePath, `${JSON.stringify({
      token,
      pid: process.pid,
      created_at: new Date().toISOString()
    })}\n`, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    removeFileIfPresent(candidatePath);
    throw error;
  }

  try {
    while (true) {
      removeStaleLockCandidates(lockPath, staleMs);
      const candidates = readLockCandidates(lockPath);
      const isFirst = candidates.length > 0 && candidates[0].token === token;
      if (isFirst && Date.now() >= settleUntil) break;
      if (Date.now() >= deadline) {
        throw new Error('lock wait timed out');
      }
      sleepSync(Math.min(retryMs, Math.max(1, deadline - Date.now())));
    }
    return callback();
  } finally {
    removeFileIfPresent(candidatePath);
  }
}

function readLockCandidates(lockPath) {
  const directory = path.dirname(lockPath);
  const prefix = `${path.basename(lockPath)}.`;
  return fs.readdirSync(directory)
    .filter(name => name.startsWith(prefix) && name.endsWith('.candidate'))
    .map(name => {
      const candidatePath = path.join(directory, name);
      try {
        const stat = fs.statSync(candidatePath);
        const payload = parseJsonOrThrow(fs.readFileSync(candidatePath, 'utf8'));
        return {
          path: candidatePath,
          token: typeof payload.token === 'string' ? payload.token : name,
          createdAt: Number.isFinite(stat.mtimeMs) ? stat.mtimeMs : stat.ctimeMs
        };
      } catch (error) {
        if (error && error.code === 'ENOENT') return null;
        return { path: candidatePath, token: name, createdAt: Number.MIN_SAFE_INTEGER };
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.createdAt - right.createdAt || left.token.localeCompare(right.token));
}

function removeStaleLockCandidates(lockPath, staleMs) {
  const directory = path.dirname(lockPath);
  const prefix = `${path.basename(lockPath)}.`;
  for (const name of fs.readdirSync(directory)) {
    if (!name.startsWith(prefix) || !name.endsWith('.candidate')) continue;
    const candidatePath = path.join(directory, name);
    try {
      const stat = fs.statSync(candidatePath);
      if ((Date.now() - stat.mtimeMs) <= staleMs) continue;
      let payload = {};
      try {
        payload = parseJsonOrThrow(fs.readFileSync(candidatePath, 'utf8'));
      } catch {
        payload = {};
      }
      if (isProcessAlive(payload.pid)) continue;
      fs.unlinkSync(candidatePath);
    } catch (error) {
      if (error && (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EPERM')) continue;
      throw error;
    }
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Boolean(error && error.code === 'EPERM');
  }
}

function removeFileIfPresent(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function atomicWriteText(targetPath, content) {
  const directory = path.dirname(targetPath);
  const tempPath = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`
  );
  try {
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, targetPath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

function atomicWriteTextExclusive(targetPath, content, io = fs) {
  const directory = path.dirname(targetPath);
  const tempPath = path.join(
    directory,
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`
  );
  let published = false;
  let operationFailed = false;
  try {
    io.writeFileSync(tempPath, content, { encoding: 'utf8', flag: 'wx' });
    io.linkSync(tempPath, targetPath);
    published = true;
  } catch (error) {
    operationFailed = true;
    throw error;
  } finally {
    try {
      io.unlinkSync(tempPath);
    } catch (error) {
      const cleanupFailed = !error || error.code !== 'ENOENT';
      if (cleanupFailed && !published && !operationFailed) throw error;
    }
  }
}

function ensureDirectoryWithinRoot(directoryPath, rootPath, label) {
  assertPathWithinRoot(directoryPath, rootPath, label);
  fs.mkdirSync(directoryPath, { recursive: true });
  assertPathWithinRoot(directoryPath, rootPath, label);
}

function assertLexicalPathWithinRoot(candidatePath, rootPath, label) {
  if (!isInside(candidatePath, rootPath)) {
    throw new Error(`${label} is outside allowed root`);
  }
}

function assertPathWithinRoot(candidatePath, rootPath, label, io = fs) {
  const resolvedCandidate = path.resolve(String(candidatePath || ''));
  const resolvedRoot = path.resolve(String(rootPath || ''));

  if (!isInside(resolvedCandidate, resolvedRoot)) {
    throw new Error(`${label} is outside allowed root`);
  }

  const realRoot = resolveExistingRealPath(resolvedRoot, io);
  for (const existingPath of listExistingAncestors(resolvedCandidate, resolvedRoot, io)) {
    let stat;
    let realPath;
    try {
      stat = io.lstatSync(existingPath);
      realPath = resolveRealPath(existingPath, io);
    } catch (error) {
      if (error && error.code === 'ENOENT') continue;
      throw error;
    }
    if (!isInside(realPath, realRoot)) {
      throw new Error(`${label} uses symlink escape`);
    }
    if (stat.isSymbolicLink() && !isInside(realPath, realRoot)) {
      throw new Error(`${label} uses symlink escape`);
    }
  }
}

function listExistingAncestors(candidatePath, rootPath, io) {
  const ancestors = [];
  let current = path.resolve(candidatePath);
  const resolvedRoot = path.resolve(rootPath);
  while (true) {
    if (io.existsSync(current)) {
      ancestors.unshift(current);
    }
    if (current === resolvedRoot) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return ancestors;
}

function resolveExistingRealPath(targetPath, io) {
  let current = path.resolve(targetPath);
  while (!io.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return resolveRealPath(current, io);
}

function resolveRealPath(targetPath, io) {
  if (io.realpathSync && typeof io.realpathSync.native === 'function') {
    return path.resolve(io.realpathSync.native(targetPath));
  }
  if (typeof io.realpathSync === 'function') {
    return path.resolve(io.realpathSync(targetPath));
  }
  return path.resolve(targetPath);
}

function isInside(candidatePath, rootPath) {
  const resolvedCandidate = path.resolve(candidatePath);
  const resolvedRoot = path.resolve(rootPath);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
}

function extractCandidates({ frontmatter, sections, recapRelativePath, safeSourcePaths, now }) {
  const lines = collectBodyLines(sections);
  const contextLine = firstMeaningfulLine(sections['觸發與背景']) || frontmatter.summary || 'Manual recap capture.';
  const actionLine = firstMeaningfulLine(sections['已做變更']) || firstMeaningfulLine(sections['證據與流程']) || 'The recap recorded a reusable handling step.';
  const resultLine = firstMeaningfulLine(sections['驗證']) || firstMeaningfulLine(sections['結論']) || 'The recap recorded a bounded outcome.';
  const date = normalizeDate(frontmatter.date, now);
  const project = normalizeProject(frontmatter.project);
  const system = normalizeSystem(frontmatter.system, project);
  const repo = sanitizeScalar(frontmatter.repo || 'unknown');
  const summary = sanitizeScalar(frontmatter.summary || firstMeaningfulLine(sections['結論']) || 'Deterministic capture candidate.');
  const sourceSession = `manual-recap:${recapRelativePath}`;
  const bodyText = lines.join('\n');
  const candidates = [];

  for (const rule of PATTERN_RULES) {
    const matchedLine = lines.find(line => rule.match.test(line));
    if (!matchedLine) continue;
    if (isSensitiveText(matchedLine) || isSensitiveText(actionLine) || isSensitiveText(resultLine) || isSensitiveText(contextLine)) {
      continue;
    }
    if (!safeSourcePaths.length) continue;

    const sanitizedMatch = sanitizeLine(matchedLine);
    const sanitizedAction = sanitizeLine(actionLine);
    const sanitizedResult = sanitizeLine(resultLine);
    const sanitizedContext = sanitizeLine(contextLine);
    if (!sanitizedMatch || !sanitizedAction || !sanitizedResult || !sanitizedContext) continue;

    candidates.push({
      date,
      project,
      system,
      repo,
      topic: rule.topic,
      status: 'candidate',
      scope: 'project',
      sourceSession,
      summary,
      sourcePaths: safeSourcePaths,
      confidence: rule.confidence,
      verified: false,
      title: rule.title,
      context: `${sanitizedContext} Source recap: ${recapRelativePath}.`,
      action: sanitizedAction,
      result: sanitizedResult,
      why: `Tentative inference from recap wording: ${sanitizedMatch}`,
      recommendation: rule.recommendation,
      evidence: [
        `Recap: ${recapRelativePath}`,
        `Matched line: ${sanitizedMatch}`,
        ...safeSourcePaths
          .filter(sourcePath => sourcePath !== recapRelativePath)
          .map(sourcePath => `Source path: ${sourcePath}`)
      ]
    });
  }

  return dedupeCandidates(candidates, bodyText);
}

function dedupeCandidates(candidates, bodyText) {
  const seen = new Set();
  const output = [];
  for (const candidate of candidates) {
    const key = `${candidate.project}:${candidate.topic}`;
    if (seen.has(key)) continue;
    if (isSensitiveText(bodyText) && candidate.topic !== 'relative-source-paths-only') continue;
    seen.add(key);
    output.push(candidate);
  }
  return output;
}

function assertObservationCandidate(candidate) {
  const allowedTopics = new Set(PATTERN_RULES.map(rule => rule.topic));
  const scalarChecks = [
    /^\d{4}-\d{2}-\d{2}$/.test(candidate.date),
    /^[A-Z0-9_-]{1,64}$/.test(candidate.project),
    /^[A-Z0-9_-]{1,64}$/.test(candidate.system),
    /^[A-Za-z0-9._-]{1,128}$/.test(candidate.repo),
    allowedTopics.has(candidate.topic),
    candidate.status === 'candidate',
    candidate.scope === 'project',
    /^manual-recap:vault\/memory\/recaps\/.+\.md$/.test(candidate.sourceSession),
    typeof candidate.summary === 'string' && candidate.summary.length > 0 && candidate.summary.length <= 240,
    Number.isFinite(candidate.confidence) && candidate.confidence >= 0 && candidate.confidence < 0.6,
    candidate.verified === false
  ];
  if (scalarChecks.includes(false)) {
    throw new Error('observation metadata rejected');
  }

  if (!Array.isArray(candidate.sourcePaths) || candidate.sourcePaths.length === 0 || candidate.sourcePaths.length > 20) {
    throw new Error('observation metadata rejected');
  }
  for (const sourcePath of candidate.sourcePaths) {
    const segments = String(sourcePath || '').split('/');
    if (typeof sourcePath !== 'string' || !sourcePath || sourcePath.length > 240 ||
        path.isAbsolute(sourcePath) || segments.includes('..') || isSensitiveSourcePath(sourcePath)) {
      throw new Error('observation metadata rejected');
    }
  }

  const metadataText = [
    candidate.date,
    candidate.project,
    candidate.system,
    candidate.repo,
    candidate.topic,
    candidate.status,
    candidate.scope,
    candidate.summary
  ].join('\n');
  if (isSensitiveText(metadataText)) {
    throw new Error('observation metadata rejected');
  }
}

function renderObservation(candidate) {
  const sourcePathsBlock = candidate.sourcePaths.map(sourcePath => `  - ${sourcePath}`).join('\n');
  const evidenceBlock = candidate.evidence.map(item => `- ${item}`).join('\n');
  return `---\n` +
    `type: agent-observation\n` +
    `date: ${candidate.date}\n` +
    `project: ${candidate.project}\n` +
    `system: ${candidate.system}\n` +
    `repo: ${candidate.repo}\n` +
    `topic: ${candidate.topic}\n` +
    `status: ${candidate.status}\n` +
    `scope: ${candidate.scope}\n` +
    `source_session: ${quoteYaml(candidate.sourceSession)}\n` +
    `summary: ${quoteYaml(candidate.summary)}\n` +
    `tags: [agent-learning, observation]\n` +
    `source_paths:\n${sourcePathsBlock}\n` +
    `related_notes:\n  - vault/context/agent-metacognition-memory-system-plan.md\n` +
    `confidence: ${candidate.confidence.toFixed(2)}\n` +
    `verified: ${candidate.verified ? 'true' : 'false'}\n` +
    `---\n\n` +
    `# Observation - ${candidate.title}\n\n` +
    `## Context\n\n${candidate.context}\n\n` +
    `## Action\n\n${candidate.action}\n\n` +
    `## Result\n\n${candidate.result}\n\n` +
    `## Why It Happened\n\n${candidate.why}\n\n` +
    `## Recommendation\n\n${candidate.recommendation}\n\n` +
    `## Evidence\n\n${evidenceBlock}\n\n` +
    `## Verification\n\n` +
    `- verifier: manual checklist pending\n` +
    `- result: needs-review\n` +
    `- notes: Deterministic Phase 2 candidate generated from explicit recap trigger.\n`;
}

function collectSafeSourcePaths({ corePath, recapRelativePath, sourcePaths, errorMessage = 'capture input rejected' }) {
  const output = [recapRelativePath];
  if (sourcePaths !== undefined && (!Array.isArray(sourcePaths) || sourcePaths.length === 0)) {
    throw new Error(errorMessage);
  }
  for (const value of sourcePaths || []) {
    if (typeof value !== 'string') throw new Error(errorMessage);
    const normalized = normalizeReadablePath(corePath, value);
    if (!normalized) throw new Error(errorMessage);
    if (!output.includes(normalized)) output.push(normalized);
  }
  return output;
}

function normalizeReadablePath(corePath, value) {
  const raw = String(value || '').trim();
  const segments = raw.split(/[\\/]/);
  if (!raw || raw.includes('%') || isSensitiveSourcePath(raw)) return '';
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(raw) || path.isAbsolute(raw) || segments.includes('..')) return '';
  if (/^transcript$/i.test(raw)) return '';

  const resolved = path.resolve(corePath, raw);
  if (!fs.existsSync(resolved)) return '';
  assertPathWithinRoot(resolved, corePath, 'source path');
  try {
    fs.accessSync(resolved, fs.constants.R_OK);
  } catch {
    return '';
  }

  const relative = toPosix(path.relative(corePath, resolved));
  if (!relative || relative.startsWith('..')) return '';
  return relative;
}

function assertCanonicalRecapPath(recapRelativePath, frontmatter, errorMessage = 'capture input rejected') {
  const prefix = 'vault/memory/recaps/';
  const normalized = toPosix(recapRelativePath);
  if (!normalized.startsWith(prefix)) throw new Error(errorMessage);
  const parts = normalized.slice(prefix.length).split('/');
  if (parts.length !== 3) throw new Error(errorMessage);

  const [projectFolder, monthFolder, fileName] = parts;
  const date = String(frontmatter.date || '');
  const project = String(frontmatter.project || '');
  const allowedProjectFolders = project === 'PIXIUCORE' ? new Set(['PIXIUCORE', '母體']) : new Set([project]);
  if (!allowedProjectFolders.has(projectFolder) || monthFolder !== date.slice(0, 7)) {
    throw new Error(errorMessage);
  }
  if (!fileName.startsWith(`${date}-${projectFolder}-`) ||
      !fileName.endsWith('.md') ||
      fileName.length <= `${date}-${projectFolder}-.md`.length ||
      fileName.length > MAX_RECAP_FILENAME_LENGTH) {
    throw new Error(errorMessage);
  }
}

function isValidIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

function assertFormalManualRecapSchema(text, errorMessage = 'capture input rejected') {
  const trimmed = String(text || '').replace(/^\uFEFF/, '');
  if (!trimmed.startsWith('---\n') && !trimmed.startsWith('---\r\n')) {
    throw new Error(errorMessage);
  }

  const lines = trimmed.split(/\r?\n/);
  const closingIndex = lines.indexOf('---', 1);
  if (closingIndex < 0) throw new Error(errorMessage);

  const allowedKeys = new Set([
    'type', 'date', 'project', 'system', 'repo', 'topic', 'status',
    'recap_mode', 'tags', 'source_paths', 'summary'
  ]);
  const seenKeys = new Set();
  let currentListKey = '';

  for (let index = 1; index < closingIndex; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;

    const listItem = line.match(/^\s{2,}-\s+(.+)$/);
    if (listItem) {
      if (currentListKey !== 'source_paths' || !isStrictYamlScalar(listItem[1])) {
        throw new Error(errorMessage);
      }
      continue;
    }

    if (/^\s/.test(line)) throw new Error(errorMessage);
    const keyValue = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!keyValue) throw new Error(errorMessage);
    const key = keyValue[1];
    const value = keyValue[2];
    if (!allowedKeys.has(key) || seenKeys.has(key)) throw new Error(errorMessage);
    seenKeys.add(key);

    if (!value) {
      if (key !== 'source_paths') throw new Error(errorMessage);
      currentListKey = key;
      continue;
    }

    currentListKey = '';
    if (key === 'source_paths' || !isStrictYamlScalar(value)) {
      throw new Error(errorMessage);
    }
    if (key === 'tags' && (!value.startsWith('[') || !value.endsWith(']'))) {
      throw new Error(errorMessage);
    }
  }

  const frontmatter = parseFrontmatter(trimmed);
  const allowedStatuses = new Set(['done', 'follow-up', 'paused', 'verified-local', 'procedure-pending']);
  const bodyTitle = stripFrontmatter(trimmed).split(/\r?\n/).find(line => /^#\s+\S/.test(line));
  const valid = [
    frontmatter.type === 'session-recap',
    isValidIsoDate(frontmatter.date),
    /^[A-Za-z0-9_-]{1,64}$/.test(String(frontmatter.project || '')),
    /^[A-Za-z0-9_-]{1,64}$/.test(String(frontmatter.system || '')),
    /^[A-Za-z0-9._-]{1,128}$/.test(String(frontmatter.repo || '')),
    /^[A-Za-z0-9._-]{1,128}$/.test(String(frontmatter.topic || '')),
    allowedStatuses.has(String(frontmatter.status || '')),
    frontmatter.recap_mode === 'manual',
    typeof frontmatter.tags === 'string' && /^\[[^\[\]]+\]$/.test(frontmatter.tags) && /\brecap\b/i.test(frontmatter.tags),
    Array.isArray(frontmatter.source_paths) && frontmatter.source_paths.length > 0,
    typeof frontmatter.summary === 'string' && frontmatter.summary.trim().length > 0 && frontmatter.summary.length <= 240,
    Boolean(bodyTitle)
  ];
  if (valid.includes(false)) throw new Error(errorMessage);
  return frontmatter;
}

function isStrictYamlScalar(value) {
  const text = String(value || '').trim();
  if (!text || /[\r\n]/.test(text)) return false;
  if (text.startsWith('"')) {
    if (!text.endsWith('"') || text.length < 2) return false;
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }
  if (text.startsWith("'")) {
    return text.endsWith("'") && text.length >= 2 && !text.slice(1, -1).includes("'");
  }
  if (text.startsWith('[')) {
    if (!text.endsWith(']')) return false;
    const items = text.slice(1, -1).split(',').map(item => item.trim());
    return items.length > 0 && items.every(item => item && !/[\[\]{}]/.test(item));
  }
  return !/^[\[{]/.test(text);
}

function parseFrontmatter(text) {
  const trimmed = String(text || '').replace(/^\uFEFF/, '');
  if (!trimmed.startsWith('---\n') && !trimmed.startsWith('---\r\n')) return {};

  const lines = trimmed.split(/\r?\n/);
  const result = {};
  let currentListKey = '';
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === '---') break;

    const listItem = line.match(/^\s*-\s+(.*)$/);
    if (listItem && currentListKey) {
      if (!Array.isArray(result[currentListKey])) result[currentListKey] = [];
      result[currentListKey].push(listItem[1].trim());
      continue;
    }

    const keyValue = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!keyValue) continue;

    const key = keyValue[1];
    const value = keyValue[2];
    if (!value) {
      result[key] = [];
      currentListKey = key;
      continue;
    }

    currentListKey = '';
    result[key] = stripWrappingQuotes(value.trim());
  }

  return result;
}

function stripFrontmatter(text) {
  const trimmed = String(text || '').replace(/^\uFEFF/, '');
  if (!trimmed.startsWith('---\n') && !trimmed.startsWith('---\r\n')) return trimmed;
  const lines = trimmed.split(/\r?\n/);
  let index = 1;
  while (index < lines.length && lines[index] !== '---') index += 1;
  return lines.slice(index + 1).join('\n').trim();
}

function parseSections(body) {
  const sections = {};
  let current = '';
  for (const rawLine of String(body || '').split(/\r?\n/)) {
    const heading = rawLine.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = heading[1].trim();
      sections[current] = [];
      continue;
    }
    if (!current) continue;
    sections[current].push(rawLine);
  }
  return sections;
}

function collectBodyLines(sections) {
  return Object.values(sections)
    .flat()
    .map(firstMeaningfulFragment)
    .filter(Boolean)
    .filter(line => !isSensitiveText(line));
}

function firstMeaningfulLine(lines) {
  if (!Array.isArray(lines)) return '';
  for (const line of lines) {
    const next = firstMeaningfulFragment(line);
    if (next) return next;
  }
  return '';
}

function firstMeaningfulFragment(value) {
  const line = sanitizeLine(value);
  if (!line) return '';
  if (/^\[[ xX]?\]$/.test(line)) return '';
  return line;
}

function sanitizeLine(value) {
  const line = String(value || '')
    .replace(/^\s*[-*]\s*(\[[ xX]\]\s*)?/, '')
    .replace(/^\s*\d+\.\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!line || line.length < 8 || line.length > 240) return '';
  if (/^#{1,6}\s/.test(line) || line.startsWith('```')) return '';
  return sanitizeScalar(line);
}

function normalizeDate(value, now) {
  const date = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function normalizeProject(value) {
  return sanitizeScalar(String(value || 'PIXIUCORE').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '')) || 'PIXIUCORE';
}

function normalizeSystem(value, project) {
  const next = sanitizeScalar(String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''));
  return next || project;
}

function resolveRecapPath(corePath, inputPath) {
  const recapRoot = path.join(corePath, 'vault', 'memory', 'recaps');
  const raw = String(inputPath || '').trim();
  if (!raw) throw new Error('invalid recap path');
  if (path.isAbsolute(raw)) throw new Error('absolute recap path is not allowed');

  const candidate = raw.startsWith('vault/') || raw.startsWith('vault\\')
    ? path.resolve(corePath, raw)
    : path.resolve(recapRoot, raw);

  assertPathWithinRoot(candidate, recapRoot, 'recap path');
  return candidate;
}

function resolveCorePath(explicitCorePath) {
  return explicitCorePath ||
    process.env.PIXIU_CORE ||
    process.env.PIXIU_CORE_PATH ||
    path.join(process.env.USERPROFILE || process.env.HOME || '.', '.pixiu-core');
}

function assertManualInput(input) {
  assertInputSchema(input, {
    requireContent: true,
    errorMessage: 'manual recap input rejected'
  });
}

function assertCaptureInput(input) {
  assertInputSchema(input, {
    requireContent: false,
    errorMessage: 'capture input rejected'
  });
}

function assertInputSchema(input, options) {
  if (!isPlainObject(input)) {
    throw new Error(options.errorMessage);
  }

  const pathKeys = ['relative_path', 'recap_path', 'path'];
  const providedPathKeys = pathKeys.filter(key => Object.prototype.hasOwnProperty.call(input, key));
  if (providedPathKeys.length === 0 || providedPathKeys.some(key =>
    typeof input[key] !== 'string' || !input[key].trim()
  )) {
    throw new Error(options.errorMessage);
  }

  const hasContent = Object.prototype.hasOwnProperty.call(input, 'content');
  if ((options.requireContent && !hasContent) || (hasContent && typeof input.content !== 'string')) {
    throw new Error(options.errorMessage);
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parseJsonOrThrow(value) {
  try {
    return JSON.parse(String(value || ''));
  } catch {
    throw new Error('invalid JSON input');
  }
}

function assertPayloadWithinLimit(value) {
  const size = Buffer.byteLength(String(value || ''), 'utf8');
  if (size > MAX_STDIN) {
    throw new Error(`stdin payload exceeds ${MAX_STDIN} bytes`);
  }
}

function stripWrappingQuotes(value) {
  return String(value || '').replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
}

function quoteYaml(value) {
  return JSON.stringify(String(value || '').replace(/\r?\n/g, ' ').trim());
}

function sanitizeScalar(value) {
  return String(value || '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSensitiveText(value) {
  const text = String(value || '').normalize('NFKC');
  return UNSAFE_RECAP_PATTERNS.some(pattern => pattern.test(text)) ||
    /<codex_internal_context/i.test(text);
}

function assertSafeRecapText(value, errorMessage) {
  if (isSensitiveText(value)) {
    throw new Error(errorMessage);
  }
}

function isSensitiveSourcePath(value) {
  const text = String(value || '').normalize('NFKC');
  const segments = text.split(/[\\/]/);
  return !text ||
    path.isAbsolute(text) ||
    /^[A-Za-z]:[\\/]/.test(text) ||
    /^\\\\/.test(text) ||
    /^\//.test(text) ||
    /^~[\\/]/.test(text) ||
    /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(text) ||
    segments.includes('..') ||
    /(?:\b(?:token|password|secret|authorization|api[_-]?key|aws_secret_access_key)\b|(?:密碼|密码|密鑰|密钥|權杖|权杖|令牌|憑證|凭证))[^\p{L}\p{N}\r\n]*[\p{L}\p{N}][\p{L}\p{N}._~+/=-]{3,}/iu.test(text) ||
    /\bbearer\s+[A-Za-z0-9._~+/=-]{8,}/i.test(text) ||
    /\b(?:sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})\b/i.test(text) ||
    /<codex_internal_context/i.test(text);
}

function publicCliErrorMessage(error, fallback) {
  const message = error && typeof error.message === 'string' ? error.message : '';
  if (/^(?:invalid JSON input|stdin payload exceeds 1048576 bytes|capture input rejected|manual recap input rejected|manual recap content is required)$/.test(message)) {
    return message;
  }
  return fallback;
}

function safeFileName(value) {
  return String(value || '').replace(/[^A-Za-z0-9._-]/g, '_');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
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
      process.stderr.write(`[pixiu-deterministic-capture] ${publicCliErrorMessage(err, 'capture failed')}\n`);
    }
  });
}

module.exports = {
  run,
  captureRecap,
  parseFrontmatter,
  assertFormalManualRecapSchema,
  assertCanonicalRecapPath,
  isValidIsoDate,
  parseSections,
  normalizeReadablePath,
  assertPathWithinRoot,
  assertLexicalPathWithinRoot,
  atomicWriteText,
  atomicWriteTextExclusive,
  withFileLock,
  parseJsonOrThrow,
  assertPayloadWithinLimit,
  assertSafeRecapText,
  preflightRecapText,
  publicCliErrorMessage,
  assertManualInput,
  assertCaptureInput
};
