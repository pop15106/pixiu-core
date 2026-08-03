#!/usr/bin/env node
'use strict';

const path = require('node:path');

const { createCodexLiveExecutor } = require('./codex-live-executor');

function parseArguments(argv) {
  const values = {};
  for (const argument of argv) {
    const match = argument.match(/^--(project|worktree)=(.+)$/);
    if (match) values[match[1]] = path.resolve(match[2]);
  }
  if (!values.project || !values.worktree) {
    throw new Error('請提供 --project=<checkout> 與 --worktree=<isolated-worktree>');
  }
  return values;
}

function createTaskPackage(moduleId, allowedInputs, expectedOutputSchema) {
  return {
    runId: 'workflow-live-role-smoke-20260728',
    moduleId,
    objective: `驗證 ${moduleId} Fresh Session 能安全產出角色契約`,
    allowedInputs,
    projectAccess: moduleId === 'pg' ? 'worktree-write' : 'read-only',
    constraints: [
      '只使用 allowedInputs 內容',
      '不得讀取其他角色 Session',
      '不得修改任何檔案',
      '禁止 Push、Merge、Deploy、DB 寫入與依賴變更',
      '回傳 artifact 時將角色物件序列化到 artifact.valueJson'
    ],
    expectedOutputSchema,
    canaryTokens: []
  };
}

async function runRole(executor, options) {
  process.stderr.write(`\n=== LIVE ${options.moduleId.toUpperCase()} ===\n`);
  const result = await executor.execute({
    moduleId: options.moduleId,
    taskPackage: createTaskPackage(
      options.moduleId,
      options.allowedInputs,
      options.expectedOutputSchema
    ),
    project: { sourcePath: options.projectPath },
    worktree: options.worktreePath ? { path: options.worktreePath } : undefined,
    onOutput: (text) => process.stderr.write(text)
  });
  if (result.status !== 'GREEN' || !result.artifact) {
    throw new Error(`${options.moduleId} Live Smoke 未通過：${result.reason || result.status}`);
  }
  return result.artifact.value;
}

async function main() {
  const { project, worktree } = parseArguments(process.argv.slice(2));
  const executor = createCodexLiveExecutor();
  if (!executor.isAvailable()) {
    throw new Error('Codex Live Executor 不可用');
  }

  const requirement = '驗證 PixiuCore Workflow Lab 的真實 Fresh Session 角色鏈，不修改任何檔案。';
  const acceptanceCriteria = [
    'SA、SD、PG、QA 皆回傳 GREEN',
    'PG changedFiles 為空陣列',
    '工作區前後 Git 狀態一致'
  ];
  const pmArtifact = {
    problemStatement: requirement,
    goal: '驗證角色鏈與 sandbox 契約',
    scope: ['Workflow Lab Live Smoke'],
    acceptanceCriteria,
    risks: ['Live Session 會消耗 Codex 額度']
  };

  const saArtifact = await runRole(executor, {
    moduleId: 'sa',
    projectPath: project,
    expectedOutputSchema: 'sa-artifact-v1',
    allowedInputs: {
      pmArtifact,
      translatedBusinessRules: [
        '只讀取角色所需資料',
        'PG 不得修改任何檔案',
        '所有角色需回傳嚴格 JSON 契約'
      ],
      project: { sourcePath: project }
    }
  });

  const sdArtifact = await runRole(executor, {
    moduleId: 'sd',
    projectPath: project,
    expectedOutputSchema: 'sd-artifact-v1',
    allowedInputs: {
      pmArtifact,
      saArtifact,
      constraints: ['不得修改檔案', '不得執行高風險操作'],
      project: { sourcePath: project }
    }
  });

  const pgArtifact = await runRole(executor, {
    moduleId: 'pg',
    projectPath: project,
    worktreePath: worktree,
    expectedOutputSchema: 'pg-artifact-v1',
    allowedInputs: {
      implementationPlan: sdArtifact.implementationPlan || ['只做唯讀 smoke'],
      designContract: sdArtifact.designContract || {},
      allowedFiles: [],
      acceptanceCriteria,
      forbiddenOperations: ['file-write', 'push', 'merge', 'deploy', 'db-write', 'dependency-change'],
      project: { sourcePath: project, worktreePath: worktree }
    }
  });
  if (!Array.isArray(pgArtifact.changedFiles) || pgArtifact.changedFiles.length !== 0) {
    throw new Error('PG Live Smoke 回報了非空 changedFiles');
  }

  const qaArtifact = await runRole(executor, {
    moduleId: 'qa',
    projectPath: project,
    worktreePath: worktree,
    expectedOutputSchema: 'qa-artifact-v1',
    allowedInputs: {
      acceptanceCriteria,
      businessRules: saArtifact.businessRules || [],
      designContract: sdArtifact.designContract || {},
      pgArtifact,
      project: { sourcePath: project, worktreePath: worktree }
    }
  });

  process.stdout.write(`${JSON.stringify({
    status: 'GREEN',
    roles: ['sa', 'sd', 'pg', 'qa'],
    pgChangedFiles: pgArtifact.changedFiles,
    qaVerdict: qaArtifact.verdict || 'GREEN'
  }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`\nLIVE_ROLE_SMOKE_FAILED: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  createTaskPackage,
  parseArguments,
  runRole
};
