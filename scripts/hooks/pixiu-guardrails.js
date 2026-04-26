/**
 * pixiu-guardrails.js — 母體治理規則 Runtime 強制執行
 *
 * 實作 user_rules.md 中的硬閘門規則：
 * 1. API Key 洩露偵測（PostToolUse on Edit/Write）
 * 2. 大規模變更警告（PreToolUse on Edit/Write/MultiEdit）
 * 3. .agent/ 變更偵測 + 母體同步提醒（Stop）
 *
 * 用法（由 hooks.json 呼叫）：
 *   node pixiu-guardrails.js <hook-id>
 *
 * Hook IDs:
 *   pre:pixiu:change-scope    — 大規模變更警告
 *   post:pixiu:secret-scan    — API Key 洩露掃描
 *   stop:pixiu:mothership-sync — .agent/ 變更偵測
 */

'use strict';

const hookId = process.argv[2] || '';

let inputData = '';
process.stdin.on('data', chunk => inputData += chunk);
process.stdin.on('end', () => {
  try {
    // DEBUG: 記錄原始輸入，方便排查
    require('fs').writeFileSync(require('path').join(__dirname, 'debug-input.json'), inputData);
    const input = JSON.parse(inputData);

    switch (hookId) {
      case 'pre:pixiu:change-scope':
        handleChangeScope(input);
        break;
      case 'post:pixiu:secret-scan':
        handleSecretScan(input);
        break;
      case 'stop:pixiu:mothership-sync':
        handleMothershipSync(input);
        break;
      default:
        // 未知 hook ID，直接通過
        console.log(inputData);
    }
  } catch (err) {
    // Hook 錯誤不應阻斷主流程
    console.error(`[pixiu-guardrails] 錯誤: ${err.message}`);
    console.log(inputData);
  }
});

// ── Hook 1: 大規模變更警告 ────────────────────────────────────────
// 對應 user_rules.md：「最小改動原則」
function handleChangeScope(input) {
  const toolInput = input.tool_input || {};

  // 檢查 MultiEdit 操作的變更範圍
  if (input.tool_name === 'MultiEdit') {
    console.error('[🛡️ 母體治理] 偵測到 MultiEdit 操作。');
    console.error('[🛡️ 母體治理] 提醒：user_rules.md 要求「最小改動原則：只改達成目標所需最小範圍」。');
    console.error('[🛡️ 母體治理] 請確認此次多檔案修改都是必要的。');
  }

  // 檢查 Write 操作是否在 .agent/ 目錄下
  if (input.tool_name === 'Write') {
    const filePath = toolInput.file_path || '';
    if (filePath.includes('.agent/') || filePath.includes('.agents/')) {
      console.error('[🛡️ 母體治理] 偵測到 .agent/ 目錄變更！');
      console.error('[🛡️ 母體治理] 依 user_rules.md「框架變更回寫母體」規則，');
      console.error('[🛡️ 母體治理] 完成後必須詢問使用者是否同步至 C:\\PixiuCore。');
    }
  }

  console.log(inputData);
}

// ── Hook 2: API Key 洩露掃描 ──────────────────────────────────────
// 對應 user_rules.md：「禁止硬編碼 API Key、密碼、Token」
function handleSecretScan(input) {
  const toolOutput = input.tool_output || {};
  const content = toolOutput.output || '';
  const toolInput = input.tool_input || {};
  const newContent = toolInput.new_string || toolInput.content || '';

  // 合併檢查：工具輸出 + 新寫入的內容
  const textToCheck = content + '\n' + newContent;

  const SECRET_PATTERNS = [
    { pattern: /sk-[a-zA-Z0-9-]{20,}/,                   name: 'Anthropic/OpenAI API Key' },
    { pattern: /ghp_[a-zA-Z0-9]{36}/,                    name: 'GitHub Personal Token' },
    { pattern: /\d{8,12}:[A-Za-z0-9_-]{35}/,             name: 'Telegram Bot Token' },
    { pattern: /AKIA[0-9A-Z]{16}/,                        name: 'AWS Access Key' },
    { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/, name: 'Private Key' },
    { pattern: /mongodb\+srv:\/\/[^\s]+/,                 name: 'MongoDB Connection String' },
    { pattern: /postgres:\/\/[^\s]+/,                     name: 'PostgreSQL Connection String' },
  ];

  const found = [];
  for (const { pattern, name } of SECRET_PATTERNS) {
    if (pattern.test(textToCheck)) {
      found.push(name);
    }
  }

  if (found.length > 0) {
    console.error(`[🔴 母體安全警報] 偵測到可能的硬編碼機密！`);
    console.error(`[🔴 母體安全警報] 發現類型：${found.join('、')}`);
    console.error(`[🔴 母體安全警報] 違反 user_rules.md：「禁止硬編碼 API Key、密碼、Token」`);
    console.error(`[🔴 母體安全警報] 請立即改用 .env 環境變數。`);
  }

  console.log(inputData);
}

// ── Hook 3: .agent/ 變更偵測 + 母體同步提醒 ───────────────────────
// 對應 user_rules.md：「框架變更回寫母體 (Mothership Sync) [HARD]」
function handleMothershipSync(input) {
  const toolOutput = input.tool_output || {};
  const transcript = toolOutput.output || '';

  const SYNC_TRIGGERS = [
    '.agent/skills/',
    '.agent/workflows/',
    '.agents/skills/',
    'user_rules.md',
    'AGENTS.md',
  ];

  const triggerFound = SYNC_TRIGGERS.filter(trigger => transcript.includes(trigger));

  if (triggerFound.length > 0) {
    console.error(`[🔄 母體同步] 偵測到框架級變更：${triggerFound.join('、')}`);
    console.error(`[🔄 母體同步] 依 user_rules.md「框架變更回寫母體」硬規則，`);
    console.error(`[🔄 母體同步] 請詢問使用者：「是否將此變更同步回寫至 C:\\PixiuCore？」`);
  }

  console.log(inputData);
}
