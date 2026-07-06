#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const autoRecap = require('./pixiu-auto-recap');

const GRAVITY_ROOT = '%GRAVITYTEST_ROOT%';

function gravityPath(...segments) {
  return [GRAVITY_ROOT, ...segments].join('/');
}

function makeTempCore() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-auto-recap-'));
  fs.mkdirSync(path.join(root, 'vault', 'memory', 'recaps'), { recursive: true });
  return root;
}

function writeTranscript(root, name, entries) {
  const transcriptPath = path.join(root, `${name}.jsonl`);
  fs.writeFileSync(
    transcriptPath,
    entries.map(entry => JSON.stringify(entry)).join('\n') + '\n',
    'utf8'
  );
  return transcriptPath;
}

function listMarkdownFiles(root) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
    }
  }
  walk(path.join(root, 'vault', 'memory', 'recaps'));
  return files.sort();
}

function runHook(corePath, transcriptPath, cwd = gravityPath('PCLMS_AP')) {
  const rawInput = JSON.stringify({
    transcript_path: transcriptPath,
    cwd,
    session_id: 'test-session-ABCD1234',
    hook_event_name: 'Stop'
  });
  const output = autoRecap.run(rawInput, {
    corePath,
    now: new Date('2026-06-08T10:20:30+08:00')
  });
  assert.strictEqual(output, rawInput);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function testWritesDraftAutoRecapIntoProjectMonthPath() {
  const core = makeTempCore();
  const transcript = writeTranscript(core, 'session-a', [
    { type: 'user', message: { role: 'user', content: 'Fix inventory balance bug' } },
    {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            name: 'Edit',
            input: { file_path: gravityPath('PCLMS_AP', 'src', 'Foo.java') }
          }
        ]
      }
    }
  ]);

  runHook(core, transcript);

  const files = listMarkdownFiles(core);
  assert.strictEqual(files.length, 1);
  assert.strictEqual(
    path.relative(path.join(core, 'vault', 'memory', 'recaps'), files[0]).replace(/\\/g, '/'),
    'PCLMS_AP/2026-06/2026-06-08-PCLMS_AP-auto-session-abcd1234.md'
  );

  const content = read(files[0]);
  assert.match(content, /^type: session-recap$/m);
  assert.match(content, /^status: draft-auto$/m);
  assert.match(content, /^recap_mode: auto$/m);
  assert.match(content, /^auto_trigger: stop$/m);
  assert.match(content, /^project: PCLMS_AP$/m);
}

function testSameTranscriptUpdatesExistingAutoRecap() {
  const core = makeTempCore();
  const transcript = writeTranscript(core, 'session-b', [
    { type: 'user', message: { role: 'user', content: 'Trace menu permission issue' } }
  ]);

  runHook(core, transcript, gravityPath('pepis_ap'));
  runHook(core, transcript, gravityPath('pepis_ap'));

  const files = listMarkdownFiles(core);
  assert.strictEqual(files.length, 1);
  const relative = path.relative(path.join(core, 'vault', 'memory', 'recaps'), files[0]).replace(/\\/g, '/');
  assert.strictEqual(relative, 'PEPIS/2026-06/2026-06-08-PEPIS-auto-session-abcd1234.md');
}

function testDoesNotOverwriteManualRecapWithSameName() {
  const core = makeTempCore();
  const targetDir = path.join(core, 'vault', 'memory', 'recaps', 'PCLMS_AP', '2026-06');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(
    path.join(targetDir, '2026-06-08-PCLMS_AP-auto-session-abcd1234.md'),
    '---\nrecap_mode: manual\n---\nmanual content\n',
    'utf8'
  );

  const transcript = writeTranscript(core, 'session-c', [
    { type: 'user', message: { role: 'user', content: 'Fix inventory balance bug' } }
  ]);
  runHook(core, transcript);

  const files = listMarkdownFiles(core).map(file => path.basename(file)).sort();
  assert.deepStrictEqual(files, [
    '2026-06-08-PCLMS_AP-auto-session-abcd1234-auto1.md',
    '2026-06-08-PCLMS_AP-auto-session-abcd1234.md'
  ]);
}

function testSkipsEmptyTranscript() {
  const core = makeTempCore();
  const transcript = writeTranscript(core, 'session-d', [
    { type: 'assistant', message: { content: [{ type: 'text', text: 'hello' }] } }
  ]);

  runHook(core, transcript);
  assert.strictEqual(listMarkdownFiles(core).length, 0);
}

function testParsesBomPrefixedTranscript() {
  const core = makeTempCore();
  const transcript = path.join(core, 'session-e.jsonl');
  fs.writeFileSync(
    transcript,
    '\uFEFF' + JSON.stringify({
      type: 'user',
      message: { role: 'user', content: 'Trace PEPIS login announcement flow' }
    }) + '\n',
    'utf8'
  );

  runHook(core, transcript, '%USERPROFILE%/Desktop/Project/pepis_ap');

  const files = listMarkdownFiles(core);
  assert.strictEqual(files.length, 1);
  assert.strictEqual(
    path.relative(path.join(core, 'vault', 'memory', 'recaps'), files[0]).replace(/\\/g, '/'),
    'PEPIS/2026-06/2026-06-08-PEPIS-auto-session-abcd1234.md'
  );
}

function testGrowingSessionConsolidatesIntoSingleFile() {
  const core = makeTempCore();
  const transcript = writeTranscript(core, 'session-f', [
    { type: 'user', message: { role: 'user', content: 'first question' } }
  ]);
  runHook(core, transcript);
  writeTranscript(core, 'session-f', [
    { type: 'user', message: { role: 'user', content: 'first question' } },
    { type: 'user', message: { role: 'user', content: 'second follow-up' } }
  ]);
  runHook(core, transcript);

  const files = listMarkdownFiles(core);
  assert.strictEqual(files.length, 1);
  const content = read(files[0]);
  assert.match(content, /second follow-up/);
  assert.match(content, /^summary: "second follow-up"$/m);
}

const tests = [
  testWritesDraftAutoRecapIntoProjectMonthPath,
  testSameTranscriptUpdatesExistingAutoRecap,
  testDoesNotOverwriteManualRecapWithSameName,
  testSkipsEmptyTranscript,
  testParsesBomPrefixedTranscript,
  testGrowingSessionConsolidatesIntoSingleFile
];

for (const test of tests) {
  test();
  process.stdout.write(`ok ${test.name}\n`);
}
