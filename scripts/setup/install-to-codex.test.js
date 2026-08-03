'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { generate } = require('./install-to-codex');

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-codex-hook-install-'));
  const core = path.join(root, 'core');
  const bridgeDir = path.join(core, 'scripts', 'codex-bridge');
  fs.mkdirSync(bridgeDir, { recursive: true });
  fs.writeFileSync(path.join(core, 'user_rules.md'), '# L0\n', 'utf8');
  fs.writeFileSync(
    path.join(bridgeDir, 'pixiu-global-hook-bridge.js'),
    'console.log("bridge");\n',
    'utf8'
  );
  fs.copyFileSync(
    path.join(__dirname, '..', 'codex-bridge', 'hooks.template.json'),
    path.join(bridgeDir, 'hooks.template.json')
  );
  return { root, core };
}

function collectCommands(config, propertyName) {
  const commands = [];
  for (const groups of Object.values(config.hooks || {})) {
    for (const group of groups) {
      for (const hook of group.hooks || []) {
        if (typeof hook[propertyName] === 'string') {
          commands.push(hook[propertyName]);
        }
      }
    }
  }
  return commands;
}

test('Windows Node 與 Bridge 路徑一律加引號', () => {
  const fixture = createFixture();
  const target = path.join(fixture.root, 'user', '.codex', 'hooks.json');
  generate({
    core: fixture.core,
    nodeExe: 'C:\\Program Files\\nodejs\\node.exe',
    target
  });

  const config = JSON.parse(fs.readFileSync(target, 'utf8'));
  const commands = collectCommands(config, 'commandWindows');
  assert.ok(commands.length > 0);
  for (const command of commands) {
    assert.match(command, /^"C:\\Program Files\\nodejs\\node\.exe"\s+"[^"]+pixiu-global-hook-bridge\.js"/);
  }
});

test('POSIX Node 與 Bridge 路徑一律加引號', () => {
  const fixture = createFixture();
  const target = path.join(fixture.root, 'user', '.codex', 'hooks.json');
  generate({
    core: fixture.core,
    nodeExe: '/opt/node with spaces/bin/node',
    target
  });

  const config = JSON.parse(fs.readFileSync(target, 'utf8'));
  const commands = collectCommands(config, 'command');
  assert.ok(commands.length > 0);
  for (const command of commands) {
    assert.match(command, /^"\/opt\/node with spaces\/bin\/node"\s+"[^"]+pixiu-global-hook-bridge\.js"/);
  }
});
