'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const configPath = path.resolve(__dirname, '..', '..', '.codex', 'config.toml');

function activeLines(content) {
  return String(content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

test('專案層 Codex 設定不包含只支援使用者層的 notify', () => {
  const lines = activeLines(fs.readFileSync(configPath, 'utf8'));
  assert.equal(lines.some((line) => /^notify\s*=/.test(line)), false);
});

test('專案層 Codex 設定不包含只支援使用者層的 profiles', () => {
  const lines = activeLines(fs.readFileSync(configPath, 'utf8'));
  assert.equal(lines.some((line) => /^\[profiles(?:\.|\])/.test(line)), false);
});
