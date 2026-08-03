#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

class WorktreeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'WorktreeError';
    this.code = code;
  }
}

function defaultManagedRoot() {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || process.cwd(), 'AppData', 'Local');
  return path.join(localAppData, 'PixiuCore', 'workflow-lab', 'worktrees');
}

function defaultGitRunner(args) {
  return new Promise((resolve) => {
    const child = spawn('git', args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.once('error', (error) => resolve({ status: 1, stdout, stderr: error.message }));
    child.once('close', (code) => resolve({
      status: Number.isInteger(code) ? code : 1,
      stdout,
      stderr
    }));
  });
}

function samePath(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === 'win32'
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
}

function createWorktreeManager(options = {}) {
  const managedRoot = path.resolve(options.managedRoot || defaultManagedRoot());
  const gitRunner = options.gitRunner || defaultGitRunner;

  async function create(input = {}) {
    const { sourcePath, runId, baseRef = 'HEAD' } = input;
    if (typeof sourcePath !== 'string' || !sourcePath.trim()) {
      throw new WorktreeError('WORKTREE_SOURCE_REQUIRED', 'Worktree sourcePath 不可為空');
    }
    if (typeof runId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(runId)) {
      throw new WorktreeError('INVALID_WORKTREE_RUN_ID', 'runId 只能包含英數字與連字號');
    }
    const resolvedSource = path.resolve(sourcePath);
    const targetPath = path.join(managedRoot, runId);
    if (samePath(resolvedSource, targetPath)) {
      throw new WorktreeError('WORKTREE_EQUALS_SOURCE', 'Worktree 不可等於來源 checkout');
    }
    if (fs.existsSync(targetPath)) {
      throw new WorktreeError('WORKTREE_ALREADY_EXISTS', `Worktree 目標已存在：${targetPath}`);
    }
    fs.mkdirSync(managedRoot, { recursive: true });

    const createResult = await gitRunner([
      '-C',
      resolvedSource,
      'worktree',
      'add',
      '--detach',
      targetPath,
      baseRef
    ]);
    if (createResult.status !== 0) {
      throw new WorktreeError(
        'WORKTREE_CREATE_FAILED',
        `建立 Worktree 失敗：${createResult.stderr || createResult.stdout}`
      );
    }

    const headResult = await gitRunner(['-C', targetPath, 'rev-parse', 'HEAD']);
    if (headResult.status !== 0) {
      throw new WorktreeError(
        'WORKTREE_VERIFY_FAILED',
        `Worktree 建立後無法驗證 HEAD：${headResult.stderr || headResult.stdout}`
      );
    }

    return Object.freeze({
      sourcePath: resolvedSource,
      path: targetPath,
      baseRef,
      baseSha: headResult.stdout.trim(),
      retained: true
    });
  }

  return Object.freeze({
    create,
    managedRoot
  });
}

module.exports = {
  WorktreeError,
  createWorktreeManager
};
