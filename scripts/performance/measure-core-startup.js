#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseFrontmatter } = require('../skills/validate-skill-metadata');

function listSkills(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(root, entry.name, 'SKILL.md'))
    .filter(file => fs.existsSync(file))
    .map(file => {
      const parsed = parseFrontmatter(fs.readFileSync(file, 'utf8'));
      return {
        path: file,
        name: parsed.metadata && parsed.metadata.name ? parsed.metadata.name : path.basename(path.dirname(file)),
        parseError: parsed.error || null
      };
    });
}

function measureSkillRoots(roots) {
  const skills = roots.flatMap(root => listSkills(root));
  const counts = new Map();
  let yamlWarnings = 0;

  for (const skill of skills) {
    counts.set(skill.name, (counts.get(skill.name) || 0) + 1);
    if (skill.parseError) yamlWarnings += 1;
  }

  return {
    skillRoots: roots.length,
    skillsDiscovered: skills.length,
    skillNameCollisions: [...counts.values()].filter(count => count > 1).length,
    yamlWarnings
  };
}

function measureStartupFiles(root, relativeFiles) {
  let startupFilesBytes = 0;
  let startupFilesLines = 0;
  const missingStartupFiles = [];

  for (const relativeFile of relativeFiles) {
    const target = path.join(root, relativeFile);
    if (!fs.existsSync(target)) {
      missingStartupFiles.push(relativeFile);
      continue;
    }
    const content = fs.readFileSync(target);
    startupFilesBytes += content.length;
    startupFilesLines += content.toString('utf8').split(/\r?\n/).length;
  }

  return { startupFilesBytes, startupFilesLines, missingStartupFiles };
}

function buildReport(coreRoot) {
  const startupFiles = [
    'AGENTS.md',
    'vault/bootstrap/SESSION-BOOTSTRAP.md',
    'vault/capabilities/capability-manifest.json',
    '.codex/AGENTS.md'
  ];
  const roots = [
    path.join(coreRoot, '.agents', 'skills'),
    path.join(coreRoot, 'skills')
  ];

  return {
    timestamp: new Date().toISOString(),
    ...measureStartupFiles(coreRoot, startupFiles),
    ...measureSkillRoots(roots)
  };
}

if (require.main === module) {
  const coreRoot = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
  process.stdout.write(JSON.stringify(buildReport(coreRoot), null, 2) + '\n');
}

module.exports = { listSkills, measureSkillRoots, measureStartupFiles, buildReport };
