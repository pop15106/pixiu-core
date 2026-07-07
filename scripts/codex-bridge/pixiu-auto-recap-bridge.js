#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const CODEX_OK = JSON.stringify({ continue: true, suppressOutput: true });

function resolvePixiuCore() {
  return process.env.PIXIU_CORE ||
    process.env.PIXIU_CORE_PATH ||
    path.join(process.env.USERPROFILE || process.env.HOME || '.', '.pixiu-core');
}

function run(rawInput) {
  const corePath = resolvePixiuCore();
  const hookPath = path.join(corePath, 'scripts', 'hooks', 'pixiu-auto-recap.js');

  process.env.PIXIU_CORE = corePath;
  process.env.PIXIU_CORE_PATH = corePath;

  if (!fs.existsSync(hookPath)) {
    process.stderr.write(`[pixiu-codex-bridge] Pixiu auto recap hook not found: ${hookPath}\n`);
    return CODEX_OK;
  }

  try {
    const hook = require(hookPath);
    if (!hook || typeof hook.run !== 'function') {
      process.stderr.write(`[pixiu-codex-bridge] Pixiu auto recap hook has no run(rawInput) export: ${hookPath}\n`);
      return CODEX_OK;
    }

    hook.run(rawInput || '', { corePath });
  } catch (err) {
    process.stderr.write(`[pixiu-codex-bridge] ${err.message}\n`);
  }

  return CODEX_OK;
}

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) {
      const remaining = MAX_STDIN - raw.length;
      raw += chunk.substring(0, remaining);
    }
  });
  process.stdin.on('end', () => {
    process.stdout.write(run(raw));
  });
  process.stdin.on('error', () => {
    process.stdout.write(CODEX_OK);
  });
}

module.exports = { run, resolvePixiuCore };
