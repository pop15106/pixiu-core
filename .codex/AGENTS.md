# Codex Lazy-Loading Guidance

共同入口是根目錄 `AGENTS.md`，硬閘門以 `vault/bootstrap/SESSION-BOOTSTRAP.md` 為準；本檔只補 Codex 專屬差異。

## 啟動

- 不列舉或全文載入 `.agents/skills/`。
- 路由一律先執行 `node scripts/router/resolve-capabilities.js "<本次需求>"`，只讀 `filesToLoad`。
- Project-local 與全域 Skill 同時被 discovery 是宿主索引行為，不代表兩份全文進入 Context。

## Codex 職責

- 實作前確認需求、允許路徑與驗證標準。
- 程式碼審查重點：正確性、邊界值、失敗路徑、回歸風險、安全與可攜性。
- 子 Agent 僅在使用者明確同意後使用，且只接收精簡任務包。
- 修改後重讀變更檔、檢查 `git diff`，並執行最小充分驗證。

## Hermes 路由

只有使用者明確要求「用 Hermes」「透過 Hermes」「交給 Hermes」「Hermes gate」或同義語句時才啟用；啟用時讀同目錄的 `hermes-routing.md` 並照其指令執行。

## 延伸政策

載入政策見 `vault/context/ai-mothership-loading-policy.md`；其餘制度依 Bootstrap 的治理路由按需讀取。
