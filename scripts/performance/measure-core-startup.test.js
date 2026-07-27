#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const measure = require('./measure-core-startup');

function testCountsDuplicateSkillNamesAcrossRoots() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-startup-measure-'));
  const first = path.join(root, 'first');
  const second = path.join(root, 'second');
  fs.mkdirSync(path.join(first, 'alpha'), { recursive: true });
  fs.mkdirSync(path.join(second, 'alpha'), { recursive: true });
  fs.writeFileSync(path.join(first, 'alpha', 'SKILL.md'), '---\nname: alpha\ndescription: "A"\n---\n');
  fs.writeFileSync(path.join(second, 'alpha', 'SKILL.md'), '---\nname: alpha\ndescription: "B"\n---\n');

  const result = measure.measureSkillRoots([first, second]);
  assert.strictEqual(result.skillsDiscovered, 2);
  assert.strictEqual(result.skillNameCollisions, 1);
}

function testMeasuresStartupFileBytes() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-startup-files-'));
  fs.writeFileSync(path.join(root, 'one.md'), '12345', 'utf8');
  const result = measure.measureStartupFiles(root, ['one.md', 'missing.md']);
  assert.strictEqual(result.startupFilesBytes, 5);
  assert.deepStrictEqual(result.missingStartupFiles, ['missing.md']);
}

function testBuildsNamedStartupProfiles() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-startup-profiles-'));
  fs.mkdirSync(path.join(root, 'vault', 'bootstrap'), { recursive: true });
  fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(root, 'AGENTS.md'), 'agents', 'utf8');
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), 'claude', 'utf8');
  fs.writeFileSync(path.join(root, 'GEMINI.md'), 'gemini', 'utf8');
  fs.writeFileSync(path.join(root, '.codex', 'AGENTS.md'), 'codex', 'utf8');
  fs.writeFileSync(path.join(root, 'vault', 'bootstrap', 'SESSION-BOOTSTRAP.md'), 'bootstrap', 'utf8');

  const profiles = measure.measureStartupProfiles(root);
  assert.deepStrictEqual(Object.keys(profiles), ['codex', 'claude', 'gemini']);
  assert.deepStrictEqual(profiles.codex.files, [
    'AGENTS.md',
    'vault/bootstrap/SESSION-BOOTSTRAP.md',
    '.codex/AGENTS.md'
  ]);
  assert.strictEqual(profiles.codex.budgetBytes, 8192);
  assert.strictEqual(profiles.claude.budgetBytes, 6144);
  assert.strictEqual(profiles.gemini.budgetBytes, 6144);
  assert.strictEqual(profiles.codex.withinBudget, true);
  assert.strictEqual(profiles.claude.withinBudget, true);
  assert.strictEqual(profiles.gemini.withinBudget, true);
  assert.deepStrictEqual(profiles.codex.missingStartupFiles, []);
}

function testBuildReportKeepsCodexCompatibilityFields() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-startup-report-'));
  fs.mkdirSync(path.join(root, 'vault', 'bootstrap'), { recursive: true });
  fs.mkdirSync(path.join(root, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(root, 'AGENTS.md'), 'agents', 'utf8');
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), 'claude', 'utf8');
  fs.writeFileSync(path.join(root, 'GEMINI.md'), 'gemini', 'utf8');
  fs.writeFileSync(path.join(root, '.codex', 'AGENTS.md'), 'codex', 'utf8');
  fs.writeFileSync(path.join(root, 'vault', 'bootstrap', 'SESSION-BOOTSTRAP.md'), 'bootstrap', 'utf8');

  const report = measure.buildReport(root);
  assert.deepStrictEqual(report.startupProfiles.codex.files, report.startupFiles);
  assert.strictEqual(report.startupProfiles.codex.startupFilesBytes, report.startupFilesBytes);
  assert.strictEqual(report.startupProfiles.codex.startupFilesLines, report.startupFilesLines);
}

function testDetectsPixiuCanonicalPublishingLayer() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-skill-suppression-'));
  const canonical = path.join(root, 'skills');
  const portable = path.join(root, '.agents', 'skills');
  fs.mkdirSync(path.join(root, 'vault', 'bootstrap'), { recursive: true });
  fs.writeFileSync(path.join(root, 'vault', 'bootstrap', 'SESSION-BOOTSTRAP.md'), '# bootstrap\n', 'utf8');
  fs.mkdirSync(path.join(canonical, 'shared'), { recursive: true });
  fs.mkdirSync(path.join(canonical, 'canonical-only'), { recursive: true });
  fs.mkdirSync(path.join(portable, 'shared'), { recursive: true });
  fs.writeFileSync(path.join(canonical, 'shared', 'SKILL.md'), 'canonical\n', 'utf8');
  fs.writeFileSync(path.join(canonical, 'canonical-only', 'SKILL.md'), 'canonical only\n', 'utf8');
  fs.writeFileSync(path.join(portable, 'shared', 'SKILL.md'), 'portable drift\n', 'utf8');

  const eligible = measure.measurePixiuSkillSuppression(root, canonical);
  assert.strictEqual(eligible.pixiuCanonicalSuppressionEligible, true);
  assert.strictEqual(eligible.portableSkillNamesCovered, true);
  assert.strictEqual(eligible.effectiveSkillNameCollisions, 0);

  fs.mkdirSync(path.join(portable, 'portable-only'), { recursive: true });
  fs.writeFileSync(path.join(portable, 'portable-only', 'SKILL.md'), 'portable only\n', 'utf8');
  const ineligible = measure.measurePixiuSkillSuppression(root, canonical);
  assert.strictEqual(ineligible.pixiuCanonicalSuppressionEligible, false);
  assert.strictEqual(ineligible.portableSkillNamesCovered, false);
  assert.strictEqual(ineligible.effectiveSkillNameCollisions, 1);
}

const tests = [
  testCountsDuplicateSkillNamesAcrossRoots,
  testMeasuresStartupFileBytes,
  testBuildsNamedStartupProfiles,
  testBuildReportKeepsCodexCompatibilityFields,
  testDetectsPixiuCanonicalPublishingLayer
];
for (const test of tests) {
  test();
  process.stdout.write(`ok ${test.name}\n`);
}
