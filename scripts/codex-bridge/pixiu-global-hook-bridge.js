#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const bridge = require('./pixiu-mothership-hook-bridge');
const watcher = require('./pixiu-thread-watcher');

const MAX_STDIN = 1024 * 1024;
const WATCHER_MODES = new Set([
  'pre:observe',
  'post:observe',
  'session:end:marker',
  'session:end:pixiu:auto-recap'
]);

function resolvePixiuCore() {
  return process.env.PIXIU_CORE ||
    process.env.PIXIU_CORE_PATH ||
    path.join(process.env.USERPROFILE || process.env.HOME || '.', '.pixiu-core');
}

function isWatcherMode(hookId) {
  return WATCHER_MODES.has(String(hookId || ''));
}

function shouldSkipForProjectLocalPixiuHooks(cwd) {
  let current = path.resolve(cwd || process.cwd());
  const userHooks = path.join(process.env.USERPROFILE || process.env.HOME || '.', '.codex', 'hooks.json').toLowerCase();

  while (true) {
    const candidate = path.join(current, '.codex', 'hooks.json');
    if (candidate.toLowerCase() !== userHooks && fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, 'utf8');
      if (content.includes('pixiu-mothership-hook-bridge.js') || content.includes('pixiu-thread-watcher.js')) {
        return true;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

function extractCwd(rawInput) {
  try {
    const input = JSON.parse(rawInput || '{}');
    return typeof input.cwd === 'string' && input.cwd ? input.cwd : '';
  } catch {
    return '';
  }
}

function emitWatcherResult(output, rawInput) {
  const meaningful = String(output || '').trim() && output !== rawInput ? output : '';
  if (meaningful) {
    process.stdout.write(JSON.stringify({ systemMessage: String(meaningful).slice(0, 12000) }));
  }
  process.exit(0);
}

function run(rawInput, hookId, options = {}) {
  if (shouldSkipForProjectLocalPixiuHooks(extractCwd(rawInput))) {
    return { skipped: true, output: '' };
  }

  const corePath = resolvePixiuCore();
  process.env.CLAUDE_PLUGIN_ROOT = corePath;
  process.env.PIXIU_CORE = corePath;
  process.env.PIXIU_CORE_PATH = corePath;

  if (isWatcherMode(hookId)) {
    return {
      skipped: false,
      output: watcher.run(rawInput || '', { corePath, mode: hookId, ...options })
    };
  }

  return {
    skipped: false,
    result: bridge.runHook(rawInput || '', hookId, corePath)
  };
}

function main() {
  const hookId = process.argv[2] || '';
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) {
      raw += chunk.substring(0, MAX_STDIN - raw.length);
    }
  });
  process.stdin.on('end', () => {
    try {
      const result = run(raw, hookId);
      if (result.skipped) process.exit(0);
      if (Object.prototype.hasOwnProperty.call(result, 'output')) {
        emitWatcherResult(result.output, raw);
      }
      bridge.emitCodexResult(result.result, raw);
    } catch (err) {
      process.stdout.write(JSON.stringify({ systemMessage: `[pixiu-global-hook-bridge] ${err.message}` }));
      process.exit(0);
    }
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  isWatcherMode,
  shouldSkipForProjectLocalPixiuHooks,
  run
};
