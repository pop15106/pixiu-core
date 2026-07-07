#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const MAX_MESSAGE = 12000;

const HOOKS = {
  'pre:bash:auto-tmux-dev': { script: 'scripts/hooks/auto-tmux-dev.js' },
  'pre:bash:tmux-reminder': { script: 'scripts/hooks/pre-bash-tmux-reminder.js', profiles: 'strict' },
  'pre:bash:git-push-reminder': { script: 'scripts/hooks/pre-bash-git-push-reminder.js', profiles: 'strict' },
  'pre:write:doc-file-warning': { script: 'scripts/hooks/doc-file-warning.js', profiles: 'standard,strict' },
  'pre:edit-write:suggest-compact': { script: 'scripts/hooks/suggest-compact.js', profiles: 'standard,strict' },
  'pre:insaits-security': { script: 'scripts/hooks/insaits-security-wrapper.js', profiles: 'standard,strict' },
  'pre:pixiu:change-scope': { script: 'scripts/hooks/pixiu-guardrails.js', args: ['pre:pixiu:change-scope'] },
  'pre:pixiu:auto-mode-guard': { script: 'scripts/hooks/pixiu-guardrails.js', args: ['pre:pixiu:auto-mode-guard'] },
  'pre:compact': { script: 'scripts/hooks/pre-compact.js', profiles: 'standard,strict' },
  'session:start': { script: 'scripts/hooks/session-start.js', profiles: 'minimal,standard,strict' },
  'post:bash:pr-created': { script: 'scripts/hooks/post-bash-pr-created.js', profiles: 'standard,strict' },
  'post:bash:build-complete': { script: 'scripts/hooks/post-bash-build-complete.js', profiles: 'standard,strict' },
  'post:quality-gate': { script: 'scripts/hooks/quality-gate.js', profiles: 'standard,strict' },
  'post:edit:format': { script: 'scripts/hooks/post-edit-format.js', profiles: 'standard,strict' },
  'post:edit:typecheck': { script: 'scripts/hooks/post-edit-typecheck.js', profiles: 'standard,strict' },
  'post:edit:console-warn': { script: 'scripts/hooks/post-edit-console-warn.js', profiles: 'standard,strict' },
  'post:pixiu:secret-scan': { script: 'scripts/hooks/pixiu-guardrails.js', args: ['post:pixiu:secret-scan'] },
  'stop:check-console-log': { script: 'scripts/hooks/check-console-log.js', profiles: 'standard,strict' },
  'stop:session-end': { script: 'scripts/hooks/session-end.js', profiles: 'minimal,standard,strict' },
  'stop:pixiu:auto-recap': { script: 'scripts/hooks/pixiu-auto-recap.js', profiles: 'minimal,standard,strict' },
  'stop:evaluate-session': { script: 'scripts/hooks/evaluate-session.js', profiles: 'minimal,standard,strict' },
  'stop:cost-tracker': { script: 'scripts/hooks/cost-tracker.js', profiles: 'minimal,standard,strict' },
  'stop:pixiu:mothership-sync': { script: 'scripts/hooks/pixiu-guardrails.js', args: ['stop:pixiu:mothership-sync'] }
};

function resolvePixiuCore() {
  return process.env.PIXIU_CORE ||
    process.env.PIXIU_CORE_PATH ||
    path.join(process.env.USERPROFILE || process.env.HOME || '.', '.pixiu-core');
}

function readStdin(callback) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) {
      const remaining = MAX_STDIN - raw.length;
      raw += chunk.substring(0, remaining);
    }
  });
  process.stdin.on('end', () => callback(raw));
  process.stdin.on('error', () => callback(raw));
}

function isHookEnabled(corePath, hookId, profiles) {
  if (!profiles) return true;

  const flagsPath = path.join(corePath, 'scripts', 'lib', 'hook-flags.js');
  if (fs.existsSync(flagsPath)) {
    try {
      const flags = require(flagsPath);
      if (flags && typeof flags.isHookEnabled === 'function') {
        return flags.isHookEnabled(hookId, { profiles });
      }
    } catch {
      // Fall back to local profile parsing below.
    }
  }

  const disabled = new Set(String(process.env.ECC_DISABLED_HOOKS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean));
  if (disabled.has(String(hookId || '').toLowerCase())) return false;

  const currentProfile = String(process.env.ECC_HOOK_PROFILE || 'standard').toLowerCase().trim();
  return profiles
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(currentProfile);
}

function resolveScript(corePath, relScriptPath) {
  const root = path.resolve(corePath);
  const scriptPath = path.resolve(corePath, relScriptPath);
  if (!scriptPath.startsWith(root + path.sep)) {
    return null;
  }
  return scriptPath;
}

function runHook(rawInput, hookId, corePath) {
  const config = HOOKS[hookId];
  if (!config) {
    return {
      status: 0,
      stdout: '',
      stderr: `[pixiu-codex-bridge] Unknown hook id: ${hookId}\n`
    };
  }

  if (!isHookEnabled(corePath, hookId, config.profiles)) {
    return { status: 0, stdout: '', stderr: '' };
  }

  const scriptPath = resolveScript(corePath, config.script);
  if (!scriptPath || !fs.existsSync(scriptPath)) {
    return {
      status: 0,
      stdout: '',
      stderr: `[pixiu-codex-bridge] Hook script not found: ${config.script}\n`
    };
  }

  const env = {
    ...process.env,
    CLAUDE_PLUGIN_ROOT: corePath,
    PIXIU_CORE: corePath,
    PIXIU_CORE_PATH: corePath
  };
  const cwd = extractCwd(rawInput) || process.cwd();
  const args = [scriptPath, ...(config.args || [])];

  if (canRunInProcess(scriptPath)) {
    return runExportedHook(scriptPath, rawInput, corePath);
  }

  const result = childProcess.spawnSync(process.execPath, args, {
    input: rawInput,
    encoding: 'utf8',
    env,
    cwd,
    timeout: 30000
  });

  return {
    status: Number.isInteger(result.status) ? result.status : 0,
    stdout: result.stdout || '',
    stderr: result.stderr || result.error?.message || ''
  };
}

function canRunInProcess(scriptPath) {
  try {
    const src = fs.readFileSync(scriptPath, 'utf8');
    return /\bmodule\.exports\b/.test(src) && /\brun\b/.test(src);
  } catch {
    return false;
  }
}

function runExportedHook(scriptPath, rawInput, corePath) {
  let capturedStdout = '';
  let capturedStderr = '';
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;

  try {
    process.stdout.write = function writeStdout(chunk, encoding, cb) {
      capturedStdout += String(chunk);
      if (typeof cb === 'function') cb();
      return true;
    };
    process.stderr.write = function writeStderr(chunk, encoding, cb) {
      capturedStderr += String(chunk);
      if (typeof cb === 'function') cb();
      return true;
    };

    const hook = require(scriptPath);
    if (!hook || typeof hook.run !== 'function') {
      return {
        status: 0,
        stdout: '',
        stderr: `[pixiu-codex-bridge] Hook has no run(rawInput) export: ${scriptPath}\n`
      };
    }

    const output = hook.run(rawInput || '', { corePath });
    if (output !== null && output !== undefined) capturedStdout += String(output);
    return { status: 0, stdout: capturedStdout, stderr: capturedStderr };
  } catch (err) {
    return { status: 0, stdout: capturedStdout, stderr: `${capturedStderr}${err.message}\n` };
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
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

function emitCodexResult(result, rawInput) {
  if (result.status === 2) {
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(2);
  }

  if (result.status && result.status !== 0) {
    const message = compactMessage(result.stderr || `Hook exited with status ${result.status}`);
    if (message) {
      process.stdout.write(JSON.stringify({ systemMessage: message }));
    }
    process.exit(0);
  }

  const stdout = String(result.stdout || '');
  const stderr = String(result.stderr || '');
  const meaningfulStdout = stdout.trim() && stdout !== rawInput ? stdout : '';
  const message = compactMessage([stderr, meaningfulStdout].filter(Boolean).join('\n').trim());
  if (message) {
    process.stdout.write(JSON.stringify({ systemMessage: message }));
  }
  process.exit(0);
}

function compactMessage(message) {
  const text = String(message || '').trim();
  if (!text) return '';
  if (text.length <= MAX_MESSAGE) return text;
  return `${text.slice(0, MAX_MESSAGE)}\n[pixiu-codex-bridge] output truncated`;
}

function runThreadWatcherFallback(rawInput, hookId, corePath) {
  if (hookId !== 'stop:pixiu:auto-recap') {
    return { stderr: '' };
  }

  try {
    const watcher = require('./pixiu-thread-watcher');
    watcher.run(rawInput || '', { corePath, mode: 'all' });
    return { stderr: '' };
  } catch (err) {
    return {
      stderr: `[pixiu-codex-bridge] Thread watcher fallback failed: ${err.message}\n`
    };
  }
}

function main() {
  const hookId = process.argv[2] || '';
  const corePath = resolvePixiuCore();
  process.env.CLAUDE_PLUGIN_ROOT = corePath;
  process.env.PIXIU_CORE = corePath;
  process.env.PIXIU_CORE_PATH = corePath;

  readStdin(rawInput => {
    const result = runHook(rawInput, hookId, corePath);
    const fallback = runThreadWatcherFallback(rawInput, hookId, corePath);
    if (fallback.stderr) result.stderr = `${result.stderr || ''}${fallback.stderr}`;
    emitCodexResult(result, rawInput);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  HOOKS,
  resolvePixiuCore,
  runHook,
  runThreadWatcherFallback,
  emitCodexResult
};
