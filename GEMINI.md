# Gemini Connection Protocol

共同入口是母體的 `AGENTS.md`，下方啟動流程與它逐字相同；本檔另補 Gemini 專屬差異。

## 啟動

1. 定位母體 `<core>`：`PIXIU_CORE` → `PIXIU_CORE_PATH` → 家目錄的 `.pixiu-core`（Windows：`%USERPROFILE%\.pixiu-core`）→ 含 `vault/bootstrap/SESSION-BOOTSTRAP.md` 的目前 repo。
2. 讀 `<core>/vault/bootstrap/SESSION-BOOTSTRAP.md` 並照做；其餘檔案只在它或 Router 指到時才讀。
3. 執行 `node <core>/scripts/router/resolve-capabilities.js "<本次需求>"`，只讀 `filesToLoad`；不能執行指令時改查 `<core>/vault/capabilities/ROUTING.md`。
4. 其餘制度從 `<core>/vault/governance/INDEX.md` 按需路由。

## Gemini 邊界

- 不支援 Skill 或 Hook 時，以「Bootstrap＋路由結果＋手動讀取命中文件」運作。
- 研究與發想結果必須回到正式文件、repo 原始碼或第一手來源驗證。
- Agent Team 或跨模型派工需使用者明確同意。
- Recap、舊決策與跨 Session 工作先讀 `vault/memory/SESSION-INDEX.md`。
- 完成前執行最小充分驗證並回報未確認事項。
