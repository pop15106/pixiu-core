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

const tests = [testCountsDuplicateSkillNamesAcrossRoots, testMeasuresStartupFileBytes];
for (const test of tests) {
  test();
  process.stdout.write(`ok ${test.name}\n`);
}
