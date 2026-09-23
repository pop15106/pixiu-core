# Codex Bridge — Codex 治理 hooks 接線層

讓 Codex（CLI／桌面）接上母體治理 hooks（guardrails 四道、auto-recap、thread-watcher 等）。
本目錄的 bridge 檔納入母體 repo，路徑解析全用 `PIXIU_CORE` fallback，跨機可攜。

## 部署（別人 clone 母體後）

前置：`node` 在 PATH；設好 `PIXIU_CORE`（或 `PIXIU_CORE_PATH`）指向母體 repo 根。

```
node scripts/setup/install-to-codex.js
```

這會讀 `hooks.template.json`、用「這台機器」的實際 node 與 bridge 路徑，
生成 `%USERPROFILE%\.codex\hooks.json`（覆寫前自動備份）。node 路徑用
`process.execPath` 動態取得，不寫死。

## 檔案

- `pixiu-global-hook-bridge.js` — 入口：分流 watcher 模式與母體派發
- `pixiu-mothership-hook-bridge.js` — 派發到母體 `scripts/hooks/*.js`（用 corePath）
- `pixiu-thread-watcher.js` — thread watcher：observations、session-end、auto-recap 觸發
- `pixiu-auto-recap-bridge.js` — auto-recap 接線
- `pixiu-chat-bridge.js` — Pixiu Chat Bridge probe protocol、correlation、timeout、ledger 與驗證 gate
- `pixiu-chat-probe.js` — 建立／驗證／synthetic probe 的 CLI
- `hooks.template.json` — hooks.json 模板（command 用佔位符，不含機器路徑）

## Pixiu Chat Bridge

目標是驗證 Codex App 是否可在不使用 OpenAI API Key、也不靠人工 copy/paste 的情況下，
把 probe 自動送到 ChatGPT Chat，再由 Codex 自動讀回回覆。

### 先跑 synthetic gate

```bash
node --test scripts/codex-bridge/pixiu-chat-bridge.test.js
node scripts/codex-bridge/pixiu-chat-probe.js synthetic
```

synthetic PASS 只代表：

- request / response schema 正常
- `probeId` 與 `nonce` correlation 正常
- timeout / stale response 防護正常
- ledger 正常
- API Key／人工 copy-paste／未 read-back 的負向 gate 正常

**synthetic PASS 不等於 native bridge 已驗收。**

### 建立 native probe

```bash
node scripts/codex-bridge/pixiu-chat-probe.js create
```

CLI 會產生 request 與只要求 Chat 回傳單行 JSON 的 prompt。

真正的 native transport 必須由 Codex App runtime 提供，並在讀回後送進 `verifyProbe()`。
目前官方文件確認新版桌面 App 同時提供 Chat、Work、Codex，且 Codex 中有 Quick Chat；
但 Codex 與 ChatGPT history 仍是分開的 view。Repo 不會自行假設未公開的 app IPC／handoff API。

### Native 驗收必要條件

只有以下條件全部成立，才能把原生單輪 round trip 標成 VERIFIED：

```text
SEND           = PASS
CHAT_RECEIVED  = PASS
READ_BACK      = PASS
API_KEY_USED   = false
MANUAL_COPY    = false
TRANSPORT      = <實際 native transport>
RESULT         = PASS
```

CI 只能驗證 synthetic gate。真實 Codex App native read-back 必須在 App runtime 做最後實機 Gate，
不得用 synthetic transport 冒充。

## 可選依賴

- **wiki capture**：`pixiu-thread-watcher.js` 的 `runWikiCapture` 需要 `PIXIU_WIKI_POC`
  環境變數（或 `~/Documents/Playground/kc-llm-wiki-poc`）。未設定時自動 skip，不影響核心。
