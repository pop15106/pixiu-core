# Codex Connection Protocol

共同入口是母體的 `AGENTS.md`；下方啟動流程與它逐字相同，Codex 專屬差異集中在 `<core>/.codex/AGENTS.md`。

## 啟動

1. 定位母體 `<core>`：`PIXIU_CORE` → `PIXIU_CORE_PATH` → 家目錄的 `.pixiu-core`（Windows：`%USERPROFILE%\.pixiu-core`）→ 含 `vault/bootstrap/SESSION-BOOTSTRAP.md` 的目前 repo。
2. 讀 `<core>/vault/bootstrap/SESSION-BOOTSTRAP.md` 並照做；其餘檔案只在它或 Router 指到時才讀。
3. 執行 `node <core>/scripts/router/resolve-capabilities.js "<本次需求>"`，只讀 `filesToLoad`；不能執行指令時改查 `<core>/vault/capabilities/ROUTING.md`。
4. 其餘制度從 `<core>/vault/governance/INDEX.md` 按需路由。

## Codex 專屬

接著讀 `<core>/.codex/AGENTS.md`：Codex 職責、Skill discovery 注意事項與 Hermes 路由都在那裡，本檔不重複。
