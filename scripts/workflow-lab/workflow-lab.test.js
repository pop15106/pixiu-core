#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const test = require('node:test');

const { createWorkflowCatalog } = require('./workflow-catalog');
const { normalizeWorkflowRequest, WorkflowRequestError } = require('./request-validator');
const { createRedactor, RedactionError } = require('./redaction');
const { createTaskPackageBuilder } = require('./task-package');
const { createArtifactStore, ArtifactStoreError } = require('./artifact-store');
const { createOfflineRunner } = require('./offline-runner');
const { createWorkflowEngine } = require('./workflow-engine');
const { createWorkflowRunManager, RunStateError } = require('./run-manager');
const { createProjectValidator, ProjectValidationError } = require('./project-validator');
const { createWorktreeManager, WorktreeError } = require('./worktree-manager');
const {
  createCodexLiveExecutor,
  LiveExecutionError,
  resolveCodexCommand
} = require('./codex-live-executor');
const { createWorkflowLabServer, isAllowedHost } = require('./server');

test('Workflow Catalog 公開固定角色模組與預設完整順序', () => {
  const catalog = createWorkflowCatalog();

  assert.deepEqual(catalog.defaultSequence, [
    'translator',
    'router',
    'pm',
    'checker-pm',
    'sa',
    'checker-sa',
    'sd',
    'checker-sd',
    'pg',
    'qa',
    'approval-gate',
    'documentation',
    'memory-candidate'
  ]);
  assert.equal(catalog.get('pg').liveAccess, 'worktree-write');
  assert.equal(catalog.get('qa').liveAccess, 'worktree-read');
  assert.equal(catalog.get('need-to-know').kind, 'diagnostic');
  assert.equal(catalog.list().some((module) => 'requiredArtifacts' in module), false);
});

test('Workflow Catalog 一般模式只允許固定順序的子序列', () => {
  const catalog = createWorkflowCatalog();

  assert.deepEqual(
    catalog.validateSequence(['translator', 'pm', 'sa'], {
      advancedOrder: false,
      allowUnsafeOrder: false
    }),
    ['translator', 'pm', 'sa']
  );
  assert.throws(
    () => catalog.validateSequence(['pg', 'pm'], {
      advancedOrder: false,
      allowUnsafeOrder: false
    }),
    /一般模式只能依固定順序/
  );
});

test('Workflow Catalog 進階模式阻擋相依不足，明確允許不安全順序時才放行', () => {
  const catalog = createWorkflowCatalog();

  assert.throws(
    () => catalog.validateSequence(['qa'], {
      advancedOrder: true,
      allowUnsafeOrder: false,
      fixtureMode: 'strict'
    }),
    /缺少必要上游產物/
  );
  assert.deepEqual(
    catalog.validateSequence(['qa'], {
      advancedOrder: true,
      allowUnsafeOrder: true,
      fixtureMode: 'strict'
    }),
    ['qa']
  );
});

test('WorkflowRequest 要求需求或商業邏輯至少一項', () => {
  assert.throws(
    () => normalizeWorkflowRequest({ requirement: '', businessLogic: '' }),
    (error) => error instanceof WorkflowRequestError
      && error.code === 'WORKFLOW_INPUT_REQUIRED'
  );
});

test('WorkflowRequest 正規化預設值並凍結輸出', () => {
  const request = normalizeWorkflowRequest({
    mode: 'offline',
    selectionMode: 'partial',
    requirement: '新增帳單審核',
    businessLogic: '',
    moduleSequence: ['translator', 'pm']
  });

  assert.equal(request.inputMode, 'need-to-know');
  assert.equal(request.fixtureMode, 'strict');
  assert.equal(request.advancedOrder, false);
  assert.equal(request.allowUnsafeOrder, false);
  assert.deepEqual(request.moduleSequence, ['translator', 'pm']);
  assert.equal(Object.isFrozen(request), true);
  assert.equal(Object.isFrozen(request.moduleSequence), true);
});

test('WorkflowRequest 拒絕未知模組、重複模組與無效列舉', () => {
  const base = { requirement: '測試需求' };

  assert.throws(
    () => normalizeWorkflowRequest({ ...base, mode: 'cloud' }),
    (error) => error.code === 'INVALID_WORKFLOW_MODE'
  );
  assert.throws(
    () => normalizeWorkflowRequest({ ...base, moduleSequence: ['translator', 'missing'] }),
    (error) => error.code === 'UNKNOWN_WORKFLOW_MODULE'
  );
  assert.throws(
    () => normalizeWorkflowRequest({ ...base, moduleSequence: ['pm', 'pm'] }),
    (error) => error.code === 'DUPLICATE_WORKFLOW_MODULE'
  );
});

test('WorkflowRequest 限制輸入大小與集合數量', () => {
  assert.throws(
    () => normalizeWorkflowRequest({ requirement: 'a'.repeat(50001) }),
    (error) => error.code === 'WORKFLOW_INPUT_TOO_LARGE'
  );
  assert.throws(
    () => normalizeWorkflowRequest({
      requirement: '需求',
      sensitiveTerms: Array.from({ length: 201 }, (_, index) => `term-${index}`)
    }),
    (error) => error.code === 'WORKFLOW_COLLECTION_TOO_LARGE'
  );
});

test('WorkflowRequest 原文直通與不安全順序需要核准旗標', () => {
  const rawRequest = normalizeWorkflowRequest({
    requirement: '需求',
    inputMode: 'raw-pass-through',
    rawPassThroughApproved: false,
    moduleSequence: ['translator']
  });
  assert.equal(rawRequest.requiresApproval.some((item) => item.kind === 'raw-pass-through'), true);

  const unsafeRequest = normalizeWorkflowRequest({
    requirement: '需求',
    advancedOrder: true,
    allowUnsafeOrder: true,
    unsafeOrderApproved: false,
    moduleSequence: ['qa']
  });
  assert.equal(unsafeRequest.requiresApproval.some((item) => item.kind === 'unsafe-order'), true);
});

test('Redaction 以字面值遮罩敏感詞並保留條件、數值與順序', () => {
  const redactor = createRedactor({
    sensitiveTerms: ['太平洋電線', 'A+B'],
    canaryFactory: () => 'CANARY-ABC'
  });

  assert.equal(
    redactor.redactText('客戶太平洋電線，當 A+B >= 100 時先審核再付款'),
    '客戶{{SENSITIVE_1}}，當 {{SENSITIVE_2}} >= 100 時先審核再付款'
  );
});

test('Redaction 可遞迴遮罩且不修改原始物件', () => {
  const source = {
    customer: '太平洋電線',
    nested: [{ rule: '太平洋電線 amount >= 100' }]
  };
  const redactor = createRedactor({ sensitiveTerms: ['太平洋電線'] });
  const redacted = redactor.redactValue(source);

  assert.equal(redacted.customer, '{{SENSITIVE_1}}');
  assert.equal(redacted.nested[0].rule, '{{SENSITIVE_1}} amount >= 100');
  assert.equal(source.customer, '太平洋電線');
  assert.notEqual(redacted, source);
});

test('Redaction 阻擋敏感內容與 Canary 落地', () => {
  const redactor = createRedactor({
    sensitiveTerms: ['太平洋電線'],
    canaryFactory: () => 'CANARY-ABC'
  });
  const canary = redactor.createCanary();

  assert.equal(canary, 'CANARY-ABC');
  assert.throws(
    () => redactor.assertSafeForPersistence({ text: '太平洋電線' }),
    (error) => error instanceof RedactionError
      && error.code === 'PERSISTENCE_SENSITIVE_CONTENT'
  );
  assert.throws(
    () => redactor.assertSafeForPersistence({ text: 'CANARY-ABC' }),
    (error) => error instanceof RedactionError
      && error.code === 'CANARY_LEAK'
  );
  assert.throws(
    () => redactor.assertSafeForPersistence({ 太平洋電線: 'masked-value' }),
    (error) => error.code === 'PERSISTENCE_SENSITIVE_CONTENT'
  );
});

test('Redaction 拒絕循環資料與危險原型鍵', () => {
  const redactor = createRedactor({ sensitiveTerms: [] });
  const cyclic = {};
  cyclic.self = cyclic;

  assert.throws(
    () => redactor.redactValue(cyclic),
    (error) => error.code === 'UNSAFE_REDACTION_VALUE'
  );
  assert.throws(
    () => redactor.redactValue(JSON.parse('{"__proto__":{"polluted":true}}')),
    (error) => error.code === 'UNSAFE_REDACTION_KEY'
  );
});

test('Need-to-Know QA 只取得驗收、商業規則、設計契約與 PG 產物', () => {
  const catalog = createWorkflowCatalog();
  const builder = createTaskPackageBuilder({ catalog });
  const request = normalizeWorkflowRequest({
    requirement: '新增帳單審核',
    businessLogic: '客戶超過 100 元需覆核',
    acceptanceCriteria: ['超過 100 元會進入覆核'],
    moduleSequence: ['translator', 'pm', 'sa', 'sd', 'pg', 'qa']
  });
  const artifacts = {
    'translated-requirement-v1': { normalizedRequirement: '新增帳單審核' },
    'pm-artifact-v1': {
      acceptanceCriteria: ['超過 100 元會進入覆核'],
      privateNotes: 'PM 私有備註'
    },
    'sa-artifact-v1': { businessRules: ['amount > 100 -> review'] },
    'sd-artifact-v1': { designContract: { endpoint: '/billing/review' } },
    'pg-artifact-v1': {
      changedFiles: ['BillingService.java'],
      diffSummary: '新增覆核判斷',
      reasoning: 'PG 私有推理'
    }
  };

  const task = builder.build({
    runId: 'run-1',
    moduleId: 'qa',
    request,
    artifacts,
    canaryTokens: ['CANARY-X']
  });

  assert.deepEqual(task.allowedInputs.acceptanceCriteria, ['超過 100 元會進入覆核']);
  assert.deepEqual(task.allowedInputs.businessRules, ['amount > 100 -> review']);
  assert.deepEqual(task.allowedInputs.designContract, { endpoint: '/billing/review' });
  assert.deepEqual(task.allowedInputs.pgArtifact, {
    changedFiles: ['BillingService.java'],
    diffSummary: '新增覆核判斷'
  });
  assert.equal(task.allowedInputs.rawBusinessLogic, undefined);
  assert.equal(task.allowedInputs.pgReasoning, undefined);
  assert.deepEqual(task.canaryTokens, ['CANARY-X']);
  assert.equal(task.projectAccess, 'worktree-read');
});

test('Need-to-Know 各角色使用明確 allowlist，不複製完整 request', () => {
  const catalog = createWorkflowCatalog();
  const builder = createTaskPackageBuilder({ catalog });
  const request = normalizeWorkflowRequest({
    requirement: '需求原文',
    businessLogic: '機密邏輯',
    expectedOutcome: '完成測試',
    constraints: ['禁止改 DB'],
    moduleSequence: ['translator', 'pm']
  });
  const artifacts = {
    'translated-requirement-v1': {
      normalizedRequirement: 'REQ-001',
      translatedBusinessRules: ['RULE-001']
    }
  };

  const pmTask = builder.build({ runId: 'run-2', moduleId: 'pm', request, artifacts });
  assert.deepEqual(pmTask.allowedInputs, {
    translatedRequirement: 'REQ-001',
    translatedBusinessRules: ['RULE-001'],
    expectedOutcome: '完成測試',
    constraints: ['禁止改 DB'],
    acceptanceCriteria: []
  });
  assert.equal(JSON.stringify(pmTask).includes('機密邏輯'), false);
  assert.equal(pmTask.projectAccess, 'read-only');
});

test('Need-to-Know 拒絕未知模組與缺少必要 Artifact', () => {
  const builder = createTaskPackageBuilder({ catalog: createWorkflowCatalog() });
  const request = normalizeWorkflowRequest({ requirement: '需求', moduleSequence: ['pm'] });

  assert.throws(
    () => builder.build({ runId: 'run-3', moduleId: 'missing', request, artifacts: {} }),
    /找不到工作流模組/
  );
  assert.throws(
    () => builder.build({ runId: 'run-3', moduleId: 'pm', request, artifacts: {} }),
    /缺少必要 Artifact/
  );
});

test('Artifact Store 阻擋敏感內容落地並保存遮罩後 Artifact', () => {
  const redactor = createRedactor({ sensitiveTerms: ['太平洋電線'] });
  const store = createArtifactStore({
    redactor,
    idFactory: () => 'artifact-1',
    now: () => '2026-07-27T00:00:00.000Z'
  });

  assert.throws(
    () => store.save({
      runId: 'run-1',
      moduleId: 'pm',
      type: 'pm-artifact-v1',
      value: { text: '太平洋電線' },
      persistence: 'durable'
    }),
    (error) => error instanceof RedactionError
      && error.code === 'PERSISTENCE_SENSITIVE_CONTENT'
  );

  const saved = store.save({
    runId: 'run-1',
    moduleId: 'pm',
    type: 'pm-artifact-v1',
    value: { text: '{{SENSITIVE_1}}' },
    persistence: 'durable'
  });
  assert.equal(saved.id, 'artifact-1');
  assert.equal(store.get(saved.id).value.text, '{{SENSITIVE_1}}');
  assert.equal(store.listDurable('run-1').length, 1);
  assert.equal('value' in store.snapshot('run-1').artifacts[0], false);
});

test('Artifact Store 的 memory-only 原文不出現在持久化清單', () => {
  let nextId = 0;
  const store = createArtifactStore({
    redactor: createRedactor({ sensitiveTerms: ['秘密原文'] }),
    idFactory: () => `artifact-${++nextId}`
  });

  const memoryArtifact = store.save({
    runId: 'run-1',
    moduleId: 'translator',
    type: 'raw-input-v1',
    value: { text: '秘密原文' },
    persistence: 'memory'
  });
  assert.equal(store.get(memoryArtifact.id).value.text, '秘密原文');
  assert.deepEqual(store.listDurable('run-1'), []);
  assert.deepEqual(store.snapshot('run-1').artifacts, []);
});

test('Artifact Store 深層複製、限制大小並拒絕危險資料', () => {
  let nextId = 0;
  const store = createArtifactStore({
    redactor: createRedactor({ sensitiveTerms: [] }),
    idFactory: () => `artifact-${++nextId}`,
    maxArtifactBytes: 80
  });
  const source = { nested: { value: 'safe' } };
  const saved = store.save({
    runId: 'run-1',
    moduleId: 'pm',
    type: 'pm-artifact-v1',
    value: source,
    persistence: 'durable'
  });
  source.nested.value = 'mutated';
  assert.equal(store.get(saved.id).value.nested.value, 'safe');

  assert.throws(
    () => store.save({
      runId: 'run-1',
      moduleId: 'pm',
      type: 'pm-artifact-v1',
      value: { text: 'x'.repeat(100) },
      persistence: 'durable'
    }),
    (error) => error instanceof ArtifactStoreError
      && error.code === 'ARTIFACT_TOO_LARGE'
  );
  assert.throws(
    () => store.save({
      runId: 'run-1',
      moduleId: 'pm',
      type: 'pm-artifact-v1',
      value: { callback() {} },
      persistence: 'durable'
    }),
    (error) => error.code === 'INVALID_ARTIFACT_VALUE'
  );
});

async function waitFor(predicate, timeoutMs = 3000) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('等待條件逾時');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function createDeterministicEngine() {
  let runNumber = 0;
  let artifactNumber = 0;
  let tick = 0;
  return createWorkflowEngine({
    idFactory: () => `run-${++runNumber}`,
    artifactIdFactory: () => `artifact-${++artifactNumber}`,
    now: () => `2026-07-27T00:00:${String(tick++).padStart(2, '0')}.000Z`
  });
}

test('WorkflowRequest 支援 Offline 測試情境並拒絕未知情境', () => {
  const request = normalizeWorkflowRequest({
    requirement: '需求',
    testScenario: 'qa-red',
    moduleSequence: ['translator', 'pm']
  });
  assert.equal(request.testScenario, 'qa-red');

  assert.throws(
    () => normalizeWorkflowRequest({ requirement: '需求', testScenario: 'unknown' }),
    (error) => error.code === 'INVALID_WORKFLOW_TEST_SCENARIO'
  );
});

test('Offline Runner 產生可識別的 Translator、PG 與 Memory 契約', async () => {
  const catalog = createWorkflowCatalog();
  const redactor = createRedactor({ sensitiveTerms: ['太平洋電線'] });
  const runner = createOfflineRunner({ now: () => '2026-07-27T00:00:00.000Z' });
  const request = normalizeWorkflowRequest({
    requirement: '太平洋電線新增帳單審核',
    businessLogic: '金額 > 100 時覆核',
    moduleSequence: ['translator']
  });
  const builder = createTaskPackageBuilder({ catalog });
  const translatorTask = builder.build({
    runId: 'run-1',
    moduleId: 'translator',
    request,
    artifacts: {}
  });
  const translator = await runner.execute({
    moduleId: 'translator',
    taskPackage: translatorTask,
    context: { redactor, request, artifacts: {}, redResolved: false }
  });
  assert.equal(translator.status, 'GREEN');
  assert.equal(translator.artifact.type, 'translated-requirement-v1');
  assert.equal(translator.artifact.value.normalizedRequirement.includes('太平洋電線'), false);
  assert.equal(translator.artifact.value.synthetic, true);

  const pg = await runner.execute({
    moduleId: 'pg',
    taskPackage: {
      allowedInputs: {
        allowedFiles: ['BillingService.java'],
        forbiddenOperations: ['push', 'merge', 'deploy', 'db-write', 'dependency-change']
      }
    },
    context: { request, redResolved: false }
  });
  assert.equal(pg.artifact.value.worktreeRequired, true);
  assert.deepEqual(pg.artifact.value.forbiddenOperations, ['push', 'merge', 'deploy', 'db-write', 'dependency-change']);

  const memory = await runner.execute({
    moduleId: 'memory-candidate',
    taskPackage: { allowedInputs: { documentationArtifact: { summary: '完成' } } },
    context: { request, redResolved: false }
  });
  assert.equal(memory.artifact.value.writeToVault, false);
});

test('Workflow Engine Assisted Fixture 可單獨測試所有角色與控制模組', async () => {
  const moduleIds = createWorkflowCatalog().list().map((module) => module.id);

  for (const moduleId of moduleIds) {
    const engine = createDeterministicEngine();
    const run = await engine.start({
      requirement: `單獨測試 ${moduleId}`,
      selectionMode: 'single',
      fixtureMode: 'assisted-fixture',
      moduleSequence: [moduleId]
    });
    assert.equal(run.status, 'green', `${moduleId} 應可使用 Assisted Fixture 單獨執行`);
    assert.equal(run.steps.length, 1, `${moduleId} 不應執行其他角色模組`);
    assert.equal(run.steps[0].moduleId, moduleId);
  }
});

test('Workflow Engine Strict 單模組可使用手動上游 Artifact', async () => {
  const engine = createDeterministicEngine();
  const run = await engine.start({
    requirement: '只驗證 QA',
    selectionMode: 'single',
    fixtureMode: 'strict',
    moduleSequence: ['qa'],
    inputArtifacts: {
      'pm-artifact-v1': {
        acceptanceCriteria: ['回傳 GREEN']
      },
      'sa-artifact-v1': {
        businessRules: ['輸入有效時執行']
      },
      'sd-artifact-v1': {
        designContract: { input: 'valid', output: 'GREEN' }
      },
      'pg-artifact-v1': {
        changedFiles: ['Example.java'],
        diffSummary: '測試 Fixture'
      }
    }
  });

  assert.equal(run.status, 'green');
  assert.equal(run.steps[0].moduleId, 'qa');
  assert.equal(run.artifacts[0].type, 'qa-artifact-v1');
});

test('Workflow Engine Canary 洩漏時 RED 並建議退回 Translator', async () => {
  const engine = createDeterministicEngine();
  const run = await engine.start({
    requirement: '測試隔離',
    testScenario: 'canary-leak',
    moduleSequence: ['translator']
  });

  assert.equal(run.status, 'paused');
  assert.equal(run.pendingApproval.kind, 'red-return');
  assert.equal(run.pendingApproval.recommendedModuleId, 'translator');
  assert.equal(run.steps[0].exposureReport.canaryLeaks.length, 1);
});

test('Workflow Engine 可執行 Translator 單模組且 Snapshot 不含原文', async () => {
  const engine = createDeterministicEngine();
  const secret = 'SECRET-BUSINESS-LOGIC-7788';
  const run = await engine.start({
    requirement: `建立流程 ${secret}`,
    sensitiveTerms: [secret],
    selectionMode: 'single',
    moduleSequence: ['translator']
  });

  assert.equal(run.status, 'green');
  assert.deepEqual(run.steps.map((step) => step.moduleId), ['translator']);
  assert.equal(JSON.stringify(run).includes(secret), false);
  assert.equal(run.artifacts.length, 1);
  assert.equal(run.artifacts[0].type, 'translated-requirement-v1');
});

test('Workflow Engine 可執行部分流程 translator → pm → sa', async () => {
  const engine = createDeterministicEngine();
  const run = await engine.start({
    requirement: '新增帳單覆核',
    businessLogic: '金額 > 100 時需覆核',
    sensitiveTerms: ['帳單'],
    selectionMode: 'partial',
    moduleSequence: ['translator', 'pm', 'sa']
  });

  assert.equal(run.status, 'green');
  assert.deepEqual(run.steps.map((step) => step.status), ['GREEN', 'GREEN', 'GREEN']);
  assert.deepEqual(run.artifacts.map((artifact) => artifact.type), [
    'translated-requirement-v1',
    'pm-artifact-v1',
    'sa-artifact-v1'
  ]);
});

test('Workflow Engine 完整 Offline Flow 全部 GREEN', async () => {
  const engine = createDeterministicEngine();
  const run = await engine.start({
    requirement: '新增帳單覆核流程',
    businessLogic: '金額 > 100 時需覆核',
    selectionMode: 'full',
    fixtureMode: 'assisted-fixture'
  });

  assert.equal(run.status, 'green');
  assert.equal(run.steps.length, 13);
  assert.equal(run.steps.every((step) => step.status === 'GREEN'), true);
  assert.equal(run.artifacts.some((artifact) => artifact.type === 'documentation-artifact-v1'), true);
  assert.equal(run.artifacts.some((artifact) => artifact.type === 'memory-candidate-v1'), true);
});

test('Workflow Engine QA RED 時暫停並可人工退回 PG 後完成', async () => {
  const engine = createDeterministicEngine();
  const paused = await engine.start({
    requirement: '新增帳單覆核流程',
    selectionMode: 'full',
    fixtureMode: 'assisted-fixture',
    testScenario: 'qa-red'
  });

  assert.equal(paused.status, 'paused');
  assert.equal(paused.pendingApproval.kind, 'red-return');
  assert.equal(paused.pendingApproval.recommendedModuleId, 'pg');
  assert.equal(paused.steps.find((step) => step.moduleId === 'qa').status, 'RED');

  const resumed = await engine.resume(paused.id, { action: 'return', moduleId: 'pg' });
  assert.equal(resumed.status, 'green');
  assert.equal(resumed.iteration, 2);
  assert.equal(resumed.steps.at(-1).moduleId, 'memory-candidate');
});

test('Workflow Engine 原文直通先暫停，核准後才執行', async () => {
  const engine = createDeterministicEngine();
  const paused = await engine.start({
    requirement: '需求',
    inputMode: 'raw-pass-through',
    moduleSequence: ['translator']
  });
  assert.equal(paused.status, 'paused');
  assert.equal(paused.pendingApproval.kind, 'raw-pass-through');
  assert.equal(paused.steps.length, 0);

  const resumed = await engine.resume(paused.id, { action: 'approve' });
  assert.equal(resumed.status, 'green');
});

test('Workflow Engine Reject RED 後以 red 結束', async () => {
  const engine = createDeterministicEngine();
  const paused = await engine.start({
    requirement: '需求',
    selectionMode: 'full',
    fixtureMode: 'assisted-fixture',
    testScenario: 'qa-red'
  });
  const rejected = await engine.resume(paused.id, { action: 'reject' });
  assert.equal(rejected.status, 'red');
  assert.equal(rejected.pendingApproval, null);
});

test('Workflow Run Manager 阻擋無效狀態轉移與第二個 active run', () => {
  let nextId = 0;
  const manager = createWorkflowRunManager({ idFactory: () => `run-${++nextId}` });
  const first = manager.create({ mode: 'offline', moduleSequence: ['translator'] });

  assert.throws(
    () => manager.create({ mode: 'offline', moduleSequence: ['translator'] }),
    (error) => error instanceof RunStateError && error.code === 'ACTIVE_RUN_EXISTS'
  );
  assert.throws(
    () => manager.transition(first.id, 'green'),
    (error) => error instanceof RunStateError && error.code === 'INVALID_RUN_TRANSITION'
  );
  manager.transition(first.id, 'running');
  manager.transition(first.id, 'green');
  assert.equal(manager.getSnapshot(first.id).status, 'green');
  assert.equal(manager.getLatestRun().id, first.id);

  const secondManager = createWorkflowRunManager({ idFactory: () => 'run-paused' });
  const paused = secondManager.create({ mode: 'live', moduleSequence: ['pg'] });
  secondManager.transition(paused.id, 'paused');
  secondManager.transition(paused.id, 'failed');
  assert.equal(secondManager.getSnapshot(paused.id).status, 'failed');
});

test('Workflow Engine 將原始需求從 Log、錯誤與 RED 原因中強制遮罩', async () => {
  const secret = 'RAW-WORKFLOW-SECRET-9911';
  const failedEngine = createWorkflowEngine({
    idFactory: () => 'run-secret-failed',
    offlineRunner: {
      async execute() {
        throw new Error(`執行失敗：${secret}`);
      }
    }
  });
  const failed = await failedEngine.start({
    requirement: secret,
    businessLogic: `規則 ${secret}`,
    moduleSequence: ['translator']
  });
  assert.equal(failed.status, 'failed');
  assert.equal(JSON.stringify(failed).includes(secret), false);

  const redEngine = createWorkflowEngine({
    idFactory: () => 'run-secret-red',
    offlineRunner: {
      async execute() {
        return {
          moduleId: 'translator',
          status: 'RED',
          artifact: null,
          evidence: [],
          warnings: [`警告 ${secret}`],
          exposureReport: { sensitiveMatches: [], canaryLeaks: [] },
          recommendedModuleId: 'translator',
          reason: `退回原因 ${secret}`,
          startedAt: '2026-07-27T00:00:00.000Z',
          finishedAt: '2026-07-27T00:00:01.000Z'
        };
      }
    }
  });
  const red = await redEngine.start({ requirement: secret, moduleSequence: ['translator'] });
  assert.equal(red.status, 'paused');
  assert.equal(JSON.stringify(red).includes(secret), false);
});

test('Workflow Run Manager 限制 Log 並遮罩後才保存', () => {
  const redactor = createRedactor({ sensitiveTerms: ['秘密'] });
  const manager = createWorkflowRunManager({
    idFactory: () => 'run-1',
    maxLogChars: 20
  });
  const run = manager.create({ mode: 'offline', moduleSequence: ['translator'] }, { redactor });
  manager.appendLog(run.id, '1234567890秘密ABCDEFGHIJ');
  const snapshot = manager.getSnapshot(run.id);

  assert.ok(snapshot.log.length <= 20);
  assert.equal(snapshot.log.includes('秘密'), false);
});

test('Project Validator 接受明確允許的專案本身', () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-workflow-project-'));
  fs.mkdirSync(path.join(projectPath, '.git'), { recursive: true });
  const validator = createProjectValidator({
    allowedProjects: [projectPath],
    allowedRoots: [],
    gitRunner(args) {
      return args.includes('--show-current')
        ? { status: 0, stdout: 'main\n', stderr: '' }
        : { status: 0, stdout: 'abc123\n', stderr: '' };
    }
  });

  const descriptor = validator.validate({ source: 'manual', path: projectPath }, { requireGit: true });
  assert.equal(descriptor.sourcePath, fs.realpathSync.native(projectPath));
  assert.equal(descriptor.branch, 'main');
});

test('Project Validator 接受允許根目錄內專案並回傳 Git 描述', () => {
  const allowedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-workflow-allowed-'));
  const projectPath = path.join(allowedRoot, 'project-a');
  fs.mkdirSync(path.join(projectPath, '.git'), { recursive: true });
  fs.writeFileSync(path.join(projectPath, 'AGENTS.md'), '# Agent\n', 'utf8');
  const calls = [];
  const validator = createProjectValidator({
    allowedRoots: [allowedRoot],
    gitRunner(args) {
      calls.push(args);
      if (args.includes('--show-current')) {
        return { status: 0, stdout: 'feature/test\n', stderr: '' };
      }
      return { status: 0, stdout: 'abc123\n', stderr: '' };
    }
  });

  const descriptor = validator.validate({ source: 'manual', path: projectPath }, { requireGit: true });
  assert.equal(descriptor.sourcePath, fs.realpathSync.native(projectPath));
  assert.equal(descriptor.isGitRepo, true);
  assert.equal(descriptor.branch, 'feature/test');
  assert.deepEqual(descriptor.entryFiles, ['AGENTS.md']);
  assert.equal(calls.length >= 2, true);
});

test('Project Validator 拒絕允許範圍外、根目錄與缺少 Git 的 PG 專案', () => {
  const allowedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-workflow-allowed-'));
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-workflow-outside-'));
  const plainProject = path.join(allowedRoot, 'plain');
  fs.mkdirSync(plainProject, { recursive: true });
  const validator = createProjectValidator({ allowedRoots: [allowedRoot] });

  assert.throws(
    () => validator.validate({ source: 'manual', path: outsideRoot }),
    (error) => error instanceof ProjectValidationError && error.code === 'PROJECT_NOT_ALLOWED'
  );
  assert.throws(
    () => validator.validate({ source: 'manual', path: allowedRoot }),
    (error) => error.code === 'PROJECT_ROOT_NOT_ALLOWED'
  );
  assert.throws(
    () => validator.validate({ source: 'manual', path: plainProject }, { requireGit: true }),
    (error) => error.code === 'PROJECT_GIT_REQUIRED'
  );
});

test('Project Validator 只接受字串陣列 fleet.json', () => {
  const allowedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-workflow-fleet-'));
  const projectPath = path.join(allowedRoot, 'project-a');
  fs.mkdirSync(projectPath, { recursive: true });
  const fleetPath = path.join(allowedRoot, 'fleet.json');
  fs.writeFileSync(fleetPath, JSON.stringify([projectPath]), 'utf8');
  const validator = createProjectValidator({ allowedRoots: [allowedRoot], fleetPath });
  assert.equal(validator.listProjects().length, 1);

  fs.writeFileSync(fleetPath, JSON.stringify({ project: projectPath }), 'utf8');
  assert.throws(
    () => validator.listProjects(),
    (error) => error.code === 'INVALID_FLEET_FILE'
  );
});

test('Worktree Manager 使用固定 Git 命令且不會退回來源 checkout', async () => {
  const managedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-workflow-worktrees-'));
  const sourcePath = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-workflow-source-'));
  const calls = [];
  const manager = createWorktreeManager({
    managedRoot,
    gitRunner(args) {
      calls.push(args);
      if (args.includes('rev-parse')) {
        return Promise.resolve({ status: 0, stdout: 'base123\n', stderr: '' });
      }
      return Promise.resolve({ status: 0, stdout: '', stderr: '' });
    }
  });

  const descriptor = await manager.create({ sourcePath, runId: 'run-1' });
  assert.equal(descriptor.path, path.join(managedRoot, 'run-1'));
  assert.equal(descriptor.path === sourcePath, false);
  assert.equal(descriptor.baseSha, 'base123');
  assert.deepEqual(calls[0], [
    '-C',
    sourcePath,
    'worktree',
    'add',
    '--detach',
    path.join(managedRoot, 'run-1'),
    'HEAD'
  ]);
  assert.equal('remove' in manager, false);
});

test('Worktree Manager 建立失敗時直接失敗且禁止危險 runId', async () => {
  const managedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-workflow-worktrees-'));
  const sourcePath = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-workflow-source-'));
  const manager = createWorktreeManager({
    managedRoot,
    gitRunner() {
      return Promise.resolve({ status: 1, stdout: '', stderr: 'git failed' });
    }
  });

  await assert.rejects(
    manager.create({ sourcePath, runId: '../escape' }),
    (error) => error instanceof WorktreeError && error.code === 'INVALID_WORKTREE_RUN_ID'
  );
  await assert.rejects(
    manager.create({ sourcePath, runId: 'run-1' }),
    (error) => error.code === 'WORKTREE_CREATE_FAILED'
  );
});

function createFakeCodexSpawn(result, capture) {
  return (executable, args, options) => {
    capture.executable = executable;
    capture.args = [...args];
    capture.options = { ...options };
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    const promptChunks = [];
    child.stdin.on('data', (chunk) => promptChunks.push(chunk));
    child.stdin.on('finish', () => {
      capture.prompt = Buffer.concat(promptChunks).toString('utf8');
      queueMicrotask(() => {
        if (result.stderr) {
          child.stderr.write(result.stderr);
        }
        child.stderr.end();
        if (result.stdout) {
          child.stdout.write(result.stdout);
        }
        child.stdout.end();
        child.emit('close', result.exitCode ?? 0, null);
      });
    });
    child.kill = () => child.emit('close', null, 'SIGTERM');
    return child;
  };
}

test('Codex Live Executor 在 Windows 解析 npm Codex JS 入口並由 Node 直啟', () => {
  const appData = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-codex-appdata-'));
  const codexJs = path.join(
    appData,
    'npm',
    'node_modules',
    '@openai',
    'codex',
    'bin',
    'codex.js'
  );
  fs.mkdirSync(path.dirname(codexJs), { recursive: true });
  fs.writeFileSync(codexJs, '#!/usr/bin/env node\n', 'utf8');

  assert.deepEqual(resolveCodexCommand({
    platform: 'win32',
    env: { APPDATA: appData },
    nodeExecutable: 'node-test.exe'
  }), {
    executable: 'node-test.exe',
    argsPrefix: [codexJs]
  });
  assert.deepEqual(resolveCodexCommand({ platform: 'linux', env: {} }), {
    executable: 'codex',
    argsPrefix: []
  });
});

test('Codex Live Executor 為讀取角色建立 ephemeral read-only Fresh Session', async () => {
  const capture = {};
  const executor = createCodexLiveExecutor({
    schemaPath: path.join(__dirname, 'schemas', 'role-result.schema.json'),
    codexCommand: { executable: 'node-test.exe', argsPrefix: ['codex-entry.js'] },
    commandProbe: () => true,
    spawn: createFakeCodexSpawn({
      stdout: JSON.stringify({
        status: 'GREEN',
        artifact: { type: 'pm-artifact-v1', valueJson: '{"problemStatement":"safe"}' },
        evidence: [],
        warnings: [],
        recommendedModuleId: null,
        reason: null
      }),
      exitCode: 0
    }, capture)
  });

  const result = await executor.execute({
    moduleId: 'pm',
    taskPackage: {
      moduleId: 'pm',
      allowedInputs: { translatedRequirement: 'REQ-001' },
      expectedOutputSchema: 'pm-artifact-v1'
    },
    project: { sourcePath: 'C:\\Project\\demo' },
    onOutput() {}
  });

  assert.equal(result.status, 'GREEN');
  assert.deepEqual(result.artifact.value, { problemStatement: 'safe' });
  assert.equal(capture.executable, 'node-test.exe');
  assert.deepEqual(capture.args.slice(0, 4), ['codex-entry.js', 'exec', '--ephemeral', '--color']);
  assert.equal(capture.args.includes('read-only'), true);
  assert.equal(capture.args.includes('workspace-write'), false);
  assert.equal(capture.args.includes('--ask-for-approval'), false);
  assert.equal(capture.prompt.includes('REQ-001'), true);
  assert.equal(capture.prompt.includes('Push'), true);
});

test('Codex Live Executor PG 只使用 Worktree workspace-write 並拒絕缺少 Worktree', async () => {
  const capture = {};
  const executor = createCodexLiveExecutor({
    schemaPath: path.join(__dirname, 'schemas', 'role-result.schema.json'),
    codexCommand: { executable: 'node-test.exe', argsPrefix: ['codex-entry.js'] },
    commandProbe: () => true,
    spawn: createFakeCodexSpawn({
      stdout: JSON.stringify({
        status: 'GREEN',
        artifact: { type: 'pg-artifact-v1', valueJson: '{"changedFiles":[]}' },
        evidence: [],
        warnings: [],
        recommendedModuleId: null,
        reason: null
      }),
      exitCode: 0
    }, capture)
  });

  await assert.rejects(
    executor.execute({
      moduleId: 'pg',
      taskPackage: { moduleId: 'pg', allowedInputs: {}, expectedOutputSchema: 'pg-artifact-v1' },
      project: { sourcePath: 'C:\\Project\\demo' },
      onOutput() {}
    }),
    (error) => error instanceof LiveExecutionError && error.code === 'PG_WORKTREE_REQUIRED'
  );

  await executor.execute({
    moduleId: 'pg',
    taskPackage: { moduleId: 'pg', allowedInputs: {}, expectedOutputSchema: 'pg-artifact-v1' },
    project: { sourcePath: 'C:\\Project\\demo' },
    worktree: { path: 'C:\\Managed\\run-1' },
    onOutput() {}
  });
  assert.equal(capture.args.includes('workspace-write'), true);
  assert.equal(capture.args.includes('C:\\Managed\\run-1'), true);
  assert.equal(capture.args.includes('C:\\Project\\demo'), false);
});

test('Codex Live Executor 明確回報 unavailable、非零 exit 與無效 JSON', async () => {
  const unavailable = createCodexLiveExecutor({ commandProbe: () => false });
  assert.equal(unavailable.isAvailable(), false);
  await assert.rejects(
    unavailable.execute({ moduleId: 'pm', taskPackage: {}, project: { sourcePath: 'x' } }),
    (error) => error.code === 'LIVE_EXECUTOR_UNAVAILABLE'
  );

  const failed = createCodexLiveExecutor({
    commandProbe: () => true,
    spawn: createFakeCodexSpawn({ stderr: 'failed', exitCode: 3 }, {})
  });
  await assert.rejects(
    failed.execute({ moduleId: 'pm', taskPackage: {}, project: { sourcePath: 'x' } }),
    (error) => error.code === 'LIVE_EXECUTION_FAILED'
  );

  const invalid = createCodexLiveExecutor({
    commandProbe: () => true,
    spawn: createFakeCodexSpawn({ stdout: 'not-json', exitCode: 0 }, {})
  });
  await assert.rejects(
    invalid.execute({ moduleId: 'pm', taskPackage: {}, project: { sourcePath: 'x' } }),
    (error) => error.code === 'LIVE_OUTPUT_INVALID'
  );
});

test('Workflow Engine Live PG 在建立 Worktree 前暫停並於核准後執行', async () => {
  const offline = createOfflineRunner({ now: () => '2026-07-27T00:00:00.000Z' });
  const liveCalls = [];
  const engine = createWorkflowEngine({
    idFactory: () => 'run-live',
    artifactIdFactory: (() => {
      let value = 0;
      return () => `artifact-live-${++value}`;
    })(),
    projectValidator: {
      validate() {
        return { sourcePath: 'C:\\Project\\demo', isGitRepo: true, branch: 'main' };
      }
    },
    worktreeManager: {
      async create() {
        return { path: 'C:\\Managed\\run-live', sourcePath: 'C:\\Project\\demo', baseSha: 'abc' };
      }
    },
    liveExecutor: {
      isAvailable() { return true; },
      async execute(input) {
        liveCalls.push({ moduleId: input.moduleId, worktree: input.worktree });
        if (input.moduleId === 'pm') {
          return offline.execute({ moduleId: 'pm', taskPackage: input.taskPackage, context: { request: { testScenario: 'green' } } });
        }
        if (input.moduleId === 'sa') {
          return offline.execute({ moduleId: 'sa', taskPackage: input.taskPackage, context: { request: { testScenario: 'green' } } });
        }
        if (input.moduleId === 'sd') {
          return offline.execute({ moduleId: 'sd', taskPackage: input.taskPackage, context: { request: { testScenario: 'green' } } });
        }
        return offline.execute({ moduleId: 'pg', taskPackage: input.taskPackage, context: { request: { testScenario: 'green' } } });
      }
    }
  });

  const paused = await engine.start({
    mode: 'live',
    requirement: '新增功能',
    project: { source: 'manual', path: 'C:\\Project\\demo' },
    fixtureMode: 'assisted-fixture',
    moduleSequence: ['translator', 'pm', 'sa', 'sd', 'pg']
  });
  assert.equal(paused.status, 'paused');
  assert.equal(paused.pendingApproval.kind, 'live-worktree');
  assert.equal(liveCalls.some((call) => call.moduleId === 'pg'), false);

  const completed = await engine.resume(paused.id, { action: 'approve' });
  assert.equal(completed.status, 'green');
  const pgCall = liveCalls.find((call) => call.moduleId === 'pg');
  assert.equal(pgCall.worktree.path, 'C:\\Managed\\run-live');
});

test('Workflow HTTP 只接受 loopback Host', () => {
  assert.equal(isAllowedHost({ headers: { host: '127.0.0.1:8792' } }), true);
  assert.equal(isAllowedHost({ headers: { host: 'localhost:8792' } }), true);
  assert.equal(isAllowedHost({ headers: { host: 'evil.example:8792' } }), false);
  assert.equal(isAllowedHost({ headers: {} }), false);
});

test('Workflow HTTP 提供健康、Session、模組與專案清單', async (t) => {
  const engine = createDeterministicEngine();
  const app = createWorkflowLabServer({
    engine,
    catalog: createWorkflowCatalog(),
    projectValidator: {
      listProjects() {
        return [{ source: 'fleet', path: 'C:\\Project\\demo', name: 'demo' }];
      }
    },
    token: 'workflow-token'
  });
  const address = await app.start(0);
  t.after(() => app.stop());
  const origin = `http://127.0.0.1:${address.port}`;

  const health = await fetch(`${origin}/healthz`).then((response) => response.json());
  assert.equal(health.status, 'ready');

  const session = await fetch(`${origin}/api/session`).then((response) => response.json());
  assert.equal(session.token, 'workflow-token');

  const modules = await fetch(`${origin}/api/modules`).then((response) => response.json());
  assert.equal(modules.modules.some((module) => module.id === 'pm'), true);
  assert.equal(modules.modules.some((module) => 'requiredArtifacts' in module), false);

  const projects = await fetch(`${origin}/api/projects`).then((response) => response.json());
  assert.equal(projects.projects[0].name, 'demo');
});

test('Workflow HTTP 保護寫入 API 並以 detached run 提供輪詢', async (t) => {
  const engine = createDeterministicEngine();
  const app = createWorkflowLabServer({
    engine,
    catalog: createWorkflowCatalog(),
    projectValidator: { listProjects: () => [] },
    token: 'workflow-token'
  });
  const address = await app.start(0);
  t.after(() => app.stop());
  const origin = `http://127.0.0.1:${address.port}`;

  const forbidden = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requirement: '需求', moduleSequence: ['translator'] })
  });
  assert.equal(forbidden.status, 403);

  const secret = 'HTTP-SECRET-7788';
  const accepted = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'X-Pixiu-Workflow-Token': 'workflow-token'
    },
    body: JSON.stringify({
      requirement: `新增流程 ${secret}`,
      sensitiveTerms: [secret],
      moduleSequence: ['translator']
    })
  });
  assert.equal(accepted.status, 202);
  const acceptedPayload = await accepted.json();
  assert.equal(JSON.stringify(acceptedPayload).includes(secret), false);

  await waitFor(() => engine.getSnapshot(acceptedPayload.run.id).status === 'green');
  const runResponse = await fetch(`${origin}/api/runs/${acceptedPayload.run.id}`);
  const runPayload = await runResponse.json();
  assert.equal(runPayload.run.status, 'green');
  assert.equal(JSON.stringify(runPayload).includes(secret), false);

  const refreshedSession = await fetch(`${origin}/api/session`).then((response) => response.json());
  assert.equal(refreshedSession.latestRun.id, acceptedPayload.run.id);
  assert.equal(refreshedSession.latestRun.status, 'green');
  assert.equal(JSON.stringify(refreshedSession).includes(secret), false);

  const artifactId = runPayload.run.artifacts[0].id;
  const artifactResponse = await fetch(
    `${origin}/api/runs/${acceptedPayload.run.id}/artifacts/${artifactId}`
  );
  assert.equal(artifactResponse.status, 200);
  const artifactPayload = await artifactResponse.json();
  assert.equal(JSON.stringify(artifactPayload).includes(secret), false);
});

test('Workflow HTTP 支援 paused approval、reject、cancel 與 active run 409', async (t) => {
  const engine = createDeterministicEngine();
  const app = createWorkflowLabServer({
    engine,
    catalog: createWorkflowCatalog(),
    projectValidator: { listProjects: () => [] },
    token: 'workflow-token'
  });
  const address = await app.start(0);
  t.after(() => app.stop());
  const origin = `http://127.0.0.1:${address.port}`;
  const headers = {
    origin,
    'content-type': 'application/json',
    'X-Pixiu-Workflow-Token': 'workflow-token'
  };

  const pausedResponse = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      requirement: '原文需求',
      inputMode: 'raw-pass-through',
      moduleSequence: ['translator']
    })
  });
  const paused = await pausedResponse.json();
  assert.equal(paused.run.status, 'paused');

  const conflict = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ requirement: '第二個需求', moduleSequence: ['translator'] })
  });
  assert.equal(conflict.status, 409);

  const reject = await fetch(`${origin}/api/runs/${paused.run.id}/reject`, {
    method: 'POST',
    headers,
    body: '{}'
  });
  assert.equal(reject.status, 202);
  await waitFor(() => engine.getSnapshot(paused.run.id).status === 'red');

  const second = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      requirement: '需核准需求',
      inputMode: 'raw-pass-through',
      moduleSequence: ['translator']
    })
  }).then((response) => response.json());
  const approve = await fetch(`${origin}/api/runs/${second.run.id}/approve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'approve' })
  });
  assert.equal(approve.status, 202);
  await waitFor(() => engine.getSnapshot(second.run.id).status === 'green');

  const terminalCancel = await fetch(`${origin}/api/runs/${second.run.id}/cancel`, {
    method: 'POST',
    headers,
    body: '{}'
  });
  assert.equal(terminalCancel.status, 200);
  assert.equal((await terminalCancel.json()).run.status, 'green');
});

test('Workflow UI 提供輸入、模式、編排、核准、結果與 Artifact 契約', () => {
  const staticRoot = path.join(__dirname, 'public');
  const html = fs.readFileSync(path.join(staticRoot, 'index.html'), 'utf8');
  const appScript = fs.readFileSync(path.join(staticRoot, 'app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(staticRoot, 'styles.css'), 'utf8');
  const requiredIds = [
    'requirement-input',
    'business-logic-input',
    'expected-outcome-input',
    'constraints-input',
    'sensitive-terms-input',
    'acceptance-criteria-input',
    'upstream-artifacts-input',
    'mode-offline',
    'mode-live',
    'input-need-to-know',
    'input-raw',
    'selection-single',
    'selection-partial',
    'selection-full',
    'fixture-mode',
    'module-list',
    'advanced-order-toggle',
    'unsafe-order-toggle',
    'project-source',
    'project-fleet',
    'project-path',
    'run-workflow',
    'cancel-run',
    'approval-panel',
    'approval-message',
    'approval-return-module',
    'approve-run',
    'reject-run',
    'run-summary',
    'run-step-list',
    'artifact-list',
    'artifact-viewer',
    'run-log',
    'toast'
  ];

  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `缺少 UI id：${id}`);
  }
  assert.match(appScript, /X-Pixiu-Workflow-Token/);
  assert.match(appScript, /textContent/);
  assert.doesNotMatch(appScript, /localStorage/);
  assert.doesNotMatch(appScript, /sessionStorage/);
  assert.match(styles, /@media/);
  assert.match(styles, /:focus-visible/);
});

test('Workflow HTTP 靜態首頁使用安全標頭並載入 UI', async (t) => {
  const app = createWorkflowLabServer({
    engine: createDeterministicEngine(),
    catalog: createWorkflowCatalog(),
    projectValidator: { listProjects: () => [] },
    token: 'workflow-token',
    staticRoot: path.join(__dirname, 'public')
  });
  const address = await app.start(0);
  t.after(() => app.stop());
  const response = await fetch(`http://127.0.0.1:${address.port}/`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(await response.text(), /PixiuCore Workflow Lab/);
});

test('Workflow HTTP 拒絕跨來源、錯誤 JSON、過大 body 與未知路由', async (t) => {
  const app = createWorkflowLabServer({
    engine: createDeterministicEngine(),
    catalog: createWorkflowCatalog(),
    projectValidator: { listProjects: () => [] },
    token: 'workflow-token',
    maxBodyBytes: 64
  });
  const address = await app.start(0);
  t.after(() => app.stop());
  const origin = `http://127.0.0.1:${address.port}`;

  const crossOrigin = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers: {
      origin: 'http://evil.example',
      'content-type': 'application/json',
      'X-Pixiu-Workflow-Token': 'workflow-token'
    },
    body: '{}'
  });
  assert.equal(crossOrigin.status, 403);

  const invalidJson = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'X-Pixiu-Workflow-Token': 'workflow-token'
    },
    body: '{'
  });
  assert.equal(invalidJson.status, 400);

  const oversized = await fetch(`${origin}/api/runs`, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'X-Pixiu-Workflow-Token': 'workflow-token'
    },
    body: JSON.stringify({ requirement: 'x'.repeat(100) })
  });
  assert.equal(oversized.status, 413);

  const missing = await fetch(`${origin}/missing`);
  assert.equal(missing.status, 404);
});
