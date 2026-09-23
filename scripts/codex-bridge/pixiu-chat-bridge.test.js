#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  RESPONSE_SCHEMA,
  buildChatPrompt,
  createProbeRequest,
  createProbeResponse,
  runProbe,
  verifyProbe
} = require('./pixiu-chat-bridge');

const BASE_TIME = Date.parse('2026-09-23T07:30:00.000Z');

function nativeEvidence(overrides = {}) {
  return {
    transport: 'chatgpt-desktop-native',
    authMode: 'chatgpt-session',
    apiKeyUsed: false,
    manualCopy: false,
    readBack: true,
    sessionFingerprint: 'sha256:test-session',
    ...overrides
  };
}

test('每次建立 probe 都有唯一 probeId 與 nonce', () => {
  const a = createProbeRequest({ now: BASE_TIME });
  const b = createProbeRequest({ now: BASE_TIME });

  assert.notEqual(a.probeId, b.probeId);
  assert.notEqual(a.nonce, b.nonce);
  assert.equal(a.schema, 'pixiu.chat-bridge.probe-request.v1');
});

test('Chat prompt 只要求回傳可關聯的單行 JSON', () => {
  const request = createProbeRequest({
    now: BASE_TIME,
    probeId: 'pixiu-native-chat-test-01',
    nonce: 'nonce-01'
  });

  const prompt = buildChatPrompt(request);
  const expected = JSON.stringify({
    schema: RESPONSE_SCHEMA,
    probeId: request.probeId,
    nonce: request.nonce,
    received: true
  });

  assert.match(prompt, /不要使用工具/);
  assert.ok(prompt.endsWith(expected));
});

test('正確的 native read-back 證據可通過 correlation gate', () => {
  const request = createProbeRequest({ now: BASE_TIME, ttlMs: 5000 });
  const response = createProbeResponse(request, { now: BASE_TIME + 100 });
  const result = verifyProbe(request, response, nativeEvidence(), { now: BASE_TIME + 200 });

  assert.equal(result.result, 'PASS');
  assert.equal(result.nativeVerified, true);
  assert.deepEqual(result.reasons, []);
});

test('probeId 不一致時拒絕回覆', () => {
  const request = createProbeRequest({ now: BASE_TIME, ttlMs: 5000 });
  const response = {
    ...createProbeResponse(request, { now: BASE_TIME + 100 }),
    probeId: 'other-probe'
  };

  const result = verifyProbe(request, response, nativeEvidence(), { now: BASE_TIME + 200 });
  assert.equal(result.result, 'FAIL');
  assert.match(result.reasons.join('\n'), /probeId 不一致/);
});

test('nonce 不一致時拒絕回覆', () => {
  const request = createProbeRequest({ now: BASE_TIME, ttlMs: 5000 });
  const response = {
    ...createProbeResponse(request, { now: BASE_TIME + 100 }),
    nonce: 'wrong-nonce'
  };

  const result = verifyProbe(request, response, nativeEvidence(), { now: BASE_TIME + 200 });
  assert.equal(result.result, 'FAIL');
  assert.match(result.reasons.join('\n'), /nonce 不一致/);
});

test('超時回覆不得通過', () => {
  const request = createProbeRequest({ now: BASE_TIME, ttlMs: 1000 });
  const response = createProbeResponse(request, { now: BASE_TIME + 500 });

  const result = verifyProbe(request, response, nativeEvidence(), { now: BASE_TIME + 1001 });
  assert.equal(result.result, 'FAIL');
  assert.match(result.reasons.join('\n'), /超過 probe 有效期限/);
});

test('使用 API Key 的路徑不得標成 native verified', () => {
  const request = createProbeRequest({ now: BASE_TIME, ttlMs: 5000 });
  const response = createProbeResponse(request, { now: BASE_TIME + 100 });

  const result = verifyProbe(
    request,
    response,
    nativeEvidence({ apiKeyUsed: true }),
    { now: BASE_TIME + 200 }
  );

  assert.equal(result.result, 'FAIL');
  assert.equal(result.nativeVerified, false);
  assert.match(result.reasons.join('\n'), /使用了 API Key/);
});

test('人工 copy paste 的路徑不得標成 native verified', () => {
  const request = createProbeRequest({ now: BASE_TIME, ttlMs: 5000 });
  const response = createProbeResponse(request, { now: BASE_TIME + 100 });

  const result = verifyProbe(
    request,
    response,
    nativeEvidence({ manualCopy: true }),
    { now: BASE_TIME + 200 }
  );

  assert.equal(result.result, 'FAIL');
  assert.equal(result.nativeVerified, false);
  assert.match(result.reasons.join('\n'), /人工 copy\/paste/);
});

test('未完成 Codex read-back 時不得通過', () => {
  const request = createProbeRequest({ now: BASE_TIME, ttlMs: 5000 });
  const response = createProbeResponse(request, { now: BASE_TIME + 100 });

  const result = verifyProbe(
    request,
    response,
    nativeEvidence({ readBack: false }),
    { now: BASE_TIME + 200 }
  );

  assert.equal(result.result, 'FAIL');
  assert.match(result.reasons.join('\n'), /尚未確認 read-back/);
});

test('synthetic round trip 可通過協議但不能冒充 native verified', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-chat-bridge-'));
  const ledgerPath = path.join(tmp, 'probe-ledger.jsonl');
  let capturedRequest = null;

  const transport = {
    async send(_prompt, request) {
      capturedRequest = request;
    },
    async read() {
      return createProbeResponse(capturedRequest, { now: BASE_TIME + 100 });
    }
  };

  const result = await runProbe({
    transport,
    request: createProbeRequest({ now: BASE_TIME, ttlMs: 5000 }),
    evidence: {
      transport: 'synthetic',
      authMode: 'synthetic',
      apiKeyUsed: false,
      manualCopy: false,
      readBack: true
    },
    ledgerPath,
    now: BASE_TIME + 200
  });

  assert.equal(result.verification.result, 'PASS');
  assert.equal(result.verification.nativeVerified, false);

  const events = fs.readFileSync(ledgerPath, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  assert.deepEqual(events.map(event => event.type), ['CREATED', 'SENT', 'READ', 'VERIFIED']);
  assert.equal(JSON.stringify(events).includes('apiKey'), true);
  assert.equal(JSON.stringify(events).includes('secret'), false);
});
