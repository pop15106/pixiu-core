---
type: bootstrap
date: 2026-09-23
lastVerified: 2026-09-23
project: PIXIUCORE
system: PIXIUCORE
topic: git-fallback-bootstrap
status: active
tags: [pixiucore, bootstrap, git-fallback, github, routing]
summary: 本機 PixiuCore／DevSpace 不可用時，從 GitHub canonical repo 建立獨立 checkout，載入同一份 Session Bootstrap 與 Capability Router。
---

# PixiuCore Git Fallback Bootstrap

## 目的

當本機 PixiuCore 或 DevSpace 不可用，但使用者明確要求「切 Git／改用 Git／Git fallback／GitHub 直接改」時，從 GitHub canonical repo 載入同一份母體治理，避免因環境切換而失去 PixiuCore 規則。

## Canonical Source

- Repository：`https://github.com/pop15106/pixiu-core.git`
- Default branch：`master`
- 本機母體可用時仍以本機母體優先，不主動切 Git。

## 啟動條件

同時滿足以下條件才使用 Git fallback：

1. `PIXIU_CORE`、`PIXIU_CORE_PATH`、`%USERPROFILE%\.pixiu-core` 都無法解析出有效 PixiuCore，或使用者已明確說 DevSpace／本機母體不可用。
2. 使用者明確要求「切 Git」、「改用 Git」、「Git fallback」、「GitHub 直接改」或等效語意。

單純提到 Git、GitHub、commit、push 不代表自動啟用 Git fallback。

## Checkout 規則

1. clone／fetch 到**獨立暫存或快取目錄**。
2. 不得 clone 到目前業務 repo、專案 repo 或其子目錄。
3. 以 GitHub `master` 最新內容為 source of truth；先 fetch，再確認實際 HEAD。
4. 不使用 `reset --hard`、force push 或其他破壞性同步方式作 bootstrap。
5. 不把 PAT、Token、Credential、Authorization header 寫入文件、log、recap 或 commit。
6. GitHub 無法存取時，明確回報錯誤；不得靜默退回沒有母體治理的模式。

## 載入順序

取得有效 `<core>` 後：

1. 讀取本檔 `vault/bootstrap/GIT-FALLBACK-BOOTSTRAP.md`。
2. 讀取對應宿主入口：Codex／Claude／Gemini 的 PixiuCore entry。
3. 讀取 `vault/bootstrap/SESSION-BOOTSTRAP.md`。
4. 對使用者本次需求執行：`node <core>/scripts/router/resolve-capabilities.js "<本次需求>"`。
5. 只載入 Router 回傳的 `filesToLoad`；最多 3 個 Capability。
6. 若使用者同時要求「完整自動接力／自動接力」，必須載入 `vault/governance/long-running-progress-policy.md` 並維持可見進度與輪詢心跳。

## 行為一致性

Git fallback 只更換母體**來源位置**，不建立另一套治理。

- L0 仍以 `user_rules.md` 為最高專案憲法。
- Session 常駐摘要仍以 `SESSION-BOOTSTRAP.md` 為準。
- Capability 仍由同一份 `capability-manifest.json` 與 `resolve-capabilities.js` 路由。
- Recap、審批、安全、Agent Team、Git push、Release 等權限不因 fallback 改變。
- 使用者本次明確限制（例如「不要派 Agent/subagent」）持續有效。

## 完成與失敗

- 成功取得 GitHub 母體後，回報目前使用的 commit SHA。
- 失敗時回報卡在哪一層：Repository 存取、checkout、Bootstrap、Router 或 filesToLoad。
- 若本機與 Git fallback 都不可用，停止需要母體治理的寫入操作並明確告知使用者；不得假裝已載入 PixiuCore。
