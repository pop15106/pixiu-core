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
- `hooks.template.json` — hooks.json 模板（command 用佔位符，不含機器路徑）

## 可選依賴

- **wiki capture**：`pixiu-thread-watcher.js` 的 `runWikiCapture` 需要 `PIXIU_WIKI_POC`
  環境變數（或 `~/Documents/Playground/kc-llm-wiki-poc`）。未設定時自動 skip，不影響核心。
