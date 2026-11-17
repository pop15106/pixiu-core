# PixiuCore 共同入口

本 repository 由 PixiuCore 治理；所有 AI 工具都從本檔進入。

## 啟動

1. 定位母體 `<core>`：`PIXIU_CORE` → `PIXIU_CORE_PATH` → 家目錄的 `.pixiu-core`（Windows：`%USERPROFILE%\.pixiu-core`）→ 含 `vault/bootstrap/SESSION-BOOTSTRAP.md` 的目前 repo。
2. 讀 `<core>/vault/bootstrap/SESSION-BOOTSTRAP.md` 並照做；其餘檔案只在它或 Router 指到時才讀。
3. 執行 `node <core>/scripts/router/resolve-capabilities.js "<本次需求>"`，只讀 `filesToLoad`；不能執行指令時改查 `<core>/vault/capabilities/ROUTING.md`。
4. 其餘制度從 `<core>/vault/governance/INDEX.md` 按需路由。

## 工具專屬差異

Claude 另讀 `CLAUDE.md`，Codex 另讀 `.codex/AGENTS.md`，Gemini 另讀 `GEMINI.md`。其他工具照上方流程即可；沒有 Hook 或 Skill 機制時，手動讀取路由命中的檔案。

## 專案結構

- `skills/` 是 Skill 來源，`.agents/skills/` 是 Codex／OpenAI 可攜發佈層。
- 入口檔不列 Skill 或 Agent 清單；新增能力時更新 Capability Manifest 並重跑 `node scripts/router/build-routing-index.js`。
