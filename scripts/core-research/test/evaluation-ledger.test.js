'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { mkdtemp } = require('node:fs/promises');

const { normalizeCandidate } = require('../candidate-schema');
const { scoreCandidate } = require('../candidate-scorer');
const { buildEvaluationTask } = require('../evaluation-task-builder');
const {
  appendEvaluationEvent,
  deriveEvaluationStates,
  readEvaluationLedger,
  recordHumanApproval,
} = require('../evaluation-ledger');

function createTask() {
  const candidate = normalizeCandidate({
    resourceType: 'repository',
    title: 'Ledger Fixture',
    canonicalUri: 'https://github.com/example/ledger-fixture',
    publisher: 'example',
    publishedAt: '2026-07-20T00:00:00Z',
    updatedAt: '2026-07-23T00:00:00Z',
    discoveredAt: '2026-07-23T02:00:00Z',
    commitSha: 'a'.repeat(40),
    license: 'MIT',
    categories: ['security-testing'],
    summary: 'Ledger 測試',
    evidence: [{ source: 'https://github.com/example/ledger-fixture', note: 'fixture' }],
    metrics: {
      coreFit: 95,
      expectedValue: 90,
      novelty: 85,
      maturity: 85,
      feasibility: 90,
      evidenceQuality: 90,
      trust: 95,
    },
    riskFlags: [],
  });
  return buildEvaluationTask({
    selectionEntry: { candidate, score: scoreCandidate(candidate) },
    stateRoot: 'C:/pixiu/state/core-research',
    artifactRoot: 'C:/pixiu/artifacts/core-research',
    createdAt: '2026-07-23T03:00:00Z',
  });
}

async function createLedgerPath() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pixiu-evaluation-ledger-'));
  return path.join(directory, 'ledger.jsonl');
}

async function appendLifecycleToApproval(ledgerPath, task, options = {}) {
  await appendEvaluationEvent({
    ledgerPath,
    task,
    eventType: 'EVALUATION_PREPARED',
    eventAt: '2026-07-23T03:00:00Z',
    payload: { artifactDir: task.artifactDir },
  });
  await appendEvaluationEvent({
    ledgerPath,
    task,
    eventType: 'WORKSPACE_SCANNED',
    eventAt: '2026-07-23T04:00:00Z',
    payload: { highFindings: options.highFindings || 0 },
  });
  await appendEvaluationEvent({
    ledgerPath,
    task,
    eventType: 'EVIDENCE_RECORDED',
    eventAt: '2026-07-23T05:00:00Z',
    payload: {
      sandboxStatus: options.sandboxStatus || 'PASS',
      concerns: options.concerns || [],
    },
  });
  await appendEvaluationEvent({
    ledgerPath,
    task,
    eventType: 'REVIEW_READY',
    eventAt: '2026-07-23T05:01:00Z',
    payload: {
      reviewState: options.reviewState || 'AWAITING_APPROVAL',
    },
  });
}

test('Ledger 以 append-only JSONL 保存事件並衍生狀態', async () => {
  const task = createTask();
  const ledgerPath = await createLedgerPath();
  await appendLifecycleToApproval(ledgerPath, task);

  const events = await readEvaluationLedger(ledgerPath);
  const states = deriveEvaluationStates(events);

  assert.equal(events.length, 4);
  assert.equal(states[task.taskId].state, 'AWAITING_APPROVAL');
  assert.equal(states[task.taskId].taskDigest, task.integrity.value);
  assert.ok(events.every((event) => /^[a-f0-9]{64}$/.test(event.integrity.value)));
});

test('同一 Task 的 Digest 不一致時拒絕追加', async () => {
  const task = createTask();
  const ledgerPath = await createLedgerPath();
  await appendEvaluationEvent({
    ledgerPath,
    task,
    eventType: 'EVALUATION_PREPARED',
    eventAt: '2026-07-23T03:00:00Z',
    payload: {},
  });
  const tampered = {
    ...task,
    integrity: { algorithm: 'sha256', value: '0'.repeat(64) },
  };

  await assert.rejects(
    () => appendEvaluationEvent({
      ledgerPath,
      task: tampered,
      eventType: 'WORKSPACE_SCANNED',
      eventAt: '2026-07-23T04:00:00Z',
      payload: {},
    }),
    (error) => [
      'EVALUATION_TASK_INTEGRITY_MISMATCH',
      'EVALUATION_TASK_DIGEST_MISMATCH',
    ].includes(error.code),
  );
});

test('Sandbox unavailable 會衍生 REVIEW_READY_WITH_CONCERNS', async () => {
  const task = createTask();
  const ledgerPath = await createLedgerPath();
  await appendEvaluationEvent({
    ledgerPath,
    task,
    eventType: 'EVALUATION_PREPARED',
    eventAt: '2026-07-23T03:00:00Z',
    payload: {},
  });
  await appendEvaluationEvent({
    ledgerPath,
    task,
    eventType: 'WORKSPACE_SCANNED',
    eventAt: '2026-07-23T04:00:00Z',
    payload: {},
  });
  await appendEvaluationEvent({
    ledgerPath,
    task,
    eventType: 'EVIDENCE_RECORDED',
    eventAt: '2026-07-23T05:00:00Z',
    payload: {
      sandboxStatus: 'SKIPPED_UNAVAILABLE',
      concerns: ['SANDBOX_UNAVAILABLE'],
    },
  });

  const states = deriveEvaluationStates(await readEvaluationLedger(ledgerPath));

  assert.equal(states[task.taskId].state, 'REVIEW_READY_WITH_CONCERNS');
});

test('只有 human actor 可以在 AWAITING_APPROVAL 核准', async () => {
  const task = createTask();
  const ledgerPath = await createLedgerPath();
  await appendLifecycleToApproval(ledgerPath, task);

  await assert.rejects(
    () => recordHumanApproval({
      ledgerPath,
      taskId: task.taskId,
      decision: 'approve-plan',
      actor: 'agent:codex',
      comment: '自動核准',
      decidedAt: '2026-07-23T06:00:00Z',
    }),
    (error) => error.code === 'APPROVAL_HUMAN_REQUIRED',
  );
});

test('人工 approve-plan 只轉成 APPROVED_FOR_PLAN', async () => {
  const task = createTask();
  const ledgerPath = await createLedgerPath();
  await appendLifecycleToApproval(ledgerPath, task);

  const event = await recordHumanApproval({
    ledgerPath,
    taskId: task.taskId,
    decision: 'approve-plan',
    actor: 'human:7010',
    comment: '核准另開正式實作計畫，不直接整合。',
    decidedAt: '2026-07-23T06:00:00Z',
  });
  const states = deriveEvaluationStates(await readEvaluationLedger(ledgerPath));

  assert.equal(event.payload.resultState, 'APPROVED_FOR_PLAN');
  assert.equal(states[task.taskId].state, 'APPROVED_FOR_PLAN');
  assert.notEqual(states[task.taskId].state, 'INTEGRATED');
});

test('尚未 AWAITING_APPROVAL 不可核准', async () => {
  const task = createTask();
  const ledgerPath = await createLedgerPath();
  await appendEvaluationEvent({
    ledgerPath,
    task,
    eventType: 'EVALUATION_PREPARED',
    eventAt: '2026-07-23T03:00:00Z',
    payload: {},
  });

  await assert.rejects(
    () => recordHumanApproval({
      ledgerPath,
      taskId: task.taskId,
      decision: 'reject',
      actor: 'human:7010',
      comment: '尚未完成評估。',
      decidedAt: '2026-07-23T04:00:00Z',
    }),
    (error) => error.code === 'APPROVAL_STATE_INVALID',
  );
});

test('核准註解必填且 decision 僅允許三種', async () => {
  const task = createTask();
  const ledgerPath = await createLedgerPath();
  await appendLifecycleToApproval(ledgerPath, task);

  await assert.rejects(
    () => recordHumanApproval({
      ledgerPath,
      taskId: task.taskId,
      decision: 'integrate',
      actor: 'human:7010',
      comment: '直接整合',
    }),
    (error) => error.code === 'APPROVAL_DECISION_INVALID',
  );
  await assert.rejects(
    () => recordHumanApproval({
      ledgerPath,
      taskId: task.taskId,
      decision: 'defer',
      actor: 'human:7010',
      comment: '   ',
    }),
    (error) => error.code === 'APPROVAL_COMMENT_REQUIRED',
  );
});
