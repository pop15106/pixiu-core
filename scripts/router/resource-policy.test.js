'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inspectResources, assertOnDemandContent, validatePolicy } = require('./resource-policy');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixiu-resource-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'public.md'), '# 公開測試\n');
  const manifest = {
    resourcePolicy: { schemaVersion: 1, localPrivate: { 'private.md': '中性測試用私人脈絡' } },
    capabilities: [{ id: 'sample', load: { contexts: ['public.md', 'private.md'] } }]
  };
  return { root, manifest };
}

test('公共驗證不讀私人內容，明確揭露未檢查', t => {
  const { root, manifest } = fixture(t);
  const result = inspectResources(root, manifest);
  assert.deepEqual(result.missingPublic, []);
  assert.equal(result.privateResources[0].status, 'NOT_INSPECTED');
  assert.equal(result.canRunPublicCore, true);
});

test('指定能力需要私人資料時缺失不可標成就緒', t => {
  const { root, manifest } = fixture(t);
  const result = inspectResources(root, manifest, { profile: 'local-readiness', capabilityIds: ['sample'] });
  assert.equal(result.privateResources[0].status, 'MISSING_PRIVATE_CONTEXT');
  assert.equal(result.ready, false);
});

test('本機就緒檢查只檢查存在性，不宣稱內容已驗證', t => {
  const { root, manifest } = fixture(t);
  fs.writeFileSync(path.join(root, 'private.md'), '# 中性測試資料');
  const result = inspectResources(root, manifest, { profile: 'local-readiness', capabilityIds: ['sample'] });
  assert.equal(result.privateResources[0].status, 'PRESENT_NOT_VALIDATED');
  assert.equal(result.ready, true);
});

test('公開必要檔案缺失仍失敗', t => {
  const { root, manifest } = fixture(t);
  fs.unlinkSync(path.join(root, 'public.md'));
  assert.deepEqual(inspectResources(root, manifest).missingPublic, ['sample: public.md']);
});

test('未登錄的 context 與拼錯路徑預設為必要', t => {
  const { root, manifest } = fixture(t);
  manifest.capabilities[0].load.contexts.push('typo.md');
  assert.deepEqual(inspectResources(root, manifest).missingPublic, ['sample: typo.md']);
});

for (const [label, content] of [
  ['空檔', ''],
  ['常駐 alwaysApply', '---\nalwaysApply: true\n---\n# 測試'],
  ['session-start', '---\nreadAt: session-start\n---\n# 測試'],
  ['session-init', '---\nreadAt: session-init\n---\n# 測試'],
  ['always_on', '---\ntrigger: always_on\n---\n# 測試'],
  ['未閉合 metadata', '---\ntype: fixture\n# 測試'],
  ['非字串', null]
]) {
  test(`按需文件拒絕${label}`, () => assert.throws(() => assertOnDemandContent(content, 'fixture.md')));
}

test('有效中性 fixture 通過按需載入契約', () => {
  assert.doesNotThrow(() => assertOnDemandContent('---\ntype: fixture\n---\n# 中性內容\n', 'fixture.md'));
});

test('資源政策拒絕非法版本、空理由與萬用字元', () => {
  for (const policy of [null, { schemaVersion: 2, localPrivate: {} },
    { schemaVersion: 1, localPrivate: { 'private.md': '' } },
    { schemaVersion: 1, localPrivate: { 'vault/**': '錯誤的寬鬆規則' } }]) {
    assert.throws(() => validatePolicy({ resourcePolicy: policy }));
  }
});

test('拒絕路徑穿越與絕對路徑', t => {
  const { root, manifest } = fixture(t);
  for (const resource of ['../outside.md', '/outside.md', 'C:/outside.md', 'a\\..\\outside']) {
    manifest.capabilities[0].load.contexts = [resource];
    assert.throws(() => inspectResources(root, manifest));
  }
});

test('未知 profile 與未知能力需明確報錯', t => {
  const { root, manifest } = fixture(t);
  assert.throws(() => inspectResources(root, manifest, { profile: 'silently-skip' }));
  assert.throws(() => inspectResources(root, manifest, { capabilityIds: ['missing'] }));
});
