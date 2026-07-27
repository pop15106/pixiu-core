#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
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

function canonicalDirectory(directoryPath) {
  try {
    if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) return '';
    return fs.realpathSync.native ? fs.realpathSync.native(directoryPath) : fs.realpathSync(directoryPath);
  } catch {
    return '';
  }
}

function samePath(left, right) {
  if (!left || !right) return false;
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function measurePixiuSkillSuppression(
  coreRoot,
  globalSkillRoot = path.join(os.homedir(), '.agents', 'skills')
) {
  const canonicalRoot = path.join(coreRoot, 'skills');
  const portableRoot = path.join(coreRoot, '.agents', 'skills');
  const canonicalNames = new Set(listSkills(canonicalRoot).map(skill => skill.name));
  const portableNames = listSkills(portableRoot).map(skill => skill.name);
  const portableSkillNamesCovered = portableNames.length > 0 &&
    portableNames.every(name => canonicalNames.has(name));
  const bootstrapExists = fs.existsSync(
    path.join(coreRoot, 'vault', 'bootstrap', 'SESSION-BOOTSTRAP.md')
  );
  const pixiuCanonicalSuppressionEligible = bootstrapExists &&
    portableSkillNamesCovered &&
    samePath(canonicalDirectory(canonicalRoot), canonicalDirectory(globalSkillRoot));
  const raw = measureSkillRoots([portableRoot, canonicalRoot]);

  return {
    portableSkillNamesCovered,
    pixiuCanonicalSuppressionEligible,
    effectiveSkillNameCollisions: pixiuCanonicalSuppressionEligible
      ? 0
      : raw.skillNameCollisions
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
    '.codex/AGENTS.md'
  ];
  const roots = [
    path.join(coreRoot, '.agents', 'skills'),
    path.join(coreRoot, 'skills')
  ];

  return {
    timestamp: new Date().toISOString(),
    ...measureStartupFiles(coreRoot, startupFiles),
    ...measureSkillRoots(roots),
    ...measurePixiuSkillSuppression(coreRoot)
  };
}

if (require.main === module) {
  const coreRoot = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
  process.stdout.write(JSON.stringify(buildReport(coreRoot), null, 2) + '\n');
}

module.exports = {
  listSkills,
  measureSkillRoots,
  measurePixiuSkillSuppression,
  measureStartupFiles,
  buildReport
};
