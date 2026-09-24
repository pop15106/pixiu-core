#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  RESPONSE_SCHEMA,
  ProbeError,
  buildChatPrompt,
  createProbeRequest,
  createProbeResponse,
  fingerprintSession,
  runProbe,
  validateProbeRequest,
  verifyProbe
} = require('./pixiu-chat-bridge');
const { exitCodeForSynthetic } = require('./pixiu-chat-probe');

const BASE_TIME = Date.now();
const VALID_FINGERPRINT = `sha256:${'a'.repeat(64)}`;

function nativeEvidence(overrides = {}) {
  return {
    transport: 'chatgpt-desktop-native',
    authMode: 'chatgpt-session',
    apiKeyUsed: false,
    manualCopy: false,
    readBack: true,
    sessionFingerprint: VALID_FINGERPRINT,
    ...overrides
  };
}

function syntheticEvidence(overrides = {}) {
  return {
    transport: 'synthetic',
    authMode: 'synthetic',
    apiKeyUsed: false,
    manualCopy: false,
    readBack: true,
    ...overrides
  };
}

function tempLedger() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-chat-bridge-'));
  return path.join(tmp, 'probe-ledger.jsonl');
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

test('沒有真實 adapter 時 nativeVerified 一律為 false', () => {
  const request = createProbeRequest({ now: BASE_TIME, ttlMs: 5000 });
  const response = createProbeResponse(request, { now: BASE_TIME + 100 });
  const result = verifyProbe(
    request,
    response,
    nativeEvidence(),
    { now: BASE_TIME + 200, nativeAttested: true }
  );
  assert.equal(result.result, 'PASS');
  assert.equal(result.protocolVerified, true);
  assert.equal(result.nativeVerified, false);
  assert.match(result.nativeReasons.join('\n'), /尚未接上/);
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

test('超時回覆不得通過 verify', () => {
  const now = Date.now();
  const request = createProbeRequest({ now: now - 2000, ttlMs: 1000 });
  const response = createProbeResponse(request, { now: now - 1500 });
  const result = verifyProbe(request, response, nativeEvidence());
  assert.equal(result.result, 'FAIL');
  assert.match(result.reasons.join('\n'), /超過 probe 有效期限/);
});

test('缺少 API Key 與人工複製 evidence 時必須失敗', () => {
  const request = createProbeRequest({ now: BASE_TIME, ttlMs: 5000 });
  const response = createProbeResponse(request, { now: BASE_TIME + 100 });
  const result = verifyProbe(request, response, {
    transport: 'synthetic',
    authMode: 'synthetic',
    readBack: true
  }, { now: BASE_TIME + 200 });
  assert.equal(result.result, 'FAIL');
  assert.match(result.reasons.join('\n'), /apiKeyUsed 必須是 boolean/);
  assert.match(result.reasons.join('\n'), /manualCopy 必須是 boolean/);
});

test('字串 true 不得被正規化成 false', () => {
  const request = createProbeRequest({ now: BASE_TIME, ttlMs: 5000 });
  const response = createProbeResponse(request, { now: BASE_TIME + 100 });
  const result = verifyProbe(request, response, {
    transport: 'synthetic',
    authMode: 'synthetic',
    apiKeyUsed: 'true',
    manualCopy: 'true',
    readBack: true
  }, { now: BASE_TIME + 200 });
  assert.equal(result.result, 'FAIL');
  assert.match(result.reasons.join('\n'), /apiKeyUsed 必須是 boolean/);
  assert.match(result.reasons.join('\n'), /manualCopy 必須是 boolean/);
});

test('evidence=null 回傳結構化 FAIL 而不是 TypeError', () => {
  const request = createProbeRequest({ now: BASE_TIME, ttlMs: 5000 });
  const response = createProbeResponse(request, { now: BASE_TIME + 100 });
  const result = verifyProbe(request, response, null, { now: BASE_TIME + 200 });
  assert.equal(result.result, 'FAIL');
  assert.match(result.reasons.join('\n'), /evidence 必須是物件/);
});

test('未知 transport 或不相容 authMode 必須失敗', () => {
  const request = createProbeRequest({ now: BASE_TIME, ttlMs: 5000 });
  const response = createProbeResponse(request, { now: BASE_TIME + 100 });
  const unknown = verifyProbe(request, response, syntheticEvidence({ transport: 'fake' }), { now: BASE_TIME + 200 });
  const mismatch = verifyProbe(request, response, syntheticEvidence({ authMode: 'chatgpt-session' }), { now: BASE_TIME + 200 });
  assert.equal(unknown.result, 'FAIL');
  assert.match(unknown.reasons.join('\n'), /未知 transport/);
  assert.equal(mismatch.result, 'FAIL');
  assert.match(mismatch.reasons.join('\n'), /不接受 authMode/);
});

test('session fingerprint 必須由 hash 格式表示', () => {
  const request = createProbeRequest({ now: BASE_TIME, ttlMs: 5000 });
  const response = createProbeResponse(request, { now: BASE_TIME + 100 });
  const result = verifyProbe(
    request,
    response,
    nativeEvidence({ sessionFingerprint: 'CANARY_ONLY_NOT_A_REAL_SECRET' }),
    { now: BASE_TIME + 200 }
  );
  assert.equal(result.result, 'FAIL');
  assert.match(result.reasons.join('\n'), /sessionFingerprint/);
  assert.match(fingerprintSession('session-123'), /^sha256:[a-f0-9]{64}$/);
});

test('expiresAt 早於 createdAt 必須失敗', () => {
  const request = createProbeRequest({ now: BASE_TIME, ttlMs: 5000 });
  request.expiresAt = new Date(BASE_TIME - 1).toISOString();
  assert.match(validateProbeRequest(request).join('\n'), /必須晚於 createdAt/);
});

test('送出前已過期時禁止 send', async () => {
  const now = Date.now();
  const request = createProbeRequest({ now: now - 1000, ttlMs: 50 });
  let sent = 0;
  await assert.rejects(
    runProbe({
      request,
      ledgerPath: tempLedger(),
      transport: {
        async send() { sent += 1; },
        async read() { return null; }
      },
      evidence: syntheticEvidence()
    }),
    error => error instanceof ProbeError && error.code === 'PROBE_EXPIRED'
  );
  assert.equal(sent, 0);
});

test('read 永不回覆時會在 TTL 內結束並寫 FAILED', async () => {
  const ledgerPath = tempLedger();
  const request = createProbeRequest({ now: Date.now(), ttlMs: 80 });
  let cancelled = 0;
  const started = Date.now();
  await assert.rejects(
    runProbe({
      request,
      ledgerPath,
      transport: {
        async send() {},
        async read() { return new Promise(() => {}); },
        async cancel() { cancelled += 1; }
      },
      evidence: syntheticEvidence()
    }),
    error => error instanceof ProbeError && error.code === 'READ_TIMEOUT'
  );
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 500, `預期 500ms 內結束，實際 ${elapsed}ms`);
  assert.equal(cancelled, 1);
  const ledger = fs.readFileSync(ledgerPath, 'utf8');
  assert.match(ledger, /"type":"FAILED"/);
  assert.match(ledger, /"code":"READ_TIMEOUT"/);
});

test('send 拋錯時寫入 FAILED 終態', async () => {
  const ledgerPath = tempLedger();
  const request = createProbeRequest({ now: Date.now(), ttlMs: 2000 });
  await assert.rejects(
    runProbe({
      request,
      ledgerPath,
      transport: {
        async send() { throw new Error('send exploded'); },
        async read() { return null; }
      },
      evidence: syntheticEvidence()
    }),
    /send exploded/
  );
  const ledger = fs.readFileSync(ledgerPath, 'utf8');
  assert.match(ledger, /"type":"FAILED"/);
  assert.match(ledger, /"phase":"SEND"/);
});

test('read 拋錯時寫入 FAILED 終態', async () => {
  const ledgerPath = tempLedger();
  const request = createProbeRequest({ now: Date.now(), ttlMs: 2000 });
  await assert.rejects(
    runProbe({
      request,
      ledgerPath,
      transport: {
        async send() {},
        async read() { throw new Error('read exploded'); }
      },
      evidence: syntheticEvidence()
    }),
    /read exploded/
  );
  const ledger = fs.readFileSync(ledgerPath, 'utf8');
  assert.match(ledger, /"type":"FAILED"/);
  assert.match(ledger, /"phase":"READ"/);
});

test('相同 probeId 不得重複送出', async () => {
  const ledgerPath = tempLedger();
  const request = createProbeRequest({ now: Date.now(), ttlMs: 2000 });
  let sends = 0;
  const transport = {
    async send() { sends += 1; },
    async read() { return createProbeResponse(request); }
  };
  await runProbe({ request, ledgerPath, transport, evidence: syntheticEvidence() });
  await assert.rejects(
    runProbe({ request, ledgerPath, transport, evidence: syntheticEvidence() }),
    error => error instanceof ProbeError && error.code === 'PROBE_REPLAY'
  );
  assert.equal(sends, 1);
});

test('ledger 不保存允許欄位內的原始秘密標記', async () => {
  const ledgerPath = tempLedger();
  const request = createProbeRequest({ now: Date.now(), ttlMs: 2000 });
  const marker = 'CANARY_ONLY_NOT_A_REAL_SECRET';
  const result = await runProbe({
    request,
    ledgerPath,
    transport: {
      async send() {},
      async read() { return createProbeResponse(request); }
    },
    evidence: nativeEvidence({ sessionFingerprint: marker })
  });
  assert.equal(result.verification.result, 'FAIL');
  const ledger = fs.readFileSync(ledgerPath, 'utf8');
  assert.equal(ledger.includes(marker), false);
});

test('synthetic round trip 只會 protocolVerified，不會 nativeVerified', async () => {
  const ledgerPath = tempLedger();
  const request = createProbeRequest({ now: Date.now(), ttlMs: 2000 });
  const result = await runProbe({
    request,
    ledgerPath,
    transport: {
      async send() {},
      async read() { return createProbeResponse(request); }
    },
    evidence: syntheticEvidence()
  });
  assert.equal(result.verification.result, 'PASS');
  assert.equal(result.verification.protocolVerified, true);
  assert.equal(result.verification.nativeVerified, false);
  const ledger = fs.readFileSync(ledgerPath, 'utf8');
  assert.match(ledger, /"type":"PROTOCOL_VERIFIED"/);
  assert.equal(ledger.includes('NATIVE_VERIFIED'), false);
});

test('synthetic CLI 成功條件同時要求 protocol PASS 與 native false', () => {
  assert.equal(exitCodeForSynthetic({ verification: { result: 'PASS', protocolVerified: true, nativeVerified: false } }), 0);
  assert.equal(exitCodeForSynthetic({ verification: { result: 'FAIL', protocolVerified: false, nativeVerified: false } }), 1);
  assert.equal(exitCodeForSynthetic({ verification: { result: 'PASS', protocolVerified: true, nativeVerified: true } }), 1);
});

test('未知 CLI 指令回傳 exit code 2', () => {
  const cli = path.join(__dirname, 'pixiu-chat-probe.js');
  const result = spawnSync(process.execPath, [cli, 'unknown-command'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /Pixiu Chat Bridge probe CLI/);
});

test('live verify CLI 不接受輸入 now 回溯過期資料', () => {
  const cli = path.join(__dirname, 'pixiu-chat-probe.js');
  const now = Date.now();
  const request = createProbeRequest({ now: now - 5000, ttlMs: 1000 });
  const input = JSON.stringify({
    request,
    response: createProbeResponse(request, { now: now - 4500 }),
    evidence: syntheticEvidence(),
    now: now - 4500
  });
  const result = spawnSync(process.execPath, [cli, 'verify'], { input, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /超過 probe 有效期限/);
});

test('library verify 不接受 caller 傳入 now 回溯時間', () => {
  const now = Date.now();
  const request = createProbeRequest({ now: now - 5000, ttlMs: 1000 });
  const response = createProbeResponse(request, { now: now - 4500 });
  const result = verifyProbe(request, response, syntheticEvidence(), { now: now - 4500 });
  assert.equal(result.result, 'FAIL');
  assert.match(result.reasons.join('\n'), /超過 probe 有效期限/);
});

test('respondedAt 不得早於建立時間或晚於有效期限', () => {
  const now = Date.now();
  const request = createProbeRequest({ now, ttlMs: 5000 });
  const early = createProbeResponse(request, { now: now - 1 });
  const late = createProbeResponse(request, { now: now + 5000 });
  assert.match(verifyProbe(request, early, nativeEvidence()).reasons.join('\n'), /早於 request.createdAt/);
  assert.match(verifyProbe(request, late, nativeEvidence()).reasons.join('\n'), /respondedAt 超過 probe 有效期限/);
});

test('cancel 永不回覆也不能讓 timeout 卡死', async () => {
  const ledgerPath = tempLedger();
  const request = createProbeRequest({ now: Date.now(), ttlMs: 60 });
  const started = Date.now();
  await assert.rejects(
    runProbe({
      request,
      ledgerPath,
      transport: {
        async send() {},
        async read() { return new Promise(() => {}); },
        async cancel() { return new Promise(() => {}); }
      },
      evidence: syntheticEvidence()
    }),
    error => error instanceof ProbeError && error.code === 'READ_TIMEOUT'
  );
  assert.ok(Date.now() - started < 500);
});

test('adapter 錯誤訊息內的 token 不得寫入 ledger', async () => {
  const ledgerPath = tempLedger();
  const request = createProbeRequest({ now: Date.now(), ttlMs: 2000 });
  const marker = 'CANARY_SECRET_123';
  await assert.rejects(
    runProbe({
      request,
      ledgerPath,
      transport: {
        async send() { throw new Error(`authorization=Bearer ${marker} token=${marker}`); },
        async read() { return null; }
      },
      evidence: syntheticEvidence()
    })
  );
  const ledger = fs.readFileSync(ledgerPath, 'utf8');
  assert.equal(ledger.includes(marker), false);
  assert.match(ledger, /REDACTED/);
});

test('過長 transport 值不得進入 ledger evidence', async () => {
  const ledgerPath = tempLedger();
  const request = createProbeRequest({ now: Date.now(), ttlMs: 2000 });
  const marker = `CANARY_${'x'.repeat(100)}`;
  const result = await runProbe({
    request,
    ledgerPath,
    transport: {
      async send() {},
      async read() { return createProbeResponse(request); }
    },
    evidence: syntheticEvidence({ transport: marker })
  });
  assert.equal(result.verification.result, 'FAIL');
  const ledger = fs.readFileSync(ledgerPath, 'utf8');
  assert.equal(ledger.includes(marker), false);
});
