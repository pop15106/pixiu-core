'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  loadJson,
  validateHarnessAlignment
} = require('../../scripts/skills/validate-harness-alignment');

const root = path.resolve(__dirname, '..', '..');
const manifestPath = path.join(root, 'vault', 'capabilities', 'skill-dependency-manifest.json');

test('納管 Skill 的 Claude／Codex invocation policy 一致', () => {
  const result = validateHarnessAlignment(root, loadJson(manifestPath));
  assert.deepEqual(result.errors, []);
  assert.ok(result.skillsChecked >= 8);
});

test('user-invoked Skill 必須禁止 Codex implicit invocation', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-harness-'));
  try {
    const sourceDir = path.join(tempRoot, 'skills', 'demo');
    const publishedDir = path.join(tempRoot, '.agents', 'skills', 'demo');
    fs.mkdirSync(path.join(publishedDir, 'agents'), { recursive: true });
    fs.mkdirSync(sourceDir, { recursive: true });

    const skill = '---\ndisable-model-invocation: true\nname: demo\ndescription: demo\n---\n# Demo\n';
    fs.writeFileSync(path.join(sourceDir, 'SKILL.md'), skill);
    fs.writeFileSync(path.join(publishedDir, 'SKILL.md'), skill);
    fs.writeFileSync(
      path.join(publishedDir, 'agents', 'openai.yaml'),
      'interface:\n  display_name: "Demo"\n  short_description: "Demo"\npolicy:\n  allow_implicit_invocation: true\n'
    );

    const manifest = {
      skills: {
        demo: {
          invocation: 'user',
          requires: [],
          optional: [],
          sideEffects: 'none'
        }
      }
    };

    const result = validateHarnessAlignment(tempRoot, manifest);
    assert.ok(result.errors.some(error => error.includes('allow_implicit_invocation')));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
