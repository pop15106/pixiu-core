#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function parseFrontmatter(content) {
  const normalized = String(content).replace(/^\uFEFF/, '');
  if (!normalized.startsWith('---\n') && !normalized.startsWith('---\r\n')) {
    return { error: '缺少 YAML frontmatter' };
  }

  const lines = normalized.split(/\r?\n/);
  const end = lines.indexOf('---', 1);
  if (end < 0) return { error: 'YAML frontmatter 未正確結束' };

  const metadata = {};
  for (let index = 1; index < end; index += 1) {
    const line = lines[index];
    if (!line.trim() || /^\s/.test(line)) continue;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) return { error: `無法解析 frontmatter 第 ${index + 1} 行` };

    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    metadata[match[1]] = value;
  }

  return { metadata };
}

function validateSkillRoot(root) {
  const errors = [];
  const skills = [];
  const names = new Map();

  if (!fs.existsSync(root)) {
    return { skills, errors: [`Skill root 不存在：${root}`] };
  }

  if (!fs.statSync(root).isDirectory()) {
    return { skills, errors: [`Skill root 不是目錄：${root}`] };
  }

  const rootEntries = fs.readdirSync(root, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));
  const skillPaths = [
    ...rootEntries
      .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .map(entry => path.join(root, entry.name)),
    ...rootEntries
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(root, entry.name, 'SKILL.md'))
      .filter(skillPath => fs.existsSync(skillPath))
  ];

  for (const skillPath of skillPaths) {
    const parsed = parseFrontmatter(fs.readFileSync(skillPath, 'utf8'));
    if (parsed.error) {
      errors.push(`${skillPath}: ${parsed.error}`);
      continue;
    }

    const name = parsed.metadata.name;
    const description = parsed.metadata.description;
    if (!name) errors.push(`${skillPath}: name is required`);
    if (!description) errors.push(`${skillPath}: description is required`);
    if (!name || !description) continue;

    if (names.has(name)) {
      errors.push(`${skillPath}: duplicate skill name "${name}"，首次出現於 ${names.get(name)}`);
      continue;
    }

    names.set(name, skillPath);
    skills.push({ name, description, path: skillPath });
  }

  return { skills, errors };
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || '.agents/skills');
  const result = validateSkillRoot(root);
  process.stdout.write(`已檢查 ${result.skills.length} 個 Skill：${root}\n`);
  if (result.errors.length > 0) {
    for (const error of result.errors) process.stderr.write(`- ${error}\n`);
    process.exit(1);
  }
  process.stdout.write('Skill metadata 驗證通過。\n');
}

module.exports = { parseFrontmatter, validateSkillRoot };
