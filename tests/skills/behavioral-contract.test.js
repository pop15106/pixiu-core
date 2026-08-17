'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  evaluateScenario,
  validateBehaviorFixtures
} = require('../../scripts/skills/evaluate-behavioral-contract');

const root = path.resolve(__dirname, '..', '..');
const fixturesDir = path.join(root, 'tests', 'skills', 'fixtures');

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, name), 'utf8'));
}

test('Behavioral fixtures 全數符合契約', () => {
  const names = [
    'decision-grilling-positive.json',
    'decision-grilling-negative.json',
    'side-effect-guard.json',
    'cross-harness-parity.json',
    'decision-trace.json'
  ];
  const result = validateBehaviorFixtures(names.flatMap(name => fixture(name)));
  assert.deepEqual(result.failures, []);
  assert.ok(result.total >= 20);
});

test('預設一次只問一個主問題，只有 --batch 才可多題', () => {
  assert.equal(evaluateScenario({ requiresDecision: true }).maxQuestions, 1);
  assert.equal(evaluateScenario({ requiresDecision: true, batch: true }).maxQuestions, Infinity);
});

test('repo 可查的 fact 不應詢問使用者', () => {
  const result = evaluateScenario({ requiresDecision: false, factResolvable: true });
  assert.equal(result.askUser, false);
  assert.equal(result.resolveFactFirst, true);
});

test('未核准前禁止寫入、派工與 implementation', () => {
  const result = evaluateScenario({ requiresDecision: true, approved: false, sharedUnderstanding: false });
  assert.equal(result.mayWriteFormalSource, false);
  assert.equal(result.maySpawnAgent, false);
  assert.equal(result.mayImplement, false);
});
