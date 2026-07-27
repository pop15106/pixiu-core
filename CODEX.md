# Codex Connection Protocol

Codex 以低 Token 模式連結 PixiuCore。

## Session 啟動

1. 解析母體路徑：`PIXIU_CORE` → `PIXIU_CORE_PATH` → `%USERPROFILE%\.pixiu-core`。
2. 讀取 `vault/bootstrap/SESSION-BOOTSTRAP.md`。
3. 讀取 `vault/capabilities/capability-manifest.json`，依本次需求選擇最多 3 個 Capability。
4. 只讀 Manifest 指向的 Skill、Context 與 Governance。

一般 Session 不全文載入：`user_rules.md`、identity、`memory-summary.md`、recap、decisions、全部 Skills、Workflows、Hooks 或 Agents。遇到治理衝突、高風險操作或舊決策查詢時再讀對應原文。

## Codex 職責

- 實作前確認需求、允許路徑與驗證標準。
- 程式碼審查重點：正確性、邊界值、失敗路徑、回歸風險、安全與可攜性。
- 使用者未同意前不得派遣子 Agent；子 Agent 只取得精簡任務包。
- 完成前重讀修改檔、檢查 `git diff`，並執行最小充分驗證。

Capability 路由：

```powershell
node scripts/router/resolve-capabilities.js "<本次需求>"
```

完整制度按需從 `vault/governance/INDEX.md` 路由。
