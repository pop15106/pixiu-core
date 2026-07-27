# Codex Lazy-Loading Guidance

本檔只補充 Codex 行為；共同治理以根目錄 `AGENTS.md` 與 `vault/bootstrap/SESSION-BOOTSTRAP.md` 為準。

## 啟動

- 不在 Session start 列舉或全文載入 `.agents/skills/`。
- 使用 `vault/capabilities/capability-manifest.json` 判斷本次需求需要的能力。
- 一般需求最多選擇 3 個 Capability，只讀 Manifest 指向的檔案。
- 沒有命中時使用 Bootstrap 與 repo 原始碼，不退回全量掃描。
- 子 Agent 不重讀 Vault，只接收目標、允許路徑、必要 L0 摘要、證據與驗證標準。

可執行：

```powershell
node scripts/router/resolve-capabilities.js "<本次需求>"
```

## Codex 安全邊界

- Agent dispatch 需要使用者在本次對話明確同意。
- 使用 workspace sandbox；寫入、刪除、依賴、DB 與 Git push 遵守根入口審批規則。
- 修改後重讀變更檔、檢查 `git diff`，並執行最小充分驗證。
- Project-local `.agents/skills` 與使用者全域 `~/.agents/skills` 可能由宿主同時 discovery；這是宿主索引行為，不代表需要把兩份 Skill 全文放入對話 Context。

## 路由來源

- Capability：`vault/capabilities/capability-manifest.json`
- 完整載入政策：`vault/context/ai-mothership-loading-policy.md`
- 驗證與完成判準：`vault/governance/judgment-rubrics.md`
- 派工規則：`vault/governance/model-dispatch-rules.md`

不要在本檔維護模型表、完整 Skill 清單、完整 Agent 清單或重複的安全檢查表。
