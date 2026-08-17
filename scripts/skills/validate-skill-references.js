#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalize(content) {
  return String(content).replace(/\r\n/g, '\n').trimEnd();
}

function validateSkillReferences(root, manifest) {
  const errors = [];
  const skills = manifest?.skills || {};

  for (const [name, config] of Object.entries(skills)) {
    for (const reference of config.references || []) {
      const absolute = path.resolve(root, reference);
      if (!absolute.startsWith(path.resolve(root) + path.sep)) {
        errors.push(`${name}: reference 超出 repo：${reference}`);
      } else if (!fs.existsSync(absolute)) {
        errors.push(`${name}: reference 不存在：${reference}`);
      }
    }

    const sourcePath = path.join(root, 'skills', name, 'SKILL.md');
    const publishedPath = path.join(root, '.agents', 'skills', name, 'SKILL.md');
    if (!fs.existsSync(sourcePath) || !fs.existsSync(publishedPath)) continue;

    if (normalize(fs.readFileSync(sourcePath, 'utf8')) !== normalize(fs.readFileSync(publishedPath, 'utf8'))) {
      errors.push(`${name}: .agents/skills 發佈層與 skills/ 來源不同步`);
    }
  }

  return { skillsChecked: Object.keys(skills).length, errors };
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || '.');
  const manifestPath = path.resolve(process.argv[3] || path.join(root, 'vault', 'capabilities', 'skill-dependency-manifest.json'));
  try {
    const result = validateSkillReferences(root, loadJson(manifestPath));
    process.stdout.write(`已檢查 ${result.skillsChecked} 個納管 Skill 的 reference 與發佈同步。\n`);
    if (result.errors.length) {
      result.errors.forEach(error => process.stderr.write(`- ${error}\n`));
      process.exitCode = 1;
    } else {
      process.stdout.write('Skill reference 與發佈同步驗證通過。\n');
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { loadJson, validateSkillReferences };
