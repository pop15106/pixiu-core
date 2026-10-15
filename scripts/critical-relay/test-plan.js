'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { safeRelative } = require('../router/resource-policy');

const PLAN_SCHEMA = 'pixiu.test-plan.v1';
const EVIDENCE_PROFILE = 'local-evidence-v1';
const hash = value => createHash('sha256').update(value).digest('hex');
const isDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
const digestObject = value => hash(JSON.stringify(stable(value)));

function boundedPath(root, relative, { mustExist = true } = {}) {
  safeRelative(relative);
  const base = fs.realpathSync(root);
  let current = base;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`拒絕連結路徑：${relative}`);
    } catch (error) {
      if (error.code !== 'ENOENT' || mustExist) throw error;
    }
  }
  return current;
}

function readText(root, relative, maxBytes = 16 * 1024 * 1024) {
  const target = boundedPath(root, relative);
  const info = fs.statSync(target);
  if (!info.isFile() || info.size > maxBytes) throw new Error(`不是可讀取的有限大小檔案：${relative}`);
  return fs.readFileSync(target, 'utf8');
}
const readJson = (root, relative) => JSON.parse(readText(root, relative));

function atomicJson(root, relative, value) {
  const target = boundedPath(root, relative, { mustExist: false });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  boundedPath(root, relative, { mustExist: false });
  const temp = `${target}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temp, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n', 'utf8');
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  fs.renameSync(temp, target);
}

function validatePlan(plan) {
  const validId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,79}$/u.test(value);
  if (!isObject(plan) || plan.schemaVersion !== PLAN_SCHEMA || plan.profile !== 'local-only' ||
      !validId(plan.id) || !Number.isSafeInteger(plan.revision) || plan.revision < 1) {
    throw new Error('測試計劃格式、版本或 profile 不合法');
  }
  if (!Array.isArray(plan.criteria) || !plan.criteria.length || !Array.isArray(plan.commands) || !plan.commands.length) {
    throw new Error('計劃需有 criteria 與 commands');
  }
  const criteria = new Map();
  for (const criterion of plan.criteria) {
    if (!isObject(criterion) || !validId(criterion.id) || criteria.has(criterion.id) ||
        !Array.isArray(criterion.requiredEvidenceKinds) || !criterion.requiredEvidenceKinds.length ||
        !criterion.requiredEvidenceKinds.every(kind => ['test', 'ui', 'api', 'build', 'document'].includes(kind))) {
      throw new Error('完成條件或證據種類不合法');
    }
    criteria.set(criterion.id, criterion);
  }
  const ids = new Set();
  const covered = new Set();
  for (const command of plan.commands) {
    if (!isObject(command) || !validId(command.id) || ids.has(command.id) ||
        command.adapter !== 'node-test' || command.evidenceKind !== 'test' ||
        typeof command.required !== 'boolean' || (!command.required && !command.optionalReason?.trim()) ||
        !Number.isSafeInteger(command.timeoutMs) || command.timeoutMs < 100 || command.timeoutMs > 300000 ||
        !Array.isArray(command.criterionRefs) || !command.criterionRefs.length ||
        !command.criterionRefs.every(id => criteria.has(id))) {
      throw new Error('測試命令格式、重複 ID 或關聯不合法');
    }
    safeRelative(command.file);
    if (command.file.startsWith('.cr/') || !/\.(?:js|mjs|cjs)$/u.test(command.file)) throw new Error('測試入口必須是來源中的 Node 檔案');
    if (command.dependsOn !== undefined && (!Array.isArray(command.dependsOn) ||
        command.dependsOn.some(id => !ids.has(id)))) throw new Error('dependsOn 只能引用前面的命令');
    ids.add(command.id);
    if (command.required) command.criterionRefs.forEach(id => covered.add(id));
  }
  if ([...criteria.keys()].some(id => !covered.has(id))) throw new Error('完成條件未被必要命令覆蓋');
  return plan;
}

function loadPlan(root, relative) { return validatePlan(readJson(root, relative)); }

function sourceSnapshot(root) {
  const options = { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 };
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], options).trim();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(headSha)) throw new Error('無法確認 Git HEAD');
  const paths = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], options)
    .split('\0').filter(Boolean))].sort();
  if (!paths.length) throw new Error('來源清單為空');
  const h = createHash('sha256');
  let fileCount = 0;
  for (const relative of paths) {
    // 唯一的輸出排除區是 .cr；私人未追蹤資料遵循 Git ignore。
    if (relative.startsWith('.cr/')) continue;
    const target = boundedPath(root, relative, { mustExist: false });
    h.update(relative + '\0');
    if (!fs.existsSync(target)) h.update('deleted\0');
    else {
      const info = fs.lstatSync(target);
      if (!info.isFile()) throw new Error(`來源包含未支援的檔案類型：${relative}`);
      h.update('file\0').update(fs.readFileSync(target)).update('\0');
    }
    fileCount++;
  }
  return { headSha, changeDigest: h.digest('hex'), fileCount, policy: 'git-files-working-bytes-v1' };
}

function bindPlan(root, planPath) {
  const plan = loadPlan(root, planPath);
  return { profile: EVIDENCE_PROFILE, planPath, planDigest: digestObject(plan) };
}

function redact(text) {
  return String(text)
    .replace(/-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----[\s\S]*?(?:-----END(?: [A-Z0-9]+)* PRIVATE KEY-----|$)/gu, '[REDACTED]')
    .replace(/\b(?:ghp_|github_pat_|sk-|xox[baprs]-)[A-Za-z0-9_-]{8,}/gu, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]{8,}/giu, 'Bearer [REDACTED]')
    .replace(/(\b(?:password|api[_-]?key|access[_-]?token|secret)\b["']?\s*[:=]\s*["']?)[^\s"',}]{4,}/giu, '$1[REDACTED]');
}

module.exports = { PLAN_SCHEMA, EVIDENCE_PROFILE, hash, isDigest, isObject, digestObject,
  boundedPath, readText, readJson, atomicJson, validatePlan, loadPlan, sourceSnapshot, bindPlan, redact };
