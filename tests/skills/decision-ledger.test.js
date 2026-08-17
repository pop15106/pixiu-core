'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  DECISION_STATUSES,
  isFrontierCandidate,
  computeFrontier,
  reopenDecision
} = require('../../scripts/skills/decision-ledger');

test('Decision Ledger schema 可解析且包含正式 resolver/status', () => {
  const schemaPath = path.resolve(__dirname, '..', '..', 'vault', 'schemas', 'decision-ledger.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const item = schema.properties.decisions.items.properties;
  assert.ok(item.type.enum.includes('EXTERNAL_EXPERT'));
  assert.ok(item.status.enum.includes('REOPENED'));
  assert.deepEqual(item.traceLinks.required, ['spec', 'acceptanceCriteria', 'tickets', 'tests', 'adrs']);
});

test('Decision Ledger 使用固定狀態集合', () => {
  assert.deepEqual(DECISION_STATUSES, [
    'OPEN',
    'BLOCKED_BY_FACT',
    'READY_TO_ASK',
    'RESOLVED',
    'REOPENED',
    'DEFERRED',
    'OUT_OF_SCOPE',
    'INVALIDATED'
  ]);
});

test('只有前置決策已完成且沒有 fact blocker 的決策可進 Frontier', () => {
  const decisions = [
    { id: 'D-001', status: 'RESOLVED' },
    { id: 'D-002', status: 'OPEN', prerequisites: ['D-001'], blockedByFacts: [] },
    { id: 'D-003', status: 'OPEN', prerequisites: ['D-004'], blockedByFacts: [] },
    { id: 'D-004', status: 'OPEN', prerequisites: [], blockedByFacts: ['repo-fact'] }
  ];

  assert.equal(isFrontierCandidate(decisions[1], decisions), true);
  assert.equal(isFrontierCandidate(decisions[2], decisions), false);
  assert.equal(isFrontierCandidate(decisions[3], decisions), false);
});

test('Frontier 依 P0、下游解鎖數與不可逆性排序', () => {
  const decisions = [
    { id: 'D-001', status: 'OPEN', priority: 'P1', downstream: ['D-010'], irreversible: false },
    { id: 'D-002', status: 'OPEN', priority: 'P0', downstream: [], irreversible: false },
    { id: 'D-003', status: 'OPEN', priority: 'P0', downstream: ['D-011', 'D-012'], irreversible: true }
  ];

  assert.deepEqual(computeFrontier(decisions).map(item => item.id), ['D-003', 'D-002', 'D-001']);
});

test('有 dependency 的兩題不會同時進 Frontier', () => {
  const decisions = [
    { id: 'D-001', status: 'OPEN', prerequisites: [], blockedByFacts: [] },
    { id: 'D-002', status: 'OPEN', prerequisites: ['D-001'], blockedByFacts: [] }
  ];

  assert.deepEqual(computeFrontier(decisions).map(item => item.id), ['D-001']);
});

test('reopen 保留舊 resolution 並打開受影響下游', () => {
  const decisions = [
    {
      id: 'D-001',
      status: 'RESOLVED',
      resolution: '單租戶',
      rationale: '降低第一版風險',
      downstream: ['D-002']
    },
    {
      id: 'D-002',
      status: 'RESOLVED',
      resolution: '共用 schema',
      prerequisites: ['D-001']
    }
  ];

  const result = reopenDecision(decisions, 'D-001', '使用者改成多租戶', '2026-08-14T00:00:00.000Z');
  const root = result.find(item => item.id === 'D-001');
  const downstream = result.find(item => item.id === 'D-002');

  assert.equal(root.status, 'REOPENED');
  assert.equal(root.resolution, null);
  assert.equal(root.history[0].resolution, '單租戶');
  assert.equal(root.reopenReason, '使用者改成多租戶');
  assert.equal(downstream.status, 'OPEN');
});
