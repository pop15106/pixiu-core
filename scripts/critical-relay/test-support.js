'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { bindPlan } = require('./test-plan');

const passing = "const test = require('node:test'); const assert = require('node:assert/strict'); test('中性測試', () => assert.equal(1 + 1, 2));\n";

function makeFixture(t, sources = [passing], changePlan = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu 證據 fixture '));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = args => execFileSync('git', args, { cwd: root, windowsHide: true, stdio: 'pipe' });
  git(['init', '--quiet']);
  fs.writeFileSync(path.join(root, '.gitignore'), '/.cr/\n');
  sources.forEach((source, index) => { if (source !== null) fs.writeFileSync(path.join(root, `sample-${index}.test.js`), source); });
  const plan = {
    schemaVersion: 'pixiu.test-plan.v1', id: 'fixture', revision: 1, profile: 'local-only',
    criteria: [{ id: 'criterion-fixture', requiredEvidenceKinds: ['test'] }],
    commands: sources.map((source, index) => ({ id: `command-${index}`, adapter: 'node-test',
      file: `sample-${index}.test.js`, evidenceKind: 'test', required: true, timeoutMs: 15000,
      criterionRefs: ['criterion-fixture'] }))
  };
  changePlan(plan);
  fs.writeFileSync(path.join(root, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
  git(['add', '.']);
  git(['-c', 'user.name=CR Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'core.hooksPath=NUL',
    'commit', '--quiet', '-m', '中性測試基準']);
  return { root, plan, planPath: 'plan.json', binding: bindPlan(root, 'plan.json'), git };
}

module.exports = { makeFixture, passing };
