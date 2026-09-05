#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { resolveCapabilities, safeResolveFromFile } = require('./resolve-capabilities');
const manifestPath = path.join(__dirname, '../../vault/capabilities/capability-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function resolve(request) {
  return resolveCapabilities(request, manifest);
}

// 保留候選包的正向案例；完整倉庫的整合測試仍須另外執行。
const compatibilityCases = [
  ['確認 PCLMS L1 Java 排程 procedure', 'legacy-java'],
  ['幫我整理 recap 現在到哪', 'recap-memory'],
  ['確認目前進度', 'recap-memory'],
  ['你看一下這個專案的對話 去找一下', 'recap-memory'],
  ['幫我收尾，跑驗證', 'code-review'],
  ['auto mode 自動放行', 'runtime-control'],
  ['focus mode 只看結果', 'runtime-control'],
  ['繼續完整自動接力', 'full-automatic-handoff'],
  ['啟用 FULL_AUTOMATIC_HANDOFF', 'full-automatic-handoff'],
  ['恢復完整自動接力模式', 'full-automatic-handoff'],
  ['繼續完整自動模式', 'full-automatic-handoff'],
  ['確認不會影響現行操作跟功能', 'architecture-analysis'],
  ['根據你對我的了解，整理我的偏好', 'identity-calibration'],
  ['幫我優化這段 system prompt', 'prompt-engineering']
];
for (const [request, expected] of compatibilityCases) {
  test(`既有路由相容：${request}`, () => {
    assert.ok(resolve(request).capabilities.includes(expected));
  });
}

for (const request of [
  '審核我的 PixiuCore 內所有內容',
  '閱讀文章，然後審核我的 pixie-core 內所有內容',
  '幫我盤點技能',
  'audit skills',
]) {
  test(`審核入口：${request}`, () => {
    assert.ok(resolve(request).capabilities.includes('code-review'));
  });
}
for (const request of [
  '只審核完整自動接力的規則，不要啟用完整自動接力',
  '不要啟用完整自動模式',
  '請勿啟動 FULL_AUTOMATIC_HANDOFF',
  'Do not enable full automatic handoff',
  "Don't start automatic handoff",
  '解釋完整自動接力',
  '請檢查「啟動完整自動接力」這句指令',
  'review auto mode',
  '只審核 auto mode，不要自動放行'
]) {
  test(`只讀或否定語句排除執行流程：${request}`, () => {
    const result = resolve(request);
    assert.ok(!result.capabilities.includes('full-automatic-handoff'));
    assert.ok(!result.capabilities.includes('runtime-control'));
  });
}
for (const request of [
  '請啟動完整自動接力',
  '請啟動「完整自動接力」',
  '啟用完整自動接力進行審核',
  '先審核完整自動接力，然後啟用完整自動接力',
  '停止完整自動接力',
  '暫停完整自動接力',
  '取消完整自動接力',
  '開啟完整自動接力，不要修改資料庫',
]) {
  test(`保留明確控制語句的路由：${request}`, () => {
    assert.ok(resolve(request).capabilities.includes('full-automatic-handoff'));
  });
}
for (const request of ['只看 token 使用量', '檢查 token 用量', 'token usage']) {
  test(`Token 計量與憑證分流：${request}`, () => {
    const result = resolve(request);
    assert.ok(!result.capabilities.includes('security-review'));
    assert.ok(result.capabilities.includes('architecture-analysis'));
  });
}
for (const request of [
  '檢查 access token 是否外洩',
  'token 使用量與 JWT token 過期處理',
  '只看 token 使用量與密碼外洩',
  '檢查 token'
]) {
  test(`保留憑證安全語句：${request}`, () => {
    assert.ok(resolve(request).capabilities.includes('security-review'));
  });
}
for (const request of [
  '幫我修正 README 錯字',
  '請修改 readme.md 的標點',
  'Fix README typo'
]) {
  test(`README 輕量編修：${request}`, () => {
    const result = resolve(request);
    assert.ok(result.capabilities.includes('documentation'));
    assert.ok(!result.capabilities.includes('code-implementation'));
    assert.ok(!result.filesToLoad.includes('skills/tdd-workflow/SKILL.md'));
  });
}
for (const request of [
  '幫我修正 README 錯字，並修正 Java 程式',
  '幫我修正 README 錯字並修正登入功能',
  'Fix README typo and fix application bug',
  '幫我修正 Java bug'
]) {
  test(`保留真正程式修改的 TDD 路由：${request}`, () => {
    assert.ok(resolve(request).capabilities.includes('code-implementation'));
  });
}
test('code-review 只載入一套主要驗證流程', () => {
  const result = resolve('審核程式');
  assert.ok(result.filesToLoad.includes('skills/pixiu-verify-loop/SKILL.md'));
  assert.ok(!result.filesToLoad.includes('skills/verification-loop/SKILL.md'));
});
test('SA/PM 變更覆核仍採專用路由', () => {
  // 未提交的擴充能力不應被本次提交順帶納入；用獨立案例驗證相同排除契約。
  const sample = JSON.parse(JSON.stringify(manifest));
  if (!sample.capabilities.some(item => item.id === 'change-review')) {
    sample.capabilities.push({
      id: 'change-review', keywords: ['整理變更內容'], priority: 35,
      suppresses: ['documentation'],
      load: { skills: ['skills/change-review-evidence/SKILL.md'], contexts: [], governance: [] }
    });
  }
  const result = resolveCapabilities('幫我整理變更內容給 SA/PM 覆核', sample);
  assert.ok(result.capabilities.includes('change-review'));
  assert.ok(!result.capabilities.includes('documentation'));
  assert.ok(result.filesToLoad.includes('skills/change-review-evidence/SKILL.md'));
});
test('保留完整接力的舊有別名與排除規則', () => {
  const result = resolve('繼續完整自動模式');
  assert.ok(result.capabilities.includes('full-automatic-handoff'));
  assert.ok(!result.capabilities.includes('runtime-control'));
});
test('保留無關請求的空路由', () => {
  assert.deepEqual(resolve('把這句翻譯成英文').capabilities, []);
});
test('維持原始回傳欄位，不增加授權宣告', () => {
  const result = resolve('啟動完整自動接力');
  assert.deepEqual(Object.keys(result).sort(), ['capabilities', 'filesToLoad', 'reasons']);
});
test('所有路由的上限、去重、來源與不可變性', () => {
  const before = JSON.stringify(manifest);
  for (const [request] of compatibilityCases) {
    for (const maxCapabilities of [0, 1, 2, 3, 99]) {
      const result = resolveCapabilities(request, manifest, { maxCapabilities });
      assert.ok(result.capabilities.length <= Math.min(maxCapabilities, 3));
      assert.equal(new Set(result.filesToLoad).size, result.filesToLoad.length);
      const allowed = new Set(manifest.capabilities.flatMap(c =>
        Object.values(c.load || {}).flat()));
      assert.ok(result.filesToLoad.every(f => allowed.has(f)));
    }
  }
  assert.equal(JSON.stringify(manifest), before);
});
test('Manifest 失敗仍採空路由降級', () => {
  const result = safeResolveFromFile('啟動完整自動接力', path.join(__dirname, '__missing__.json'));
  assert.equal(result.degraded, true);
  assert.deepEqual(result.capabilities, []);
  assert.deepEqual(result.filesToLoad, []);
});

for (const request of [
  '不啟用完整自動接力',
  '不需要啟動完整自動接力',
  '我不是要你啟動完整自動接力，只是審核',
  '完整自動接力不啟用',
  '只審核啟動完整自動接力的流程',
  '說明如何啟用完整自動接力',
  '確認是否已啟用完整自動接力',
  'Explain how to start full automatic handoff',
]) {
  test(`自我覆核追加：${request}`, () => {
    const result = resolve(request);
    assert.ok(!result.capabilities.includes('full-automatic-handoff'));
    assert.ok(!result.capabilities.includes('runtime-control'));
  });
}
test('非字串請求沿用原本的字串正規化行為', () => {
  for (const request of [null, undefined, 0, {}, {toString() { return 'README 錯字'; }}]) {
    assert.doesNotThrow(() => resolveCapabilities(request, manifest));
  }
});

for (const request of [
  '用完整自動接力進行審核',
  '請用完整自動接力模式審核我的程式',
  '開完整自動接力審核',
  '跑完整自動接力做驗證',
  '幫我用完整自動接力繼續驗證',
]) {
  test(`保留口語明確控制：${request}`, () => {
    assert.ok(resolve(request).capabilities.includes('full-automatic-handoff'));
  });
}
for (const request of [
  '請說明使用完整自動接力的流程',
  '不要用完整自動接力，只審核',
  '不要使用完整自動接力',
  '不用完整自動接力，只審核'
]) {
  test(`排除口語諮詢或否定：${request}`, () => {
    assert.ok(!resolve(request).capabilities.includes('full-automatic-handoff'));
  });
}

// 與本機原有修正整合時，保留其情境條件、派工限制及非 README 文件行為。
test('擴充能力的 requiresAny 條件保持有效', () => {
  const sample = { capabilities: [{ id: 'stocktake-fixture', keywords: ['審核'], requiresAny: ['核心'], load: {} }] };
  assert.deepEqual(resolveCapabilities('審核核心', sample).capabilities, ['stocktake-fixture']);
  assert.deepEqual(resolveCapabilities('審核文章', sample).capabilities, []);
});
for (const request of ['修正文件標點', '修正說明書錯字']) {
  test(`保留文件輕量修改：${request}`, () => {
    assert.ok(!resolve(request).capabilities.includes('code-implementation'));
  });
}
for (const request of ['檢查 tokens 消耗', '幫我看 token 預算', '查看使用量 token', '查看 token 計數']) {
  test(`保留額外用量說法：${request}`, () => {
    assert.ok(!resolve(request).capabilities.includes('security-review'));
  });
}
for (const request of ['只審核 agent team 的規則', '檢查規則，不要派工']) {
  test(`保留未授權派工排除：${request}`, () => {
    assert.ok(!resolve(request).capabilities.includes('agent-routing'));
  });
}
test('明確要求 Agent Team 時仍可取得對應規則', () => {
  assert.ok(resolve('啟動 agent team 平衡模式').capabilities.includes('agent-routing'));
});
