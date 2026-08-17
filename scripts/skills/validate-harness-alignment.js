#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('./validate-skill-metadata');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseBoolean(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

function parseOpenAiPolicy(content) {
  const match = String(content).match(/^\s*allow_implicit_invocation:\s*(true|false)\s*$/m);
  return match ? match[1] === 'true' : null;
}

function validateHarnessAlignment(root, manifest) {
  const errors = [];
  const skills = manifest?.skills || {};

  for (const [name, config] of Object.entries(skills)) {
    const sourcePath = path.join(root, 'skills', name, 'SKILL.md');
    const publishedPath = path.join(root, '.agents', 'skills', name, 'SKILL.md');
    const openaiPath = path.join(root, '.agents', 'skills', name, 'agents', 'openai.yaml');

    if (!fs.existsSync(sourcePath)) {
      errors.push(`${name}: 缺少 source SKILL.md`);
      continue;
    }
    if (!fs.existsSync(publishedPath)) {
      errors.push(`${name}: 缺少 .agents 發佈層 SKILL.md`);
      continue;
    }
    if (!fs.existsSync(openaiPath)) {
      errors.push(`${name}: 缺少 agents/openai.yaml`);
      continue;
    }

    const sourceParsed = parseFrontmatter(fs.readFileSync(sourcePath, 'utf8'));
    const publishedParsed = parseFrontmatter(fs.readFileSync(publishedPath, 'utf8'));
    if (sourceParsed.error) errors.push(`${name}: source ${sourceParsed.error}`);
    if (publishedParsed.error) errors.push(`${name}: published ${publishedParsed.error}`);
    if (sourceParsed.error || publishedParsed.error) continue;

    if (sourceParsed.metadata.name !== name || publishedParsed.metadata.name !== name) {
      errors.push(`${name}: source/published frontmatter name 不一致`);
    }

    const claudeDisable = parseBoolean(sourceParsed.metadata['disable-model-invocation']);
    const codexImplicit = parseOpenAiPolicy(fs.readFileSync(openaiPath, 'utf8'));
    if (codexImplicit === null) {
      errors.push(`${name}: openai.yaml 缺少 allow_implicit_invocation`);
      continue;
    }

    if (config.invocation === 'user') {
      if (claudeDisable !== true) errors.push(`${name}: user-invoked Skill 必須設定 disable-model-invocation: true`);
      if (codexImplicit !== false) errors.push(`${name}: user-invoked Skill 的 allow_implicit_invocation 必須為 false`);
    } else if (config.invocation === 'model') {
      if (claudeDisable === true) errors.push(`${name}: model-invoked Skill 不得 disable model invocation`);
      if (codexImplicit !== true) errors.push(`${name}: model-invoked Skill 的 allow_implicit_invocation 必須為 true`);
    }
  }

  return { skillsChecked: Object.keys(skills).length, errors };
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || '.');
  const manifestPath = path.resolve(process.argv[3] || path.join(root, 'vault', 'capabilities', 'skill-dependency-manifest.json'));
  try {
    const result = validateHarnessAlignment(root, loadJson(manifestPath));
    process.stdout.write(`已檢查 ${result.skillsChecked} 個納管 Skill 的跨 Harness policy。\n`);
    if (result.errors.length) {
      result.errors.forEach(error => process.stderr.write(`- ${error}\n`));
      process.exitCode = 1;
    } else {
      process.stdout.write('Claude／Codex invocation policy 一致。\n');
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { loadJson, parseOpenAiPolicy, validateHarnessAlignment };
