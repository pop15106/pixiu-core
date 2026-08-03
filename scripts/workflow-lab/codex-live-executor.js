#!/usr/bin/env node
'use strict';

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

class LiveExecutionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LiveExecutionError';
    this.code = code;
  }
}

function normalizeCodexCommand(command) {
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    throw new TypeError('codexCommand 必須是物件');
  }
  if (typeof command.executable !== 'string' || !command.executable.trim()) {
    throw new TypeError('codexCommand.executable 不可為空');
  }
  const argsPrefix = command.argsPrefix === undefined ? [] : command.argsPrefix;
  if (!Array.isArray(argsPrefix) || argsPrefix.some((argument) => typeof argument !== 'string')) {
    throw new TypeError('codexCommand.argsPrefix 必須是字串陣列');
  }
  return Object.freeze({
    executable: command.executable.trim(),
    argsPrefix: Object.freeze([...argsPrefix])
  });
}

function resolveCodexCommand(options = {}) {
  const platform = options.platform || process.platform;
  const environment = options.env || process.env;
  const existsSync = options.existsSync || fs.existsSync;
  const nodeExecutable = options.nodeExecutable || process.execPath;

  if (options.codexCommand) {
    return normalizeCodexCommand(options.codexCommand);
  }

  if (platform === 'win32') {
    const candidates = [];
    if (environment.APPDATA) {
      candidates.push(path.join(
        environment.APPDATA,
        'npm',
        'node_modules',
        '@openai',
        'codex',
        'bin',
        'codex.js'
      ));
    }
    if (environment.npm_config_prefix) {
      candidates.push(path.join(
        environment.npm_config_prefix,
        'node_modules',
        '@openai',
        'codex',
        'bin',
        'codex.js'
      ));
    }
    const codexJsPath = candidates.find((candidate) => existsSync(candidate));
    if (codexJsPath) {
      return normalizeCodexCommand({
        executable: nodeExecutable,
        argsPrefix: [codexJsPath]
      });
    }
  }

  return normalizeCodexCommand({ executable: 'codex', argsPrefix: [] });
}

function defaultCommandProbe(command) {
  const result = spawnSync(command.executable, [...command.argsPrefix, '--version'], {
    encoding: 'utf8',
    shell: false,
    windowsHide: true
  });
  return result.status === 0;
}

function parseResult(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw new LiveExecutionError('LIVE_OUTPUT_INVALID', 'Codex 沒有回傳結果');
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        parsed = JSON.parse(lines[index]);
        break;
      } catch {
        // 繼續尋找最後一個有效 JSON 行。
      }
    }
  }
  if (!parsed || !['GREEN', 'RED'].includes(parsed.status)) {
    throw new LiveExecutionError('LIVE_OUTPUT_INVALID', 'Codex 回傳內容不符合角色結果 Schema');
  }
  let artifact = null;
  if (parsed.artifact !== null && parsed.artifact !== undefined) {
    if (!parsed.artifact || typeof parsed.artifact !== 'object'
      || typeof parsed.artifact.type !== 'string'
      || typeof parsed.artifact.valueJson !== 'string') {
      throw new LiveExecutionError('LIVE_OUTPUT_INVALID', 'Codex Artifact 格式不正確');
    }
    let value;
    try {
      value = JSON.parse(parsed.artifact.valueJson);
    } catch {
      throw new LiveExecutionError('LIVE_OUTPUT_INVALID', 'Codex Artifact valueJson 不是有效 JSON');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new LiveExecutionError('LIVE_OUTPUT_INVALID', 'Codex Artifact valueJson 必須是 JSON 物件');
    }
    artifact = {
      type: parsed.artifact.type,
      value
    };
  }
  return {
    moduleId: null,
    status: parsed.status,
    artifact,
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence.map(String) : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
    exposureReport: { sensitiveMatches: [], canaryLeaks: [] },
    recommendedModuleId: parsed.recommendedModuleId || null,
    reason: parsed.reason || null
  };
}

function buildPrompt(moduleId, taskPackage) {
  return [
    '你正在執行 PixiuCore Workflow Lab 的獨立 Fresh Session。',
    `角色模組：${moduleId}`,
    '只使用下方 RoleTaskPackage，不得推測或讀取其他角色 Session。',
    '禁止 Git Push、Merge、Deploy、DB 寫入、刪除來源專案檔案與依賴變更。',
    'PG 只能修改目前提供的隔離 Worktree；其他角色維持唯讀。',
    '依 output schema 回傳單一 JSON 物件，不輸出 Markdown code fence。',
    'artifact.valueJson 必須是將角色 Artifact 物件序列化後的 JSON 字串。',
    '',
    'RoleTaskPackage:',
    JSON.stringify(taskPackage)
  ].join('\n');
}

function createCodexLiveExecutor(options = {}) {
  const spawnProcess = options.spawn || spawn;
  const commandProbe = options.commandProbe || defaultCommandProbe;
  const codexCommand = resolveCodexCommand({
    codexCommand: options.codexCommand,
    platform: options.platform,
    env: options.env,
    existsSync: options.existsSync,
    nodeExecutable: options.nodeExecutable
  });
  const schemaPath = path.resolve(
    options.schemaPath || path.join(__dirname, 'schemas', 'role-result.schema.json')
  );
  const now = options.now || (() => new Date().toISOString());

  function isAvailable() {
    return Boolean(commandProbe(codexCommand)) && fs.existsSync(schemaPath);
  }

  async function execute(input = {}) {
    const {
      moduleId,
      taskPackage,
      project = {},
      worktree,
      onOutput = () => {},
      signal
    } = input;
    if (!isAvailable()) {
      throw new LiveExecutionError('LIVE_EXECUTOR_UNAVAILABLE', '找不到可用的 Codex CLI 或輸出 Schema');
    }
    if (typeof moduleId !== 'string' || !moduleId) {
      throw new LiveExecutionError('LIVE_MODULE_REQUIRED', 'moduleId 不可為空');
    }
    if (!taskPackage || typeof taskPackage !== 'object') {
      throw new LiveExecutionError('LIVE_TASK_PACKAGE_REQUIRED', 'RoleTaskPackage 不可為空');
    }

    let sandbox = 'read-only';
    let cwd = project.sourcePath || project.path;
    if (moduleId === 'pg') {
      if (!worktree || typeof worktree.path !== 'string' || !worktree.path) {
        throw new LiveExecutionError('PG_WORKTREE_REQUIRED', 'Live PG 必須使用隔離 Worktree');
      }
      sandbox = 'workspace-write';
      cwd = worktree.path;
    } else if (moduleId === 'qa' && worktree?.path) {
      cwd = worktree.path;
    }
    if (typeof cwd !== 'string' || !cwd) {
      throw new LiveExecutionError('LIVE_PROJECT_REQUIRED', 'Live Session 缺少專案工作目錄');
    }

    const args = [
      'exec',
      '--ephemeral',
      '--color',
      'never',
      '--output-schema',
      schemaPath,
      '--sandbox',
      sandbox,
      '-C',
      cwd,
      '-'
    ];
    const prompt = buildPrompt(moduleId, taskPackage);
    const startedAt = now();

    return new Promise((resolve, reject) => {
      let settled = false;
      let stdout = '';
      let stderr = '';
      let abortHandler = null;
      let child;

      function finishError(error) {
        if (settled) {
          return;
        }
        settled = true;
        if (signal && abortHandler) {
          signal.removeEventListener('abort', abortHandler);
        }
        reject(error);
      }

      try {
        child = spawnProcess(codexCommand.executable, [...codexCommand.argsPrefix, ...args], {
          cwd,
          env: process.env,
          shell: false,
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } catch (error) {
        finishError(new LiveExecutionError('LIVE_EXECUTION_FAILED', `無法啟動 Codex：${error.message}`));
        return;
      }

      child.stdout.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        stdout += text;
        onOutput(text);
      });
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        stderr += text;
        onOutput(text);
      });
      child.once('error', (error) => {
        finishError(new LiveExecutionError('LIVE_EXECUTION_FAILED', `Codex 執行錯誤：${error.message}`));
      });
      child.once('close', (code, closeSignal) => {
        if (settled) {
          return;
        }
        if (signal && abortHandler) {
          signal.removeEventListener('abort', abortHandler);
        }
        if (code !== 0) {
          finishError(new LiveExecutionError(
            'LIVE_EXECUTION_FAILED',
            `Codex exit ${code ?? 'null'}${closeSignal ? ` (${closeSignal})` : ''}：${stderr.trim()}`
          ));
          return;
        }
        try {
          const result = parseResult(stdout);
          result.moduleId = moduleId;
          result.startedAt = startedAt;
          result.finishedAt = now();
          settled = true;
          resolve(result);
        } catch (error) {
          finishError(error);
        }
      });

      if (signal) {
        abortHandler = () => {
          if (!settled) {
            child.kill('SIGTERM');
            finishError(new LiveExecutionError('LIVE_EXECUTION_CANCELLED', 'Live Session 已取消'));
          }
        };
        signal.addEventListener('abort', abortHandler, { once: true });
        if (signal.aborted) {
          abortHandler();
          return;
        }
      }

      child.stdin.end(prompt, 'utf8');
    });
  }

  return Object.freeze({
    codexCommand,
    execute,
    isAvailable,
    schemaPath
  });
}

module.exports = {
  LiveExecutionError,
  buildPrompt,
  createCodexLiveExecutor,
  resolveCodexCommand
};
