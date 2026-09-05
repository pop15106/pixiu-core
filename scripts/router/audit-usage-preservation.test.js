#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveCapabilities } = require('./resolve-capabilities');

const manifest = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../vault/capabilities/capability-manifest.json'), 'utf8'
));
const resolve = request => resolveCapabilities(request, manifest);

// 純引用與唯讀描述只提供查核情境，不代表要求控制工作流。
for (const request of [
  '「啟動完整自動接力」',
  '「完整自動接力」',
  '請記錄「啟動完整自動接力」這句話',
  '只讀完整自動接力',
  '唯讀完整自動接力',
  'read-only full automatic handoff',
  'read only auto mode'
]) {
  test(`純引用或唯讀情境：${request}`, () => {
    const result = resolve(request);
    assert.ok(!result.capabilities.includes('full-automatic-handoff'));
    assert.ok(!result.capabilities.includes('runtime-control'));
  });
}

// 保留明確控制、口語指令及既有裸模式名稱；路由結果本身仍不是授權。
for (const request of [
  '請啟動「完整自動接力」',
  '請用「完整自動接力」進行審核',
  '停止完整自動接力',
  '暫停完整自動接力',
  '取消完整自動接力',
  '完整自動接力',
  '啟用完整自動接力且所有檢查採唯讀',
  '請用完整自動接力做唯讀審核'
]) {
  test(`明確控制保持相容：${request}`, () => {
    assert.ok(resolve(request).capabilities.includes('full-automatic-handoff'));
  });
}

// 輕量文件修改和程式修改出現在同一需求時，仍保留實作與測試能力。
for (const request of [
  '修正 README 錯字並修復登入',
  '修正文件錯字，並修正 Python parser',
  '修正說明書標點，並修改 JavaScript parser',
  '修正 README 錯字，並修改後端',
  '修正文件措辭，並修改前端'
]) {
  test(`混合文件與程式修改：${request}`, () => {
    const result = resolve(request);
    assert.ok(result.capabilities.includes('code-implementation'));
    assert.ok(result.filesToLoad.includes('skills/tdd-workflow/SKILL.md'));
  });
}

for (const request of [
  '幫我修正 README 錯字',
  '修正文件標點',
  '修正說明書錯字',
  '修正註解措辭'
]) {
  test(`純文件修改保持輕量：${request}`, () => {
    const result = resolve(request);
    assert.ok(!result.capabilities.includes('code-implementation'));
    assert.ok(!result.filesToLoad.includes('skills/tdd-workflow/SKILL.md'));
  });
}
