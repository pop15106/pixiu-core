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

const MAX_STDIN_BYTES = 64 * 1024;

function parseArgs(argv) {
  const out = { command: argv[0] || 'help' };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      throw new Error(`不支援的參數：${arg}`);
    }
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

function readStdin(maxBytes = MAX_STDIN_BYTES) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytes = 0;
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      bytes += Buffer.byteLength(chunk, 'utf8');
      if (bytes > maxBytes) {
        reject(new Error(`stdin 超過 ${maxBytes} bytes`));
        process.stdin.pause();
        return;
      }
      raw += chunk;
    });
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', reject);
  });
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function exitCodeForSynthetic(result) {
  return result?.verification?.result === 'PASS' &&
    result?.verification?.protocolVerified === true &&
    result?.verification?.nativeVerified === false
    ? 0
    : 1;
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
    input.evidence
  );

  printJson({
    ...result,
    note: result.protocolVerified && !result.nativeVerified
      ? 'CLI verify 只能驗證 protocol evidence；目前沒有受信任 native adapter，因此 nativeVerified 固定為 false。'
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
  process.exitCode = exitCodeForSynthetic(result);
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
    '注意：正式 verify 使用目前系統時間，不接受輸入覆寫 now。',
    '目前沒有可核對收發收據的受信任 native adapter，所以 nativeVerified 固定為 false。',
    ''
  ].join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === 'create') return createCommand(args);
  if (args.command === 'verify') return verifyCommand(args);
  if (args.command === 'synthetic') return syntheticCommand(args);
  if (args.command === 'help' || args.command === '--help' || args.command === '-h') return help();

  help();
  process.exitCode = 2;
}

if (require.main === module) {
  main().catch(err => {
    process.stderr.write(`[pixiu-chat-probe] ${err.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  MAX_STDIN_BYTES,
  createCommand,
  exitCodeForSynthetic,
  parseArgs,
  readStdin,
  syntheticCommand,
  verifyCommand
};
