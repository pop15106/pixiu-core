'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  loadJson,
  validateDependencyManifest
} = require('../../scripts/skills/validate-skill-dependencies');

const root = path.resolve(__dirname, '..', '..');
const manifestPath = path.join(root, 'vault', 'capabilities', 'skill-dependency-manifest.json');

test('Skill Dependency Manifest 可解析且沒有缺失依賴或 cycle', () => {
  const manifest = loadJson(manifestPath);
  const result = validateDependencyManifest(root, manifest);
  assert.deepEqual(result.errors, []);
  assert.ok(result.skillsChecked >= 8);
});

test('缺少 primitive 會被阻擋', () => {
  const fixture = {
    skills: {
      wrapper: {
        invocation: 'user',
        requires: ['missing-primitive'],
        optional: [],
        sideEffects: 'none'
      }
    }
  };

  const result = validateDependencyManifest(root, fixture, { checkFiles: false });
  assert.ok(result.errors.some(error => error.includes('missing-primitive')));
});

test('Circular dependency 會被阻擋', () => {
  const fixture = {
    skills: {
      alpha: { invocation: 'user', requires: ['beta'], optional: [], sideEffects: 'none' },
      beta: { invocation: 'model', requires: ['alpha'], optional: [], sideEffects: 'none' }
    }
  };

  const result = validateDependencyManifest(root, fixture, { checkFiles: false });
  assert.ok(result.errors.some(error => error.includes('cycle')));
});
