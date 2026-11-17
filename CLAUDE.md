# Claude Connection Protocol

共同入口是母體的 `AGENTS.md`，下方啟動流程與它逐字相同；本檔另補 Claude 專屬差異。

## 啟動

1. 定位母體 `<core>`：`PIXIU_CORE` → `PIXIU_CORE_PATH` → 家目錄的 `.pixiu-core`（Windows：`%USERPROFILE%\.pixiu-core`）→ 含 `vault/bootstrap/SESSION-BOOTSTRAP.md` 的目前 repo。
2. 讀 `<core>/vault/bootstrap/SESSION-BOOTSTRAP.md` 並照做；其餘檔案只在它或 Router 指到時才讀。
3. 執行 `node <core>/scripts/router/resolve-capabilities.js "<本次需求>"`，只讀 `filesToLoad`；不能執行指令時改查 `<core>/vault/capabilities/ROUTING.md`。
4. 其餘制度從 `<core>/vault/governance/INDEX.md` 按需路由。

## Claude 邊界

- Hooks 以 `ECC_HOOK_PROFILE=minimal|standard|strict` 控制成本。
- `/devfleet`、`/multi-plan`、`/orchestrate` 或其他 Agent Team 能力需使用者明確同意。
- 子 Agent 只接收精簡任務包，不重讀完整母體。
- 完成前重讀修改檔、檢查差異並執行最小充分驗證。
