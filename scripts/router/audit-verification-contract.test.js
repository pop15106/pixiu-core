#!/usr/bin/env node
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const canonical = read('skills/pixiu-verify-loop/SKILL.md');
const portable = read('.agents/skills/pixiu-verify-loop/SKILL.md');
const manifest = JSON.parse(read('vault/capabilities/capability-manifest.json'));

// 本組只驗證規則文字與副本一致性，不代表宿主模型已遵循規則。
test('主來源與 Codex 副本正文一致', () => {
  assert.equal(portable, canonical);
});
test('三種授權模式都有明確說明', () => {
  for (const marker of ['唯讀審核', '已授權修復', '### `FULL_AUTOMATIC_HANDOFF`']) {
    assert.ok(canonical.includes(marker));
  }
});
test('已有修復授權時不再逐次重複要求', () => {
  assert.match(canonical, /同一項修復沿用這次授權/);
  assert.doesNotMatch(canonical, /一般模式維持逐次審批/);
});
test('收斂預設使用當前會話，而不是自行派工', () => {
  assert.match(canonical, /### 步驟 2｜當前會話自我覆核/);
  assert.match(canonical, /只有使用者本次明確同意派遣 Agent/);
  assert.doesNotMatch(canonical, /一般情況可呼叫 Claude Code built-in/);
});
test('落檔與服務操作各自受授權限制', () => {
  assert.match(canonical, /唯讀模式在回覆呈現/);
  assert.match(canonical, /使用中的服務、通知、排程與資料庫保持原狀/);
  assert.doesNotMatch(canonical, /每次完整跑完寫入/);
});
test('隔離副本測試不等於本機驗收', () => {
  assert.match(canonical, /隔離副本通過測試只代表副本結果/);
});
test('完整接力區段保持原文，未刪除停止條件或擴大權限', () => {
  const section = canonical.split('### `FULL_AUTOMATIC_HANDOFF`\n')[1].split('\n---\n')[0];
  const hash = crypto.createHash('sha256').update(section).digest('hex');
  assert.equal(hash, '9041796764e8f75e6259104d06827cd4e59f9277abdfd2babe7b364b6556cc24');
});
test('原有 Capability ID、priority、上限均保留', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.maxCapabilitiesPerRequest, 3);
  // 驗證原有能力，而非鎖死能力總數；其他任務新增的能力可以共存。
  const original = {
    'legacy-java': 30, 'code-implementation': 20, 'code-review': 25,
    'security-review': 50, 'architecture-analysis': 25, research: 15,
    documentation: 28, 'identity-calibration': 32,
    'prompt-engineering': 18, 'full-automatic-handoff': 80,
    'recap-memory': 40, 'runtime-control': 45, 'agent-routing': 45,
    'second-brain': 35
  };
  const priorities = Object.fromEntries(manifest.capabilities.map(c => [c.id, c.priority]));
  for (const [id, priority] of Object.entries(original)) assert.equal(priorities[id], priority, id);
  if (Object.hasOwn(priorities, 'change-review')) assert.equal(priorities['change-review'], 35);
});
test('既有 Code Review 入口仍有治理與主要驗證技能', () => {
  const item = manifest.capabilities.find(c => c.id === 'code-review');
  assert.deepEqual(item.load.skills, ['skills/pixiu-verify-loop/SKILL.md']);
  assert.deepEqual(item.load.governance, ['vault/governance/judgment-rubrics.md']);
});
test('版本號同步更新', () => {
  assert.match(canonical, /^version: 0\.2\.1$/m);
  assert.match(portable, /^version: 0\.2\.1$/m);
});
