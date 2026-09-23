#!/usr/bin/env node
'use strict';

const {
  buildChatPrompt,
  createProbeRequest,
  createProbeResponse,
  defaultLedgerPath,
  runProbe,
  verifyProbe
} = require('./pixiu-chat-bridge');

function parseArgs(argv) {
  const out = { command: argv[0] || 'help' };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      raw += chunk;
    });
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', reject);
  });
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

async function createCommand(args) {
  const request = createProbeRequest({
    probeId: args['probe-id'],
    ttlMs: args['ttl-ms'] ? Number(args['ttl-ms']) : undefined,
    message: args.message
  });

  printJson({
    request,
    prompt: buildChatPrompt(request),
    next: '將 prompt 交給 native transport；不要以人工 copy/paste 當作 native 驗收。'
  });
}

async function verifyCommand() {
  const raw = await readStdin();
  if (!raw.trim()) throw new Error('verify 需要從 stdin 傳入 JSON');

  const input = JSON.parse(raw);
  const result = verifyProbe(
    input.request,
    input.response,
    input.evidence,
    { now: input.now }
  );

  printJson({
    ...result,
    note: result.protocolVerified && !result.nativeVerified
      ? 'CLI verify 只能驗證 protocol evidence；nativeVerified 必須由受信任 runtime adapter attestation 產生。'
      : undefined
  });
  process.exitCode = result.result === 'PASS' ? 0 : 1;
}

async function syntheticCommand(args) {
  let captured = null;
  const ledgerPath = args.ledger || defaultLedgerPath();

  const transport = {
    async send(_prompt, request) {
      captured = request;
    },
    async read() {
      return createProbeResponse(captured);
    }
  };

  const result = await runProbe({
    transport,
    request: createProbeRequest({
      probeId: args['probe-id'],
      ttlMs: args['ttl-ms'] ? Number(args['ttl-ms']) : undefined
    }),
    evidence: {
      transport: 'synthetic',
      authMode: 'synthetic',
      apiKeyUsed: false,
      manualCopy: false,
      readBack: true
    },
    ledgerPath
  });

  printJson({
    ...result,
    ledgerPath,
    note: 'synthetic PASS 只代表協議與 correlation gate 正常，不代表 Codex App native bridge 已驗收。'
  });
}

function help() {
  process.stdout.write([
    'Pixiu Chat Bridge probe CLI',
    '',
    '用法：',
    '  node scripts/codex-bridge/pixiu-chat-probe.js create [--probe-id ID] [--ttl-ms 120000]',
    '  node scripts/codex-bridge/pixiu-chat-probe.js verify < verification-input.json',
    '  node scripts/codex-bridge/pixiu-chat-probe.js synthetic [--ledger PATH]',
    '',
    'verify stdin 格式：',
    JSON.stringify({
      request: {},
      response: {},
      evidence: {
        transport: 'chatgpt-desktop-native',
        authMode: 'chatgpt-session',
        apiKeyUsed: false,
        manualCopy: false,
        readBack: true
      }
    }, null, 2),
    '',
    '注意：verify 指令不接受 native attestation。',
    '真正的 nativeVerified 只能由 Codex App 的受信任 runtime adapter 在程式內呼叫 verifyProbe/runProbe 時提供。',
    ''
  ].join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === 'create') return createCommand(args);
  if (args.command === 'verify') return verifyCommand(args);
  if (args.command === 'synthetic') return syntheticCommand(args);
  return help();
}

if (require.main === module) {
  main().catch(err => {
    process.stderr.write(`[pixiu-chat-probe] ${err.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  createCommand,
  parseArgs,
  syntheticCommand,
  verifyCommand
};
