#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseFrontmatter } = require('./validate-skill-metadata');

const ALLOWED_INVOCATIONS = new Set(['user', 'model']);
const ALLOWED_SIDE_EFFECTS = new Set(['none', 'proposal-only', 'approval-required']);

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sourceSkillPath(root, name) {
  return path.join(root, 'skills', name, 'SKILL.md');
}

function dependencyExists(root, manifest, name) {
  return Boolean(manifest.skills?.[name]) || fs.existsSync(sourceSkillPath(root, name));
}

function findCycles(manifest) {
  const skills = manifest.skills || {};
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];

  function visit(name, stack) {
    if (visiting.has(name)) {
      const start = stack.indexOf(name);
      cycles.push([...stack.slice(start), name]);
      return;
    }
    if (visited.has(name) || !skills[name]) return;

    visiting.add(name);
    for (const dependency of skills[name].requires || []) {
      if (skills[dependency]) visit(dependency, [...stack, name]);
    }
    visiting.delete(name);
    visited.add(name);
  }

  for (const name of Object.keys(skills)) visit(name, []);
  return cycles;
}

function validateDependencyManifest(root, manifest, options = {}) {
  const errors = [];
  const skills = manifest?.skills || {};
  const checkFiles = options.checkFiles !== false;

  for (const [name, config] of Object.entries(skills)) {
    if (!ALLOWED_INVOCATIONS.has(config.invocation)) {
      errors.push(`${name}: invocation 必須是 user 或 model`);
    }
    if (!ALLOWED_SIDE_EFFECTS.has(config.sideEffects)) {
      errors.push(`${name}: sideEffects 非法：${config.sideEffects}`);
    }

    for (const field of ['requires', 'optional']) {
      if (!Array.isArray(config[field] || [])) {
        errors.push(`${name}: ${field} 必須是陣列`);
        continue;
      }
      for (const dependency of config[field] || []) {
        if (!dependencyExists(root, manifest, dependency)) {
          errors.push(`${name}: 找不到 ${field} dependency "${dependency}"`);
        }
      }
    }

    if (!checkFiles) continue;

    const skillPath = sourceSkillPath(root, name);
    if (!fs.existsSync(skillPath)) {
      errors.push(`${name}: Skill 不存在：${path.relative(root, skillPath)}`);
      continue;
    }

    const parsed = parseFrontmatter(fs.readFileSync(skillPath, 'utf8'));
    if (parsed.error) {
      errors.push(`${name}: ${parsed.error}`);
    } else if (parsed.metadata.name !== name) {
      errors.push(`${name}: frontmatter name 為 "${parsed.metadata.name || ''}"`);
    }

    for (const reference of config.references || []) {
      const absolute = path.resolve(root, reference);
      if (!absolute.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(absolute)) {
        errors.push(`${name}: reference 不存在或超出 repo：${reference}`);
      }
    }
  }

  for (const cycle of findCycles(manifest)) {
    errors.push(`dependency cycle: ${cycle.join(' -> ')}`);
  }

  return { skillsChecked: Object.keys(skills).length, errors };
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || '.');
  const manifestPath = path.resolve(
    process.argv[3] || path.join(root, 'vault', 'capabilities', 'skill-dependency-manifest.json')
  );

  try {
    const result = validateDependencyManifest(root, loadJson(manifestPath));
    process.stdout.write(`已檢查 ${result.skillsChecked} 個納管 Skill。\n`);
    if (result.errors.length > 0) {
      for (const error of result.errors) process.stderr.write(`- ${error}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write('Skill dependency 驗證通過。\n');
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  loadJson,
  findCycles,
  validateDependencyManifest
};
