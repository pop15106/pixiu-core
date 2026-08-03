#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

class ProjectValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProjectValidationError';
    this.code = code;
  }
}

function defaultGitRunner(args) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    windowsHide: true,
    shell: false
  });
  return {
    status: Number.isInteger(result.status) ? result.status : 1,
    stdout: result.stdout || '',
    stderr: result.stderr || result.error?.message || ''
  };
}

function normalizeExistingPath(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ProjectValidationError('PROJECT_PATH_REQUIRED', '專案路徑不可為空');
  }
  const resolved = path.resolve(value.trim());
  if (!fs.existsSync(resolved)) {
    throw new ProjectValidationError('PROJECT_NOT_FOUND', `找不到專案路徑：${resolved}`);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new ProjectValidationError('PROJECT_NOT_DIRECTORY', `專案路徑不是目錄：${resolved}`);
  }
  return fs.realpathSync.native(resolved);
}

function isPathInside(root, target) {
  const relative = path.relative(root, target);
  return relative !== ''
    && relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

function createProjectValidator(options = {}) {
  const defaultAllowedProjects = [
    process.env.PIXIU_CORE,
    process.env.PIXIU_CORE_PATH,
    'C:\\PixiuCore'
  ].filter(Boolean);
  const allowedProjectInputs = options.allowedProjects || defaultAllowedProjects;
  const allowedRootInputs = options.allowedRoots || ['D:\\Project'];
  const allowedProjects = allowedProjectInputs
    .filter((project) => typeof project === 'string' && fs.existsSync(project))
    .map((project) => fs.realpathSync.native(path.resolve(project)));
  const allowedRoots = allowedRootInputs
    .filter((root) => typeof root === 'string' && fs.existsSync(root))
    .map((root) => fs.realpathSync.native(path.resolve(root)));
  const fleetPath = options.fleetPath || path.join(process.env.PIXIU_CORE || 'C:\\PixiuCore', 'fleet.json');
  const gitRunner = options.gitRunner || defaultGitRunner;

  function ensureAllowed(targetPath) {
    if (targetPath === path.parse(targetPath).root || targetPath === fs.realpathSync.native(os.homedir())) {
      throw new ProjectValidationError('PROJECT_ROOT_NOT_ALLOWED', '不允許使用磁碟根目錄或使用者家目錄');
    }
    if (allowedProjects.some((project) => project === targetPath)) {
      return;
    }
    if (allowedRoots.some((root) => root === targetPath)) {
      throw new ProjectValidationError('PROJECT_ROOT_NOT_ALLOWED', '請選擇允許根目錄下的具體專案');
    }
    if (!allowedRoots.some((root) => isPathInside(root, targetPath))) {
      throw new ProjectValidationError('PROJECT_NOT_ALLOWED', `專案不在允許範圍：${targetPath}`);
    }
  }

  function inspectGit(targetPath) {
    const hasGitMarker = fs.existsSync(path.join(targetPath, '.git'));
    if (!hasGitMarker) {
      return { isGitRepo: false, branch: null, headSha: null };
    }
    const branchResult = gitRunner(['-C', targetPath, 'branch', '--show-current']);
    const headResult = gitRunner(['-C', targetPath, 'rev-parse', 'HEAD']);
    if (branchResult.status !== 0 || headResult.status !== 0) {
      return { isGitRepo: false, branch: null, headSha: null };
    }
    return {
      isGitRepo: true,
      branch: branchResult.stdout.trim() || null,
      headSha: headResult.stdout.trim() || null
    };
  }

  function validate(projectInput = {}, validationOptions = {}) {
    const sourcePath = normalizeExistingPath(projectInput.path);
    ensureAllowed(sourcePath);
    const git = inspectGit(sourcePath);
    if (validationOptions.requireGit && !git.isGitRepo) {
      throw new ProjectValidationError('PROJECT_GIT_REQUIRED', 'Live PG 需要 Git Repository');
    }
    const entryFiles = ['AGENTS.md', 'CLAUDE.md', 'CODEX.md', 'GEMINI.md']
      .filter((fileName) => fs.existsSync(path.join(sourcePath, fileName)));
    return Object.freeze({
      source: projectInput.source === 'fleet' ? 'fleet' : 'manual',
      sourcePath,
      isGitRepo: git.isGitRepo,
      branch: git.branch,
      headSha: git.headSha,
      entryFiles: Object.freeze(entryFiles)
    });
  }

  function listProjects() {
    if (!fs.existsSync(fleetPath)) {
      return [];
    }
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(fleetPath, 'utf8').replace(/^\uFEFF/, ''));
    } catch (error) {
      throw new ProjectValidationError('INVALID_FLEET_FILE', `fleet.json 無法解析：${error.message}`);
    }
    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
      throw new ProjectValidationError('INVALID_FLEET_FILE', 'fleet.json 必須是專案路徑字串陣列');
    }
    return parsed.map((projectPath) => {
      const resolved = normalizeExistingPath(projectPath);
      ensureAllowed(resolved);
      return { source: 'fleet', path: resolved, name: path.basename(resolved) };
    });
  }

  return Object.freeze({
    allowedProjects: Object.freeze([...allowedProjects]),
    allowedRoots: Object.freeze([...allowedRoots]),
    listProjects,
    validate
  });
}

module.exports = {
  ProjectValidationError,
  createProjectValidator,
  isPathInside
};
