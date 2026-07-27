#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function listCoreEvolutionTests(rootDir) {
  const testDir = path.join(rootDir, 'scripts', 'core-evolution', 'test');
  if (!fs.existsSync(testDir)) {
    return [];
  }
  return fs.readdirSync(testDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
    .map((entry) => path.join(testDir, entry.name))
    .sort((left, right) => left.localeCompare(right, 'en'));
}

function createStep(moduleId, label, executable, args, rootDir) {
  return Object.freeze({
    id: moduleId,
    moduleId,
    label,
    executable,
    args: Object.freeze([...args]),
    cwd: rootDir
  });
}

function createTestRegistry(rootDir) {
  const resolvedRoot = path.resolve(rootDir);
  const powershell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
  const coreEvolutionTests = listCoreEvolutionTests(resolvedRoot);
  const requiredEntries = [
    path.join(resolvedRoot, 'scripts', 'hooks', 'pixiu-deterministic-capture.test.js'),
    path.join(resolvedRoot, 'scripts', 'hooks', 'pixiu-auto-recap.test.js'),
    path.join(resolvedRoot, 'scripts', 'performance', 'run-lazy-loading-tests.ps1'),
    path.join(resolvedRoot, 'scripts', 'devspace-portable', 'tests', 'run-tests.ps1'),
    path.join(resolvedRoot, 'scripts', 'test-console', 'repository-safety.js')
  ];
  const missingEntries = requiredEntries.filter((entry) => !fs.existsSync(entry));
  if (coreEvolutionTests.length === 0) {
    missingEntries.unshift(path.join(resolvedRoot, 'scripts', 'core-evolution', 'test', '*.test.js'));
  }
  if (missingEntries.length > 0) {
    throw new Error(`缺少必要測試入口：${missingEntries.join(', ')}`);
  }

  const moduleDefinitions = [
    {
      id: 'core-evolution',
      name: 'Core Evolution Gates',
      description: '驗證資源身分、版本協商、權限交集與擴充安全閘門。',
      kind: 'module',
      estimatedMinutes: 1,
      steps: [
        createStep(
          'core-evolution',
          'Core Evolution Gates',
          process.execPath,
          ['--test', ...coreEvolutionTests],
          resolvedRoot
        )
      ]
    },
    {
      id: 'manual-recap',
      name: 'Manual Recap／Deterministic Capture',
      description: '驗證正式 recap、memory summary、observation、安全與併發行為。',
      kind: 'module',
      estimatedMinutes: 1,
      steps: [
        createStep(
          'manual-recap',
          'Manual Recap／Deterministic Capture',
          process.execPath,
          [path.join(resolvedRoot, 'scripts', 'hooks', 'pixiu-deterministic-capture.test.js')],
          resolvedRoot
        )
      ]
    },
    {
      id: 'auto-recap',
      name: 'Auto Recap',
      description: '驗證 draft-auto recap 的建立、更新、去重與空內容處理。',
      kind: 'module',
      estimatedMinutes: 1,
      steps: [
        createStep(
          'auto-recap',
          'Auto Recap',
          process.execPath,
          [path.join(resolvedRoot, 'scripts', 'hooks', 'pixiu-auto-recap.test.js')],
          resolvedRoot
        )
      ]
    },
    {
      id: 'lazy-loading',
      name: 'Lazy Loading／Router／Skill Metadata',
      description: '驗證啟動預算、Capability Router、Manifest 與 Skill metadata。',
      kind: 'module',
      estimatedMinutes: 1,
      steps: [
        createStep(
          'lazy-loading',
          'Lazy Loading／Router／Skill Metadata',
          powershell,
          [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            path.join(resolvedRoot, 'scripts', 'performance', 'run-lazy-loading-tests.ps1')
          ],
          resolvedRoot
        )
      ]
    },
    {
      id: 'devspace-oneclick',
      name: 'DevSpace OneClick',
      description: '驗證 tunnel、state repair、Subagent patch、Skill discovery 與 Windows 相容性。',
      kind: 'module',
      estimatedMinutes: 2,
      steps: [
        createStep(
          'devspace-oneclick',
          'DevSpace OneClick',
          powershell,
          [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            path.join(resolvedRoot, 'scripts', 'devspace-portable', 'tests', 'run-tests.ps1')
          ],
          resolvedRoot
        )
      ]
    },
    {
      id: 'repository-safety',
      name: 'Repository Safety',
      description: '檢查 diff 格式、Git 衝突標記與高可信憑證樣式。',
      kind: 'module',
      estimatedMinutes: 1,
      steps: [
        createStep(
          'repository-safety',
          'Repository Safety',
          process.execPath,
          [path.join(resolvedRoot, 'scripts', 'test-console', 'repository-safety.js')],
          resolvedRoot
        )
      ]
    },
    {
      id: 'integration-all',
      name: '完整整合測試',
      description: '依序執行全部模組；任一步失敗即停止。',
      kind: 'integration',
      estimatedMinutes: 6,
      moduleIds: [
        'core-evolution',
        'manual-recap',
        'auto-recap',
        'lazy-loading',
        'devspace-oneclick',
        'repository-safety'
      ]
    }
  ];
  const modules = new Map(moduleDefinitions.map((module) => [module.id, module]));

  function get(moduleId) {
    return modules.get(moduleId);
  }

  function list() {
    return moduleDefinitions.map(({ id, name, description, kind, estimatedMinutes }) => ({
      id,
      name,
      description,
      kind,
      estimatedMinutes
    }));
  }

  function resolveSteps(moduleId) {
    const module = get(moduleId);
    if (!module) {
      return undefined;
    }
    if (module.kind !== 'integration') {
      return module.steps.map((step) => ({ ...step, args: [...step.args] }));
    }
    return module.moduleIds.flatMap((childId) => resolveSteps(childId));
  }

  return Object.freeze({ get, list, resolveSteps, rootDir: resolvedRoot });
}

module.exports = {
  createTestRegistry,
  listCoreEvolutionTests
};
