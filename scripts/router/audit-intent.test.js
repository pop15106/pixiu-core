'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { resolveCapabilities } = require('./resolve-capabilities');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../../vault/capabilities/capability-manifest.json'), 'utf8'));

// 本機已有的擴充能力照原設定測試；提交基線沒有它們時，用獨立案例驗證路由契約。
// 不為了發布測試而併入其他任務尚未提交的技能與設定。
for (const fixture of [
  { id: 'core-stocktake', keywords: ['審核', '審查', '盤點', 'audit'],
    requiresAny: ['pixiu', 'pixie', '母體', '核心', '技能', 'skill'], priority: 29,
    load: { skills: ['skills/skill-stocktake/SKILL.md'] } },
  { id: 'change-review', keywords: ['整理變更內容'], priority: 35,
    suppresses: ['documentation'], load: { skills: ['skills/change-review-evidence/SKILL.md'] } }
]) {
  if (!manifest.capabilities.some(item => item.id === fixture.id)) manifest.capabilities.push(fixture);
}

// 以真實使用語句保護查詢、審核與啟動的邊界；路由結果本身不代表操作授權。
const cases = [
  ['審核我的 PixiuCore 內所有內容', ['core-stocktake'], []],
  ['閱讀文章，然後審核我的 pixie-core 內所有內容', ['core-stocktake', 'research'], []],
  ['只審核完整自動接力的規則，不要啟用完整自動接力', ['code-review'], ['full-automatic-handoff']],
  ['解釋 FULL_AUTOMATIC_HANDOFF 是什麼', [], ['full-automatic-handoff']],
  ['不要啟用完整自動接力', [], ['full-automatic-handoff']],
  // 暫停是控制既有任務；路由必須保留，但不授權啟動新任務。
  ['暫停完整自動接力', ['full-automatic-handoff'], []],
  ['檢查規則，不要派工', [], ['agent-routing']],
  ['只審核 auto mode 的設定，不要自動放行', ['code-review'], ['runtime-control']],
  ['只看 token 使用量', [], ['security-review']],
  ['檢查 tokens 消耗', [], ['security-review']],
  ['幫我看 token 預算', [], ['security-review']],
  ['token 外洩，檢查權限', ['security-review'], []],
  ['檢查 access token 安全性和 token 使用量', ['security-review'], []],
  ['幫我修正 README 錯字', ['documentation'], ['code-implementation']],
  ['修正文件標點', ['documentation'], ['code-implementation']],
  ['修正 Java 程式，再更新 README 錯字', ['code-implementation', 'legacy-java'], []],
  ['幫我整理變更內容給 SA/PM 覆核', ['change-review'], ['documentation']],
  ['啟動完整自動接力', ['full-automatic-handoff'], []],
  ['繼續完整自動模式', ['full-automatic-handoff'], ['runtime-control']],
  ['恢復 FULL_AUTOMATIC_HANDOFF', ['full-automatic-handoff'], []],
  ['完整自動接力', ['full-automatic-handoff'], []],
  ['先審核規則，再啟動完整自動接力', ['full-automatic-handoff', 'code-review'], []],
  ['不要停止完整自動接力，繼續完整自動接力', ['full-automatic-handoff'], []],
  ['auto mode 自動放行', ['runtime-control'], []],
  ['啟動 agent team 平衡模式', ['agent-routing'], []],
  ['確認 PCLMS L1 Java 排程 procedure', ['legacy-java'], []],
  ['把這句翻譯成英文', [], ['full-automatic-handoff', 'code-implementation']],
];

for (const [request, required, forbidden] of cases) {
  test(request, () => {
    const result = resolveCapabilities(request, manifest);
    for (const id of required) assert.ok(result.capabilities.includes(id), `缺少 ${id}: ${JSON.stringify(result.capabilities)}`);
    for (const id of forbidden) assert.ok(!result.capabilities.includes(id), `誤選 ${id}: ${JSON.stringify(result.capabilities)}`);
    assert.ok(result.capabilities.length <= 3);
    assert.equal(new Set(result.filesToLoad).size, result.filesToLoad.length);
  });
}

test('一般審查只載入單一主要驗證入口', () => {
  const result = resolveCapabilities('審核程式並跑測試', manifest);
  assert.ok(result.filesToLoad.includes('skills/pixiu-verify-loop/SKILL.md'));
  assert.ok(!result.filesToLoad.includes('skills/verification-loop/SKILL.md'));
});
