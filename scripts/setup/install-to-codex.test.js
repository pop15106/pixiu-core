'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { generate, install, migrateLegacyHookConfig, resolveCore } = require('./install-to-codex');

const core = path.resolve(__dirname, '..', '..');

test('generated hooks keep Pixiu and codebase-memory SessionStart hooks together', t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-codex-hooks-'));
  const target = path.join(tempDir, 'hooks.json');
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  generate({ core, nodeExe: process.execPath, target });

  const config = JSON.parse(fs.readFileSync(target, 'utf8'));
  const sessionStart = config.hooks.SessionStart;
  assert.equal(sessionStart.length, 2);
  assert.equal(sessionStart[0].hooks[0].statusMessage, 'Loading Pixiu session context');
  assert.equal(sessionStart[1].matcher, 'startup|resume|clear|compact');
  assert.match(sessionStart[1].hooks[0].command, /prefer codebase-memory-mcp/);

  fs.writeFileSync(target, 'previous hooks', 'utf8');
  generate({ core, nodeExe: process.execPath, target });
  const backups = fs.readdirSync(tempDir).filter(name => name.endsWith('.bak'));
  assert.equal(backups.length, 1);
  assert.equal(fs.readFileSync(path.join(tempDir, backups[0]), 'utf8'), 'previous hooks');
});

const legacyConfig = [
  'model = "gpt-5.6-sol"',
  '',
  '[hooks.state.\'C:\\\\Users\\\\7010\\\\Documents\\\\hermes 多AI 工作流\']',
  'trusted_hash = "sha256:keep-me"',
  '',
  '# >>> codebase-memory-mcp SessionStart >>>',
  '[[hooks.SessionStart]]',
  'matcher = "startup|resume|clear|compact"',
  '',
  '[[hooks.SessionStart.hooks]]',
  'type = "command"',
  'command = \'echo "Code discovery: prefer codebase-memory-mcp."\'',
  '# <<< codebase-memory-mcp SessionStart <<<',
  '',
].join('\n');

test('migration preserves Codex config while removing the legacy hook once', t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-codex-config-'));
  const configPath = path.join(tempDir, 'config.toml');
  const original = Buffer.from(legacyConfig, 'utf8');
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  fs.writeFileSync(configPath, original);
  const originalMode = fs.statSync(configPath).mode;

  const first = migrateLegacyHookConfig(configPath);
  assert.equal(first.migrated, true);
  assert.ok(first.backupPath.endsWith('.bak'));
  const migrated = fs.readFileSync(configPath, 'utf8');
  assert.match(migrated, /model = "gpt-5\.6-sol"/);
  assert.match(migrated, /hermes 多AI 工作流/);
  assert.match(migrated, /\[hooks\.state\./);
  assert.doesNotMatch(migrated, /\[\[hooks\.SessionStart\]\]/);
  assert.deepEqual(fs.readFileSync(first.backupPath), original);
  assert.equal(fs.statSync(configPath).mode, originalMode);

  const backupsBefore = fs.readdirSync(tempDir).filter(name => name.endsWith('.bak'));
  const second = migrateLegacyHookConfig(configPath);
  const backupsAfter = fs.readdirSync(tempDir).filter(name => name.endsWith('.bak'));
  assert.equal(second.migrated, false);
  assert.deepEqual(backupsAfter, backupsBefore);
});

test('install generates hooks and migrates the selected Codex config', t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-codex-install-'));
  const target = path.join(tempDir, 'hooks.json');
  const configPath = path.join(tempDir, 'config.toml');
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  fs.writeFileSync(configPath, legacyConfig, 'utf8');

  const result = install({
    core,
    nodeExe: process.execPath,
    target,
    configPath,
  });

  assert.equal(result.hooksPath, target);
  assert.equal(result.migration.migrated, true);
  assert.equal(JSON.parse(fs.readFileSync(target, 'utf8')).hooks.SessionStart.length, 2);
  assert.doesNotMatch(fs.readFileSync(configPath, 'utf8'), /\[\[hooks\.SessionStart\]\]/);
});

test('migration is a no-op when config.toml does not exist', () => {
  const missing = path.join(os.tmpdir(), `missing-codex-${process.pid}-${Date.now()}.toml`);
  assert.deepEqual(migrateLegacyHookConfig(missing), {
    migrated: false,
    backupPath: null,
  });
});

test('migration rejects invalid UTF-8 without modifying or backing up config', t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-codex-invalid-'));
  const configPath = path.join(tempDir, 'config.toml');
  const invalid = Buffer.from([0xc3, 0x28]);
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  fs.writeFileSync(configPath, invalid);

  assert.throws(() => migrateLegacyHookConfig(configPath), /not valid UTF-8/);
  assert.deepEqual(fs.readFileSync(configPath), invalid);
  assert.deepEqual(fs.readdirSync(tempDir), ['config.toml']);
});

test('migration rejects incomplete markers without modifying config', t => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-codex-malformed-'));
  const configPath = path.join(tempDir, 'config.toml');
  const malformed = `${legacyConfig.split('# <<<')[0]}# missing end marker\n`;
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
  fs.writeFileSync(configPath, malformed, 'utf8');

  assert.throws(() => migrateLegacyHookConfig(configPath), /malformed/);
  assert.equal(fs.readFileSync(configPath, 'utf8'), malformed);
  assert.deepEqual(fs.readdirSync(tempDir), ['config.toml']);
});
test('resolveCore follows environment precedence and falls back to the script repo', t => {
  const originalCore = process.env.PIXIU_CORE;
  const originalCorePath = process.env.PIXIU_CORE_PATH;
  t.after(() => {
    if (originalCore === undefined) delete process.env.PIXIU_CORE;
    else process.env.PIXIU_CORE = originalCore;
    if (originalCorePath === undefined) delete process.env.PIXIU_CORE_PATH;
    else process.env.PIXIU_CORE_PATH = originalCorePath;
  });

  process.env.PIXIU_CORE = core;
  process.env.PIXIU_CORE_PATH = path.join(os.tmpdir(), 'not-the-core');
  assert.equal(resolveCore(), core);

  process.env.PIXIU_CORE = path.join(os.tmpdir(), 'not-the-core');
  process.env.PIXIU_CORE_PATH = core;
  assert.equal(resolveCore(), core);

  delete process.env.PIXIU_CORE;
  delete process.env.PIXIU_CORE_PATH;
  assert.equal(resolveCore(), core);
});