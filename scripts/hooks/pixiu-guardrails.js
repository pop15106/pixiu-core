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

const path = require('path');
const os = require('os');
const PIXIU_CORE = process.env.PIXIU_CORE_PATH || path.resolve(__dirname, '../..');

const hookId = process.argv[2] || '';

let inputData = '';
process.stdin.on('data', chunk => inputData += chunk);
process.stdin.on('end', () => {
  try {
    // DEBUG: 僅在 PIXIU_HOOK_DEBUG=1 時記錄原始輸入（對話內容不應常駐磁碟）
    if (process.env.PIXIU_HOOK_DEBUG === '1') {
      require('fs').writeFileSync(path.join(PIXIU_CORE, 'scripts', 'hooks', 'debug-input.json'), inputData);
    }
    const input = JSON.parse(inputData);

    switch (hookId) {
      case 'pre:pixiu:change-scope':
        handleChangeScope(input);
        break;
      case 'pre:pixiu:auto-mode-guard':
        handleAutoModeGuard(input);
        break;
      case 'post:pixiu:secret-scan':
        handleSecretScan(input);
        break;
      case 'stop:pixiu:mothership-sync':
        handleMothershipSync(input);
        break;
      default:
        // 未知 hook ID，靜默通過（stdout 只允許 JSON 輸出）
        break;
    }
  } catch (err) {
    // Hook 錯誤不應阻斷主流程
    console.error(`[pixiu-guardrails] 錯誤: ${err.message}`);
  }
});

// ── Hook 1: 大規模變更警告 ────────────────────────────────────────
// 對應 user_rules.md：「最小改動原則」
function handleChangeScope(input) {
  const toolInput = input.tool_input || {};
  const msgs = [];

  if (input.tool_name === 'MultiEdit') {
    msgs.push('偵測到 MultiEdit：user_rules.md 最小改動原則，請確認多檔修改都是必要的。');
  }
  if (input.tool_name === 'Write') {
    const filePath = toolInput.file_path || '';
    if (filePath.includes('.agent/') || filePath.includes('.agents/')) {
      msgs.push(`偵測到 .agent/ 變更：完成後須詢問使用者是否同步至 ${PIXIU_CORE}。`);
    }
  }
  if (msgs.length > 0) {
    console.log(JSON.stringify({ systemMessage: `[🛡️ 母體治理] ${msgs.join(' ')}` }));
  }
}

// ── Hook 2: API Key 洩露掃描 ──────────────────────────────────────
// 對應 user_rules.md：「禁止硬編碼 API Key、密碼、Token」
function handleSecretScan(input) {
  const toolResponse = input.tool_response ?? input.tool_output ?? '';
  const content = typeof toolResponse === 'string' ? toolResponse : JSON.stringify(toolResponse);
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
    { pattern: /AIza[0-9A-Za-z_-]{35}/,                   name: 'Google API Key' },
    { pattern: /xox[bp]-[A-Za-z0-9-]{10,}/,               name: 'Slack Token' },
    { pattern: /glpat-[A-Za-z0-9_-]{20,}/,                name: 'GitLab Token' },
    { pattern: /npm_[A-Za-z0-9]{36}/,                     name: 'npm Token' },
  ];

  const found = [];
  for (const { pattern, name } of SECRET_PATTERNS) {
    if (pattern.test(textToCheck)) {
      found.push(name);
    }
  }

  if (found.length > 0) {
    // PostToolUse 的 exit 0 stderr 模型看不到；JSON decision:block 的 reason 會回饋給 Claude（官方 hooks 文件）
    console.log(JSON.stringify({
      decision: 'block',
      reason: `[🔴 母體安全警報] 偵測到可能的硬編碼機密（${found.join('、')}）。違反 user_rules.md「禁止硬編碼 API Key、密碼、Token」——請立即改用 .env 環境變數，並清除剛寫入的機密內容。`,
      systemMessage: `[🔴 母體安全警報] 疑似硬編碼機密：${found.join('、')}`
    }));
  }
}

// ── Hook 2b: Auto mode 授權閘門 ───────────────────────────────────
// 對應 user_rules.md：「🚦 Auto mode 授權閘門 [NEW][HARD]」
// 攔截：
//   1. 寫入 ~/.claude/settings.json 且含 "defaultMode": "auto"
//   2. Bash 指令使用 --dangerously-skip-permissions
// 放行條件：vault/memory/auto-mode-audit.log 最後一筆「進入」紀錄於 5 分鐘內
function handleAutoModeGuard(input) {
  const toolName = input.tool_name || '';
  const toolInput = input.tool_input || {};

  let trigger = null;
  let detail = '';

  // 檢查 1：settings.json 全域 defaultMode=auto
  if (['Edit', 'Write', 'MultiEdit'].includes(toolName)) {
    const filePath = toolInput.file_path || '';
    const content = toolInput.new_string || toolInput.content || '';
    const isSettingsFile = /\.claude[\\\/]settings\.json$/i.test(filePath);
    const hasAutoMode = /"defaultMode"\s*:\s*"auto"/i.test(content);
    if (isSettingsFile && hasAutoMode) {
      trigger = 'settings.json 全域 defaultMode=auto';
      detail = `目標檔案：${filePath}`;
    }
  }

  // 檢查 2：Bash / PowerShell 使用 --dangerously-skip-permissions
  if (['Bash', 'PowerShell'].includes(toolName)) {
    const cmd = toolInput.command || '';
    if (/--dangerously-skip-permissions/.test(cmd)) {
      trigger = '--dangerously-skip-permissions 旗標';
      detail = `指令：${cmd.length > 120 ? cmd.substring(0, 117) + '...' : cmd}`;
    }
  }

  if (!trigger) {
    return;
  }

  // 查最近授權紀錄
  const recentAuth = checkRecentAutoModeAuthorization();

  if (!recentAuth) {
    console.error('[🚨 Pixiu 憲法] Auto mode 授權閘門觸發！');
    console.error(`[🚨 Pixiu 憲法] 偵測類別：${trigger}`);
    console.error(`[🚨 Pixiu 憲法] ${detail}`);
    console.error('[🚨 Pixiu 憲法] 依 user_rules.md「🚦 Auto mode 授權閘門 [HARD]」規則：');
    console.error('[🚨 Pixiu 憲法]   1. 先執行 skills/claude-code-auto-mode-policy/SKILL.md');
    console.error('[🚨 Pixiu 憲法]   2. 跑三步驟：黑名單掃描 → 授權聲明 → 等使用者回「開」');
    console.error('[🚨 Pixiu 憲法]   3. 寫入 vault/memory/auto-mode-audit.log 後 5 分鐘內本操作才放行');
    console.error('[🚨 Pixiu 憲法] 建議改用 Shift+Tab 切 session 層級 Auto mode（不動全域設定）。');
    process.exit(2);
  }

  // 5 分鐘內有授權，放行但標註
  console.log(JSON.stringify({ systemMessage: '[🟢 Pixiu 憲法] Auto mode 授權檢核通過（5 分鐘內有 audit.log 進入紀錄）' }));
}

function checkRecentAutoModeAuthorization() {
  try {
    const fs = require('fs');
    const auditPath = path.join(PIXIU_CORE, 'vault', 'memory', 'auto-mode-audit.log');
    if (!fs.existsSync(auditPath)) return false;
    const log = fs.readFileSync(auditPath, 'utf8');
    const lines = log.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return false;
    // 從尾端往前找最近一筆「進入」紀錄
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = lines[i].match(/\[([^\]]+)\]｜進入｜/);
      if (m) {
        const t = new Date(m[1]);
        const diffMin = (Date.now() - t.getTime()) / 60000;
        return diffMin >= 0 && diffMin < 5;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ── Hook 3: .agent/ 變更偵測 + 母體同步提醒 ───────────────────────
// 對應 user_rules.md：「框架變更回寫母體 (Mothership Sync) [HARD]」
function handleMothershipSync(input) {
  const fs = require('fs');
  // Stop 事件輸入沒有 tool_output（官方 hooks 文件）；改讀 transcript，只掃「實際寫入操作」的路徑，避免誤報
  const transcriptPath = input.transcript_path || '';
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return;
  if (input.stop_hook_active) return; // 防 Stop 迴圈

  const sessionKey = String(input.session_id || 'unknown').replace(/[^a-zA-Z0-9-]/g, '').slice(-12) || 'unknown';
  const markerPath = path.join(os.tmpdir(), `pixiu-msync-${sessionKey}`);
  if (fs.existsSync(markerPath)) return; // 本 session 已提醒過，不重複擋

  const SYNC_TRIGGERS = ['.agent/', '.agents/', '.agent\\', '.agents\\', 'user_rules.md', 'AGENTS.md'];
  const writtenHits = new Set();
  for (const line of fs.readFileSync(transcriptPath, 'utf8').split(/\r?\n/)) {
    if (!line) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    const blocks = (entry.type === 'assistant' && Array.isArray(entry.message?.content)) ? entry.message.content : [];
    for (const b of blocks) {
      if (b.type !== 'tool_use' || !['Edit', 'Write', 'MultiEdit'].includes(b.name || '')) continue;
      const fp = b.input?.file_path || '';
      if (fp && SYNC_TRIGGERS.some(tr => fp.includes(tr))) writtenHits.add(fp);
    }
  }
  if (writtenHits.size === 0) return;

  try { fs.writeFileSync(markerPath, new Date().toISOString()); } catch {}
  console.log(JSON.stringify({
    decision: 'block',
    reason: `[🔄 母體同步] 本 session 修改了框架級檔案：${Array.from(writtenHits).slice(0, 5).join('、')}。依 user_rules.md「框架變更回寫母體」硬規則，請詢問使用者是否將變更同步回寫至母體（${PIXIU_CORE}），確認後即可結束。`
  }));
}
