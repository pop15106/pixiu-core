#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REQUEST_SCHEMA = 'pixiu.chat-bridge.probe-request.v1';
const RESPONSE_SCHEMA = 'pixiu.chat-bridge.probe-response.v1';
const VERIFICATION_SCHEMA = 'pixiu.chat-bridge.verification.v1';
const DEFAULT_TTL_MS = 120000;
const MAX_TTL_MS = 10 * 60 * 1000;
const MAX_PROBE_ID_LENGTH = 128;
const MAX_NONCE_LENGTH = 128;
const MAX_MESSAGE_LENGTH = 2048;
const MAX_LEDGER_REASON_LENGTH = 512;
const MAX_EVIDENCE_VALUE_LENGTH = 64;
const CANCEL_TIMEOUT_MS = 250;
const KNOWN_TRANSPORTS = new Map([
  ['synthetic', new Set(['synthetic'])],
  ['chatgpt-desktop-native', new Set(['chatgpt-session'])]
]);

class ProbeError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'ProbeError';
    this.code = code;
    this.phase = options.phase || '';
    this.outcomeUnknown = options.outcomeUnknown === true;
    this.cause = options.cause;
  }
}

function nowMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function iso(value) {
  return new Date(nowMs(value)).toISOString();
}

function createProbeId(at = Date.now()) {
  const stamp = new Date(nowMs(at)).toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
    .replace('T', '-');
  return `pixiu-native-chat-${stamp}-${crypto.randomBytes(4).toString('hex')}`;
}

function createProbeRequest(options = {}) {
  const createdMs = nowMs(options.now);
  const ttlMs = Number(options.ttlMs ?? DEFAULT_TTL_MS);
  if (!Number.isInteger(ttlMs) || ttlMs <= 0 || ttlMs > MAX_TTL_MS) {
    throw new ProbeError('INVALID_TTL', `ttlMs 必須是 1 到 ${MAX_TTL_MS} 之間的整數`);
  }

  const probeId = String(options.probeId || createProbeId(createdMs));
  const nonce = String(options.nonce || crypto.randomBytes(16).toString('hex'));
  const message = String(options.message || 'Pixiu Chat Bridge native round-trip probe');

  const request = {
    schema: REQUEST_SCHEMA,
    probeId,
    nonce,
    createdAt: new Date(createdMs).toISOString(),
    expiresAt: new Date(createdMs + ttlMs).toISOString(),
    message
  };

  const errors = validateProbeRequest(request);
  if (errors.length) {
    throw new ProbeError('INVALID_REQUEST', errors.join('；'));
  }
  return request;
}

function validateProbeRequest(request) {
  const errors = [];
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return ['request 必須是物件'];
  }
  if (request.schema !== REQUEST_SCHEMA) errors.push('request.schema 不符');
  if (typeof request.probeId !== 'string' || !request.probeId.trim()) {
    errors.push('request.probeId 缺失');
  } else if (request.probeId.length > MAX_PROBE_ID_LENGTH) {
    errors.push(`request.probeId 超過 ${MAX_PROBE_ID_LENGTH} 字元`);
  } else if (!/^[A-Za-z0-9._:-]+$/.test(request.probeId)) {
    errors.push('request.probeId 含不允許字元');
  }
  if (typeof request.nonce !== 'string' || !request.nonce.trim()) {
    errors.push('request.nonce 缺失');
  } else if (request.nonce.length > MAX_NONCE_LENGTH) {
    errors.push(`request.nonce 超過 ${MAX_NONCE_LENGTH} 字元`);
  } else if (!/^[A-Za-z0-9._:-]+$/.test(request.nonce)) {
    errors.push('request.nonce 含不允許字元');
  }
  if (typeof request.message !== 'string') {
    errors.push('request.message 必須是字串');
  } else if (request.message.length > MAX_MESSAGE_LENGTH) {
    errors.push(`request.message 超過 ${MAX_MESSAGE_LENGTH} 字元`);
  }

  const createdAtMs = Date.parse(request.createdAt || '');
  const expiresAtMs = Date.parse(request.expiresAt || '');
  if (!Number.isFinite(createdAtMs)) errors.push('request.createdAt 無效');
  if (!Number.isFinite(expiresAtMs)) errors.push('request.expiresAt 無效');
  if (Number.isFinite(createdAtMs) && Number.isFinite(expiresAtMs) && expiresAtMs <= createdAtMs) {
    errors.push('request.expiresAt 必須晚於 createdAt');
  }
  if (
    Number.isFinite(createdAtMs) &&
    Number.isFinite(expiresAtMs) &&
    expiresAtMs - createdAtMs > MAX_TTL_MS
  ) {
    errors.push(`request TTL 不得超過 ${MAX_TTL_MS}ms`);
  }
  return errors;
}

function assertRequestLive(request, currentMs = Date.now()) {
  const errors = validateProbeRequest(request);
  if (errors.length) {
    throw new ProbeError('INVALID_REQUEST', errors.join('；'), { phase: 'PRE_SEND' });
  }
  const expiresAtMs = Date.parse(request.expiresAt);
  if (currentMs >= expiresAtMs) {
    throw new ProbeError('PROBE_EXPIRED', 'probe 已過期，禁止送出', { phase: 'PRE_SEND' });
  }
}

function buildChatPrompt(request) {
  const errors = validateProbeRequest(request);
  if (errors.length) throw new ProbeError('INVALID_REQUEST', errors.join('；'));

  const expected = {
    schema: RESPONSE_SCHEMA,
    probeId: request.probeId,
    nonce: request.nonce,
    received: true
  };

  return [
    '這是 Pixiu Chat Bridge 的原生連線驗證。',
    '請不要使用工具、不要修改檔案，也不要開始其他工作。',
    '請只回覆以下單行 JSON：',
    JSON.stringify(expected)
  ].join('\n');
}

function createProbeResponse(request, options = {}) {
  const errors = validateProbeRequest(request);
  if (errors.length) throw new ProbeError('INVALID_REQUEST', errors.join('；'));

  return {
    schema: RESPONSE_SCHEMA,
    probeId: request.probeId,
    nonce: request.nonce,
    received: options.received !== false,
    respondedAt: iso(options.now)
  };
}

function validateProbeResponse(request, response, options = {}) {
  const reasons = [];
  const requestErrors = validateProbeRequest(request);
  if (requestErrors.length) reasons.push(...requestErrors);

  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    reasons.push('response 必須是物件');
    return reasons;
  }

  if (response.schema !== RESPONSE_SCHEMA) reasons.push('response.schema 不符');
  if (response.probeId !== request?.probeId) reasons.push('probeId 不一致');
  if (response.nonce !== request?.nonce) reasons.push('nonce 不一致');
  if (response.received !== true) reasons.push('received 必須為 true');

  const respondedAtMs = response.respondedAt === undefined ? NaN : Date.parse(response.respondedAt || '');
  if (response.respondedAt !== undefined && !Number.isFinite(respondedAtMs)) {
    reasons.push('response.respondedAt 無效');
  }

  const checkedAtMs = nowMs(options.now);
  const createdAtMs = Date.parse(request?.createdAt || '');
  const expiresAtMs = Date.parse(request?.expiresAt || '');
  if (Number.isFinite(respondedAtMs) && Number.isFinite(createdAtMs) && respondedAtMs < createdAtMs) {
    reasons.push('response.respondedAt 早於 request.createdAt');
  }
  if (Number.isFinite(respondedAtMs) && Number.isFinite(expiresAtMs) && respondedAtMs >= expiresAtMs) {
    reasons.push('response.respondedAt 超過 probe 有效期限');
  }
  if (Number.isFinite(expiresAtMs) && checkedAtMs >= expiresAtMs) {
    reasons.push('response 已超過 probe 有效期限');
  }

  return reasons;
}

function fingerprintSession(rawValue) {
  const value = String(rawValue || '');
  if (!value) return '';
  return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function normalizeEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return {
      transport: null,
      authMode: null,
      apiKeyUsed: null,
      manualCopy: null,
      readBack: null,
      sessionFingerprint: ''
    };
  }

  const fingerprint = typeof evidence.sessionFingerprint === 'string' &&
    /^sha256:[a-f0-9]{64}$/.test(evidence.sessionFingerprint)
    ? evidence.sessionFingerprint
    : '';

  const transport = typeof evidence.transport === 'string' &&
    evidence.transport.length <= MAX_EVIDENCE_VALUE_LENGTH &&
    KNOWN_TRANSPORTS.has(evidence.transport)
    ? evidence.transport
    : null;
  const authMode = transport &&
    typeof evidence.authMode === 'string' &&
    evidence.authMode.length <= MAX_EVIDENCE_VALUE_LENGTH &&
    KNOWN_TRANSPORTS.get(transport).has(evidence.authMode)
    ? evidence.authMode
    : null;

  return {
    transport,
    authMode,
    apiKeyUsed: typeof evidence.apiKeyUsed === 'boolean' ? evidence.apiKeyUsed : null,
    manualCopy: typeof evidence.manualCopy === 'boolean' ? evidence.manualCopy : null,
    readBack: typeof evidence.readBack === 'boolean' ? evidence.readBack : null,
    sessionFingerprint: fingerprint
  };
}

function validateEvidence(evidence) {
  const reasons = [];
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return ['evidence 必須是物件'];
  }

  if (typeof evidence.transport !== 'string' || !evidence.transport.trim()) {
    reasons.push('evidence.transport 必須是非空字串');
  } else if (evidence.transport.length > MAX_EVIDENCE_VALUE_LENGTH) {
    reasons.push(`evidence.transport 超過 ${MAX_EVIDENCE_VALUE_LENGTH} 字元`);
  } else if (!KNOWN_TRANSPORTS.has(evidence.transport)) {
    reasons.push(`未知 transport：${evidence.transport}`);
  }

  if (typeof evidence.authMode !== 'string' || !evidence.authMode.trim()) {
    reasons.push('evidence.authMode 必須是非空字串');
  } else if (evidence.authMode.length > MAX_EVIDENCE_VALUE_LENGTH) {
    reasons.push(`evidence.authMode 超過 ${MAX_EVIDENCE_VALUE_LENGTH} 字元`);
  } else if (
    typeof evidence.transport === 'string' &&
    KNOWN_TRANSPORTS.has(evidence.transport) &&
    !KNOWN_TRANSPORTS.get(evidence.transport).has(evidence.authMode)
  ) {
    reasons.push(`transport=${evidence.transport} 不接受 authMode=${evidence.authMode}`);
  }

  for (const key of ['apiKeyUsed', 'manualCopy', 'readBack']) {
    if (typeof evidence[key] !== 'boolean') {
      reasons.push(`evidence.${key} 必須是 boolean`);
    }
  }

  if (
    evidence.sessionFingerprint !== undefined &&
    evidence.sessionFingerprint !== '' &&
    (
      typeof evidence.sessionFingerprint !== 'string' ||
      !/^sha256:[a-f0-9]{64}$/.test(evidence.sessionFingerprint)
    )
  ) {
    reasons.push('evidence.sessionFingerprint 必須是 sha256:<64 hex> 或省略');
  }
  return reasons;
}

function verifyProbeAt(request, response, evidence, checkedAtMs) {
  const reasons = validateProbeResponse(request, response, { now: checkedAtMs });
  reasons.push(...validateEvidence(evidence));
  const safeEvidence = normalizeEvidence(evidence);

  if (safeEvidence.apiKeyUsed === true) reasons.push('此 probe 使用了 API Key');
  if (safeEvidence.manualCopy === true) reasons.push('此 probe 含人工 copy/paste');
  if (safeEvidence.readBack === false) reasons.push('Codex 端尚未確認 read-back');

  const protocolVerified = reasons.length === 0;
  const synthetic = safeEvidence.transport === 'synthetic';
  const nativeVerified = false;
  const nativeReasons = [];

  if (protocolVerified && synthetic) {
    nativeReasons.push('synthetic transport 只能驗證協議，不能驗證 Codex App native transport');
  }
  if (protocolVerified && !synthetic) {
    nativeReasons.push('尚未接上可產生可核對收發收據的受信任 native adapter');
  }

  return {
    schema: VERIFICATION_SCHEMA,
    probeId: request?.probeId || response?.probeId || '',
    checkedAt: iso(checkedAtMs),
    result: protocolVerified ? 'PASS' : 'FAIL',
    protocolVerified,
    nativeVerified,
    evidence: safeEvidence,
    reasons: [...new Set(reasons)],
    nativeReasons
  };
}

function verifyProbe(request, response, evidence) {
  return verifyProbeAt(request, response, evidence, Date.now());
}

function defaultLedgerPath(corePath) {
  const core = corePath ||
    process.env.PIXIU_CORE ||
    process.env.PIXIU_CORE_PATH ||
    path.resolve(__dirname, '..', '..');
  return path.join(core, 'state', 'chat-bridge', 'probe-ledger.jsonl');
}

function probeStatePath(ledgerPath, probeId) {
  const target = path.resolve(ledgerPath || defaultLedgerPath());
  const key = crypto.createHash('sha256').update(String(probeId || ''), 'utf8').digest('hex');
  return path.join(path.dirname(target), 'probes', `${key}.json`);
}

function writeProbeState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function reserveProbe(ledgerPath, request, at = Date.now()) {
  const statePath = probeStatePath(ledgerPath, request.probeId);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const state = {
    schema: 'pixiu.chat-bridge.probe-state.v1',
    probeIdHash: crypto.createHash('sha256').update(request.probeId, 'utf8').digest('hex'),
    correlationHash: crypto.createHash('sha256')
      .update(`${request.probeId}\u0000${request.nonce}`, 'utf8')
      .digest('hex'),
    status: 'pending',
    createdAt: iso(at),
    expiresAt: request.expiresAt
  };

  let fd;
  try {
    fd = fs.openSync(statePath, 'wx');
    fs.writeFileSync(fd, JSON.stringify(state, null, 2) + '\n', 'utf8');
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      throw new ProbeError(
        'PROBE_REPLAY',
        '相同 probeId 已存在，禁止重複送出；重試請建立新的 probeId',
        { phase: 'PRE_SEND' }
      );
    }
    throw error;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
  return statePath;
}

function finalizeProbeState(statePath, status, details = {}) {
  let current = {};
  try {
    current = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    current = {};
  }
  writeProbeState(statePath, {
    ...current,
    status,
    finishedAt: iso(details.at),
    result: details.result || '',
    code: details.code || ''
  });
}

function redactSensitiveText(value) {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(authorization|api[-_]?key|token|cookie|secret|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
}

function sanitizeReason(value) {
  return redactSensitiveText(value)
    .replace(/[\r\n]+/g, ' ')
    .slice(0, MAX_LEDGER_REASON_LENGTH);
}

function appendLedgerEvent(ledgerPath, event) {
  const target = path.resolve(ledgerPath || defaultLedgerPath());
  fs.mkdirSync(path.dirname(target), { recursive: true });

  const safeEvent = {
    at: iso(event?.at),
    type: String(event?.type || 'UNKNOWN'),
    probeId: String(event?.probeId || '').slice(0, MAX_PROBE_ID_LENGTH),
    phase: event?.phase ? String(event.phase).slice(0, 32) : undefined,
    code: event?.code ? String(event.code).slice(0, 64) : undefined,
    result: event?.result ? String(event.result).slice(0, 16) : undefined,
    protocolVerified: event?.protocolVerified === true,
    nativeVerified: event?.nativeVerified === true,
    evidence: event?.evidence ? normalizeEvidence(event.evidence) : undefined,
    reasons: Array.isArray(event?.reasons)
      ? event.reasons.map(sanitizeReason).slice(0, 20)
      : undefined,
    nativeReasons: Array.isArray(event?.nativeReasons)
      ? event.nativeReasons.map(sanitizeReason).slice(0, 20)
      : undefined
  };

  fs.appendFileSync(target, JSON.stringify(safeEvent) + '\n', 'utf8');
  return target;
}

async function cancelTransport(transport, probe, reason) {
  if (!transport || typeof transport.cancel !== 'function') return;
  let timer;
  try {
    await Promise.race([
      Promise.resolve().then(() => transport.cancel(probe.probeId, probe, reason)),
      new Promise(resolve => {
        timer = setTimeout(resolve, CANCEL_TIMEOUT_MS);
      })
    ]);
  } catch {
    // 取消是 best-effort；原始錯誤才是主要結果。
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function withDeadline(action, deadlineMs, options = {}) {
  const remainingMs = deadlineMs - Date.now();
  if (remainingMs <= 0) {
    throw new ProbeError(options.code || 'TIMEOUT', options.message || '操作逾時', {
      phase: options.phase,
      outcomeUnknown: options.outcomeUnknown === true
    });
  }

  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(action),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new ProbeError(options.code || 'TIMEOUT', options.message || '操作逾時', {
            phase: options.phase,
            outcomeUnknown: options.outcomeUnknown === true
          }));
        }, remainingMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function toProbeError(error, fallbackCode, phase, outcomeUnknown = false) {
  if (error instanceof ProbeError) return error;
  return new ProbeError(
    fallbackCode,
    error?.message || String(error || '未知錯誤'),
    { phase, outcomeUnknown, cause: error }
  );
}

async function runProbe({ transport, request, evidence, ledgerPath } = {}) {
  if (!transport || typeof transport.send !== 'function' || typeof transport.read !== 'function') {
    throw new ProbeError(
      'INVALID_TRANSPORT',
      'transport 必須實作 send(prompt, request) 與 read(probeId, request)'
    );
  }

  const probe = request || createProbeRequest();
  const targetLedger = ledgerPath || defaultLedgerPath();
  let statePath = '';
  let phase = 'PRE_SEND';

  try {
    assertRequestLive(probe, Date.now());
    statePath = reserveProbe(targetLedger, probe, Date.now());
    appendLedgerEvent(targetLedger, { type: 'CREATED', probeId: probe.probeId });

    const deadlineMs = Date.parse(probe.expiresAt);
    const prompt = buildChatPrompt(probe);

    phase = 'SEND';
    await withDeadline(
      () => transport.send(prompt, probe),
      deadlineMs,
      {
        code: 'SEND_TIMEOUT',
        message: '送出 probe 逾時；送出結果可能不明，禁止自動重送',
        phase,
        outcomeUnknown: true
      }
    );
    appendLedgerEvent(targetLedger, { type: 'SENT', probeId: probe.probeId, phase });

    phase = 'READ';
    const response = await withDeadline(
      () => transport.read(probe.probeId, probe),
      deadlineMs,
      {
        code: 'READ_TIMEOUT',
        message: '等待 Chat 回覆逾時',
        phase
      }
    );
    appendLedgerEvent(targetLedger, { type: 'READ', probeId: probe.probeId, phase });

    phase = 'EVIDENCE';
    const resolvedEvidence = typeof evidence === 'function'
      ? await withDeadline(
        () => evidence({ request: probe, response }),
        deadlineMs,
        {
          code: 'EVIDENCE_TIMEOUT',
          message: '取得 transport evidence 逾時',
          phase
        }
      )
      : evidence;

    phase = 'VERIFY';
    const verification = verifyProbe(probe, response, resolvedEvidence);
    const eventType = verification.result === 'PASS' ? 'PROTOCOL_VERIFIED' : 'FAILED';
    appendLedgerEvent(targetLedger, {
      type: eventType,
      probeId: probe.probeId,
      phase,
      result: verification.result,
      protocolVerified: verification.protocolVerified,
      nativeVerified: verification.nativeVerified,
      evidence: verification.evidence,
      reasons: verification.reasons,
      nativeReasons: verification.nativeReasons
    });
    finalizeProbeState(
      statePath,
      verification.result === 'PASS' ? 'protocol_verified' : 'failed',
      { result: verification.result }
    );
    return { request: probe, response, verification };
  } catch (error) {
    const wrapped = toProbeError(
      error,
      `${phase}_FAILED`,
      phase,
      phase === 'SEND'
    );
    await cancelTransport(transport, probe, wrapped.code);
    appendLedgerEvent(targetLedger, {
      type: 'FAILED',
      probeId: probe?.probeId,
      phase: wrapped.phase || phase,
      code: wrapped.code,
      result: 'FAIL',
      reasons: [wrapped.message]
    });
    if (statePath) {
      finalizeProbeState(statePath, 'failed', { result: 'FAIL', code: wrapped.code });
    }
    throw wrapped;
  }
}

module.exports = {
  REQUEST_SCHEMA,
  RESPONSE_SCHEMA,
  VERIFICATION_SCHEMA,
  DEFAULT_TTL_MS,
  MAX_TTL_MS,
  ProbeError,
  appendLedgerEvent,
  assertRequestLive,
  buildChatPrompt,
  createProbeId,
  createProbeRequest,
  createProbeResponse,
  defaultLedgerPath,
  fingerprintSession,
  normalizeEvidence,
  probeStatePath,
  redactSensitiveText,
  reserveProbe,
  runProbe,
  validateEvidence,
  validateProbeRequest,
  validateProbeResponse,
  verifyProbe,
  withDeadline
};
