const test = require('node:test');
const assert = require('node:assert/strict');

const {
  negotiateMcpVersion,
  validateCanonicalTool,
  toCanonicalTool,
  fromCanonicalTool,
} = require('../mcp-compatibility-gateway');

test('協商雙方共同支援的最高穩定版本', () => {
  const result = negotiateMcpVersion(
    ['2025-11-25', '2026-07-28-rc'],
    ['2025-11-25', '2026-07-28-rc'],
    { allowReleaseCandidate: false },
  );
  assert.equal(result.version, '2025-11-25');
  assert.equal(result.releaseCandidate, false);
});

test('RC 必須明確開啟 Feature Flag', () => {
  assert.throws(
    () => negotiateMcpVersion(['2026-07-28-rc'], ['2026-07-28-rc']),
    (error) => error.code === 'MCP_NO_COMPATIBLE_VERSION',
  );

  const result = negotiateMcpVersion(
    ['2026-07-28-rc'],
    ['2026-07-28-rc'],
    { allowReleaseCandidate: true },
  );
  assert.equal(result.version, '2026-07-28-rc');
  assert.equal(result.releaseCandidate, true);
});

test('沒有共同版本時回傳明確錯誤碼', () => {
  assert.throws(
    () => negotiateMcpVersion(['2025-11-25'], ['2024-11-05']),
    (error) => error.code === 'MCP_NO_COMPATIBLE_VERSION',
  );
});

test('穩定版工具可轉換為 Canonical Tool 並轉回', () => {
  const source = {
    name: 'search_docs',
    description: '搜尋文件',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
    annotations: { readOnlyHint: true },
  };
  const canonical = toCanonicalTool('2025-11-25', source);

  assert.deepEqual(validateCanonicalTool(canonical), { valid: true, errors: [] });
  assert.equal(canonical.id, 'search_docs');
  assert.equal(canonical.capabilities.readOnly, true);
  assert.deepEqual(fromCanonicalTool('2025-11-25', canonical), source);
});

test('缺少名稱或輸入 Schema 的工具驗證失敗', () => {
  const result = validateCanonicalTool({ id: '', inputSchema: null });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('TOOL_ID_REQUIRED'));
  assert.ok(result.errors.includes('TOOL_INPUT_SCHEMA_REQUIRED'));
});
