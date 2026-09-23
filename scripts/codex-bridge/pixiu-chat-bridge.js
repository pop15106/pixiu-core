#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REQUEST_SCHEMA = 'pixiu.chat-bridge.probe-request.v1';
const RESPONSE_SCHEMA = 'pixiu.chat-bridge.probe-response.v1';
const VERIFICATION_SCHEMA = 'pixiu.chat-bridge.verification.v1';
const DEFAULT_TTL_MS = 120000;

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
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error('ttlMs 必須是大於 0 的有限數字');
  }

  const probeId = String(options.probeId || createProbeId(createdMs));
  const nonce = String(options.nonce || crypto.randomBytes(16).toString('hex'));

  return {
    schema: REQUEST_SCHEMA,
    probeId,
    nonce,
    createdAt: new Date(createdMs).toISOString(),
    expiresAt: new Date(createdMs + ttlMs).toISOString(),
    message: String(options.message || 'Pixiu Chat Bridge native round-trip probe')
  };
}

function validateProbeRequest(request) {
  const errors = [];
  if (!request || typeof request !== 'object') {
    return ['request 必須是物件'];
  }
  if (request.schema !== REQUEST_SCHEMA) errors.push('request.schema 不符');
  if (!request.probeId || typeof request.probeId !== 'string') errors.push('request.probeId 缺失');
  if (!request.nonce || typeof request.nonce !== 'string') errors.push('request.nonce 缺失');
  if (!Number.isFinite(Date.parse(request.createdAt || ''))) errors.push('request.createdAt 無效');
  if (!Number.isFinite(Date.parse(request.expiresAt || ''))) errors.push('request.expiresAt 無效');
  return errors;
}

function buildChatPrompt(request) {
  const errors = validateProbeRequest(request);
  if (errors.length) throw new Error(errors.join('；'));

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
  if (errors.length) throw new Error(errors.join('；'));

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

  if (!response || typeof response !== 'object') {
    reasons.push('response 必須是物件');
    return reasons;
  }

  if (response.schema !== RESPONSE_SCHEMA) reasons.push('response.schema 不符');
  if (response.probeId !== request?.probeId) reasons.push('probeId 不一致');
  if (response.nonce !== request?.nonce) reasons.push('nonce 不一致');
  if (response.received !== true) reasons.push('received 必須為 true');

  const checkedAtMs = nowMs(options.now);
  const expiresAtMs = Date.parse(request?.expiresAt || '');
  if (Number.isFinite(expiresAtMs) && checkedAtMs > expiresAtMs) {
    reasons.push('response 已超過 probe 有效期限');
  }

  return reasons;
}

function normalizeEvidence(evidence = {}) {
  return {
    transport: typeof evidence.transport === 'string' ? evidence.transport : '',
    authMode: typeof evidence.authMode === 'string' ? evidence.authMode : '',
    apiKeyUsed: evidence.apiKeyUsed === true,
    manualCopy: evidence.manualCopy === true,
    readBack: evidence.readBack === true,
    sessionFingerprint: typeof evidence.sessionFingerprint === 'string'
      ? evidence.sessionFingerprint.slice(0, 128)
      : ''
  };
}

function verifyProbe(request, response, evidence = {}, options = {}) {
  const reasons = validateProbeResponse(request, response, options);
  const safeEvidence = normalizeEvidence(evidence);

  if (!safeEvidence.transport) reasons.push('缺少 transport 證據');
  if (!safeEvidence.authMode) reasons.push('缺少 authMode 證據');
  if (!safeEvidence.readBack) reasons.push('Codex 端尚未確認 read-back');
  if (safeEvidence.apiKeyUsed) reasons.push('此 probe 使用了 API Key');
  if (safeEvidence.manualCopy) reasons.push('此 probe 含人工 copy/paste');

  const synthetic = safeEvidence.transport === 'synthetic' || safeEvidence.authMode === 'synthetic';
  const protocolVerified = reasons.length === 0;
  const nativeAttested = options.nativeAttested === true;
  const nativeVerified = protocolVerified && !synthetic && nativeAttested;
  const nativeReasons = [];

  if (protocolVerified && synthetic) {
    nativeReasons.push('synthetic transport 只能驗證協議，不能驗證 Codex App native transport');
  }
  if (protocolVerified && !synthetic && !nativeAttested) {
    nativeReasons.push('缺少受信任 native runtime adapter attestation');
  }

  return {
    schema: VERIFICATION_SCHEMA,
    probeId: request?.probeId || response?.probeId || '',
    checkedAt: iso(options.now),
    result: protocolVerified ? 'PASS' : 'FAIL',
    protocolVerified,
    nativeVerified,
    evidence: safeEvidence,
    reasons,
    nativeReasons
  };
}

function defaultLedgerPath(corePath) {
  const core = corePath ||
    process.env.PIXIU_CORE ||
    process.env.PIXIU_CORE_PATH ||
    path.resolve(__dirname, '..', '..');
  return path.join(core, 'state', 'chat-bridge', 'probe-ledger.jsonl');
}

function appendLedgerEvent(ledgerPath, event) {
  const target = path.resolve(ledgerPath || defaultLedgerPath());
  fs.mkdirSync(path.dirname(target), { recursive: true });

  const safeEvent = {
    at: iso(event?.at),
    type: String(event?.type || 'UNKNOWN'),
    probeId: String(event?.probeId || ''),
    result: event?.result ? String(event.result) : undefined,
    protocolVerified: event?.protocolVerified === true,
    nativeVerified: event?.nativeVerified === true,
    evidence: event?.evidence ? normalizeEvidence(event.evidence) : undefined,
    reasons: Array.isArray(event?.reasons) ? event.reasons.map(String).slice(0, 20) : undefined,
    nativeReasons: Array.isArray(event?.nativeReasons)
      ? event.nativeReasons.map(String).slice(0, 20)
      : undefined
  };

  fs.appendFileSync(target, JSON.stringify(safeEvent) + '\n', 'utf8');
  return target;
}

async function runProbe({
  transport,
  request,
  evidence,
  ledgerPath,
  now,
  nativeAttested = false
} = {}) {
  if (!transport || typeof transport.send !== 'function' || typeof transport.read !== 'function') {
    throw new Error('transport 必須實作 send(prompt, request) 與 read(probeId, request)');
  }

  const probe = request || createProbeRequest({ now });
  appendLedgerEvent(ledgerPath, { type: 'CREATED', probeId: probe.probeId, at: now });

  const prompt = buildChatPrompt(probe);
  await transport.send(prompt, probe);
  appendLedgerEvent(ledgerPath, { type: 'SENT', probeId: probe.probeId, at: now });

  const response = await transport.read(probe.probeId, probe);
  appendLedgerEvent(ledgerPath, { type: 'READ', probeId: probe.probeId, at: now });

  const resolvedEvidence = typeof evidence === 'function'
    ? await evidence({ request: probe, response })
    : (evidence || {});

  const verification = verifyProbe(probe, response, resolvedEvidence, {
    now,
    nativeAttested
  });

  const eventType = verification.result !== 'PASS'
    ? 'FAILED'
    : verification.nativeVerified
      ? 'NATIVE_VERIFIED'
      : 'PROTOCOL_VERIFIED';

  appendLedgerEvent(ledgerPath, {
    type: eventType,
    probeId: probe.probeId,
    result: verification.result,
    protocolVerified: verification.protocolVerified,
    nativeVerified: verification.nativeVerified,
    evidence: verification.evidence,
    reasons: verification.reasons,
    nativeReasons: verification.nativeReasons,
    at: now
  });

  return { request: probe, response, verification };
}

module.exports = {
  REQUEST_SCHEMA,
  RESPONSE_SCHEMA,
  VERIFICATION_SCHEMA,
  DEFAULT_TTL_MS,
  appendLedgerEvent,
  buildChatPrompt,
  createProbeId,
  createProbeRequest,
  createProbeResponse,
  defaultLedgerPath,
  normalizeEvidence,
  runProbe,
  validateProbeRequest,
  validateProbeResponse,
  verifyProbe
};
