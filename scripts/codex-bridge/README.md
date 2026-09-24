# Codex Bridge — Codex 治理 hooks 接線層

讓 Codex（CLI／桌面）接上母體治理 hooks（guardrails、auto-recap、thread-watcher 等）。
本目錄的 bridge 檔納入母體 repo，路徑解析使用 `PIXIU_CORE` fallback，跨機可攜。

## 部署

前置：`node` 在 PATH；設好 `PIXIU_CORE`（或 `PIXIU_CORE_PATH`）指向母體 repo 根。

```bash
node scripts/setup/install-to-codex.js
```

這會讀 `hooks.template.json`，以本機實際 Node 與 bridge 路徑產生
`%USERPROFILE%\.codex\hooks.json`。覆寫前會備份既有設定。

## 檔案

- `pixiu-global-hook-bridge.js` — Codex hooks 入口。
- `pixiu-mothership-hook-bridge.js` — 派發到母體 `scripts/hooks/*.js`。
- `pixiu-thread-watcher.js` — thread watcher、session-end、auto-recap。
- `pixiu-auto-recap-bridge.js` — auto-recap 接線。
- `pixiu-chat-bridge.js` — Pixiu Chat Bridge probe protocol、生命週期與驗證 gate。
- `pixiu-chat-probe.js` — probe CLI。
- `pixiu-chat-bridge.test.js` — Bridge 回歸測試。
- `hooks.template.json` — Codex hooks 模板。

# Pixiu Chat Bridge

目前這個模組是 **Native Chat transport 的驗證骨架與 fail-closed probe**，不是一般 Chat 諮詢代理，也沒有宣告 Native Chat E2E 已完成。

目標是驗證 Codex App 能否在：

- 不使用 OpenAI API Key；
- 不依賴人工 copy/paste；
- 有可核對的送出與 read-back 證據；

的條件下，自動送訊息到指定 ChatGPT Chat 並讀回答覆。

## 驗證層級

### Protocol Verified

`protocolVerified=true` 只代表：

- request / response schema 正確；
- `probeId + nonce` correlation 正確；
- request 未過期，回覆時間合理；
- evidence 欄位存在且型別正確；
- transport / authMode 是已知組合；
- `apiKeyUsed=false`；
- `manualCopy=false`；
- `readBack=true`。

### Native Verified

截至目前：

```text
nativeVerified = false
```

這是刻意的 fail-closed 行為。

即使呼叫端傳入 `nativeAttested=true`、偽造 transport 名稱或手填 evidence，也不能將
`nativeVerified` 變成 `true`。必須等真正受信任的 Codex App native adapter 能產生可核對的
send/read receipt 後，才會新增 Native 驗收路徑。

## Probe 生命週期防護

Bridge 現在具備：

- 送出前 TTL / expiresAt 驗證。
- send / read / evidence 共用 deadline。
- read 永不回覆會 timeout。
- cancel 本身也有等待上限，不會反過來卡死 timeout。
- send / read / timeout 都會留下 `FAILED` 終態。
- 相同 `probeId` 使用本機 probe state 防止二次送出。
- send outcome unknown 時不自動重送。
- live verify 使用系統時鐘，不接受 caller 以 `now` 回溯有效期限。
- `respondedAt` 不得早於 request，也不得晚於有效期限。

## Evidence 與 Log 防護

必要 evidence：

```json
{
  "transport": "synthetic | chatgpt-desktop-native",
  "authMode": "synthetic | chatgpt-session",
  "apiKeyUsed": false,
  "manualCopy": false,
  "readBack": true
}
```

規則：

- boolean 必須是真正 boolean；缺欄位或 `"true"` / `"false"` 字串都會 FAIL。
- 未知 transport / authMode 或錯誤組合會 FAIL。
- `sessionFingerprint` 只接受 `sha256:<64 hex>`。
- 過長／無效 evidence 不會原樣保存到 ledger。
- adapter error message 中常見 Authorization、API key、token、cookie、secret、password 值會遮罩。
- ledger 位於 `state/chat-bridge/`；`state/` 已由 repo `.gitignore` 排除。

## CLI

建立 probe：

```bash
node scripts/codex-bridge/pixiu-chat-probe.js create
```

驗證 protocol response：

```bash
node scripts/codex-bridge/pixiu-chat-probe.js verify < verification-input.json
```

執行 synthetic round-trip：

```bash
node scripts/codex-bridge/pixiu-chat-probe.js synthetic
```

Synthetic success 必須同時符合：

```text
result           = PASS
protocolVerified = true
nativeVerified   = false
```

否則 CLI 以非零 exit code 結束。

## CI 與 Critical Relay

Workflow：

`.github/workflows/pixiu-chat-bridge.yml`

目前 CI 會依序執行：

```bash
node --test scripts/codex-bridge/pixiu-chat-bridge.test.js
node scripts/codex-bridge/pixiu-chat-probe.js synthetic
node scripts/critical-relay/critical-relay.js check docs/validation/20260923-pixiu-chat-bridge-cr-state.json
```

已驗證：

- GitHub Actions Run 35：`35837910802`，27/27 Bridge regression tests + synthetic probe 成功。
- GitHub Actions Run 37：`35838613880`，Bridge regression tests + synthetic probe + Critical Relay completion gate 全數成功。

CR canonical state：

`docs/validation/20260923-pixiu-chat-bridge-cr-state.json`

## Native transport 能力邊界

截至 2026-09-23，OpenAI 公開文件可確認：

- Codex `app-server` 可建立／續接 Codex thread、啟動 turn、接收事件與處理核准。
- 桌面 App 中 ChatGPT 與 Codex 可在同一應用程式切換，但 Codex history 與 ChatGPT history 仍分開。

目前沒有從官方公開文件確認「程式化指定既有 ChatGPT Chat，對它送訊息並自動讀回答覆」的正式介面。

因此：

- 不使用未公開 IPC。
- 不呼叫內部未公開 API。
- 不以 UI 自動化冒充 native transport。
- 不把 Codex app-server 的 Codex thread 當成既有 ChatGPT Chat。

官方參考：

- https://developers.openai.com/zh-Hant/blog/codex-as-a-platform
- https://help.openai.com/en/articles/20001275/

## Native 最終驗收條件

未來若有正式 transport，至少要取得：

```text
PROBE_ID          = <unique id>
SEND              = PASS
CHAT_RECEIVED     = PASS
READ_BACK         = PASS
API_KEY_USED      = false
MANUAL_COPY       = false
TRANSPORT         = <實際 native transport>
RUNTIME_RECEIPT   = <可核對證據>
PROTOCOL_VERIFIED = true
NATIVE_VERIFIED   = true
```

在此之前，Native Chat Bridge 保持未驗收狀態。

## 可選依賴

- **wiki capture**：`pixiu-thread-watcher.js` 的 `runWikiCapture` 需要 `PIXIU_WIKI_POC`；
  未設定時自動 skip，不影響核心。
