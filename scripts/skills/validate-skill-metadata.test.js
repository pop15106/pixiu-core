#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const validator = require('./validate-skill-metadata');

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-skill-validation-'));
}

function writeSkill(root, dir, content) {
  const target = path.join(root, dir);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'SKILL.md'), content, 'utf8');
}

function testValidSkillPasses() {
  const root = makeRoot();
  writeSkill(root, 'valid-skill', '---\nname: valid-skill\ndescription: "有效技能說明"\n---\n# Valid\n');
  const result = validator.validateSkillRoot(root);
  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.skills.length, 1);
}

function testMissingDescriptionFails() {
  const root = makeRoot();
  writeSkill(root, 'missing-description', '---\nname: missing-description\n---\n# Missing\n');
  const result = validator.validateSkillRoot(root);
  assert.match(result.errors.join('\n'), /description/);
}

function testDuplicateNameFails() {
  const root = makeRoot();
  writeSkill(root, 'one', '---\nname: duplicate\ndescription: "第一份"\n---\n');
  writeSkill(root, 'two', '---\nname: duplicate\ndescription: "第二份"\n---\n');
  const result = validator.validateSkillRoot(root);
  assert.match(result.errors.join('\n'), /duplicate/);
}

function testIndexMarkdownIsIgnored() {
  const root = makeRoot();
  fs.writeFileSync(path.join(root, 'INDEX.md'), '# 索引\n', 'utf8');
  const result = validator.validateSkillRoot(root);
  assert.deepStrictEqual(result.errors, []);
  assert.strictEqual(result.skills.length, 0);
}

function testFileRootReturnsStructuredError() {
  const root = path.join(os.tmpdir(), `pixiu-skill-file-root-${Date.now()}-${Math.random()}`);
  fs.writeFileSync(root, 'not a directory', 'utf8');
  const result = validator.validateSkillRoot(root);
  assert.deepStrictEqual(result.skills, []);
  assert.match(result.errors.join('\n'), /不是目錄/);
}

const tests = [
  testValidSkillPasses,
  testMissingDescriptionFails,
  testDuplicateNameFails,
  testIndexMarkdownIsIgnored,
  testFileRootReturnsStructuredError
];

for (const test of tests) {
  test();
  process.stdout.write(`ok ${test.name}\n`);
}
