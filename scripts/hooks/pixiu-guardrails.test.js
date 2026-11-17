#!/usr/bin/env node
'use strict';

// pixiu-guardrails.js 的 secret-scan 與 change-scope 行為測試（以子程序模擬 Claude Code hook 輸入）
const assert = require('assert');
const path = require('path');
const test = require('node:test');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'pixiu-guardrails.js');

function runHook(hookId, input) {
  const result = spawnSync(process.execPath, [SCRIPT, hookId], {
    input: JSON.stringify(input),
    encoding: 'utf8'
  });
  const stdout = (result.stdout || '').trim();
  return { status: result.status, json: stdout ? JSON.parse(stdout) : null };
}

function scan(content) {
  return runHook('post:pixiu:secret-scan', {
    tool_name: 'Write',
    tool_input: { file_path: 'config/app.properties', content },
    tool_response: { filePath: 'config/app.properties' }
  });
}

test('既有規則：API Key 會被擋下', () => {
  const { json } = scan('ANTHROPIC_KEY=sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  assert.strictEqual(json.decision, 'block');
});

test('Oracle JDBC 連線字串含帳密會被擋下', () => {
  const { json } = scan('url=jdbc:oracle:thin:pclms_ap/S3cret!pw@10.1.2.3:1521/ORCL');
  assert.strictEqual(json.decision, 'block');
  assert.match(json.reason, /Oracle JDBC/);
});

test('Oracle JDBC 不含帳密不攔', () => {
  assert.strictEqual(scan('url=jdbc:oracle:thin:@10.1.2.3:1521/ORCL').json, null);
});

test('設定檔明文密碼會被擋下（properties 與 yaml）', () => {
  for (const content of ['db.password=Abc12345', 'spring:\n  datasource:\n    password: "Abc12345"']) {
    const { json } = scan(content);
    assert.strictEqual(json && json.decision, 'block', content);
    assert.match(json.reason, /設定檔明文密碼/);
  }
});

test('占位符、環境變數與 Java 程式碼不誤擋', () => {
  for (const content of [
    'db.password=${DB_PASSWORD}',
    'db.password=%DB_PASSWORD%',
    'password: <your-password>',
    'password=***',
    'password=changeme',
    'String password = request.getParameter("pwd");',
    'if (password == null) { return; }'
  ]) {
    assert.strictEqual(scan(content).json, null, content);
  }
});

test('change-scope：一般小幅寫入不輸出警告', () => {
  const { status, json } = runHook('pre:pixiu:change-scope', {
    tool_name: 'Write',
    tool_input: { file_path: 'src/A.java', content: 'class A {}' }
  });
  assert.strictEqual(status, 0);
  assert.strictEqual(json, null);
});
