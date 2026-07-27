# Codex Lazy-Loading Guidance

共同治理以根目錄 `AGENTS.md` 與 `vault/bootstrap/SESSION-BOOTSTRAP.md` 為準。

## 啟動

- 不列舉或全文載入 `.agents/skills/`。
- 先執行 `node scripts/router/resolve-capabilities.js "<本次需求>"`，只讀 `filesToLoad`，最多 3 個 Capability。
- Router 無法執行時才以 `vault/capabilities/capability-manifest.json` 降級；未命中時使用 Bootstrap 與 repo 原始碼，不退回全量掃描。
- 子 Agent 僅在使用者明確同意後使用，且只接收精簡任務包。

```powershell
node scripts/router/resolve-capabilities.js "<本次需求>"
```

## 邊界

- 寫入、刪除、依賴、DB 與 Git push 遵守根入口審批規則。
- 修改後重讀變更檔、檢查 `git diff`，並執行最小充分驗證。
- Project-local 與全域 Skill 同時被 discovery 是宿主索引行為，不代表兩份全文進入 Context。
- 詳細政策按需讀取 `vault/context/ai-mothership-loading-policy.md`、`vault/governance/judgment-rubrics.md` 與 `vault/governance/model-dispatch-rules.md`。
