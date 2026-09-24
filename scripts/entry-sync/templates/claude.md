# PixiuCore Claude Global Entry

<!-- PIXIU-GLOBAL-ENTRY:1 tool=claude -->

1. 依序解析 `PIXIU_CORE`、`PIXIU_CORE_PATH`、`%USERPROFILE%\.pixiu-core`；找到有效 PixiuCore 時以本機母體為優先，視為 `<core>`。
2. 若本機母體不可用，且本次需求明確包含「切 Git／改用 Git／Git fallback／GitHub 直接改」或等效語意，從 `https://github.com/pop15106/pixiu-core.git` 的 `master` 建立**獨立暫存或快取 checkout** 作為 `<core>`；不得 clone 到業務 repo，也不得記錄 PAT／Token。
3. 使用 Git fallback 時先讀 `<core>\vault\bootstrap\GIT-FALLBACK-BOOTSTRAP.md`；接著讀 `<core>\CLAUDE.md`，再載入 `<core>\vault\bootstrap\SESSION-BOOTSTRAP.md`。
4. 對本次需求執行 `node <core>\scripts\router\resolve-capabilities.js "<需求>"`。
5. 只讀 Router 回傳的 `filesToLoad`；若同時命中完整自動接力，依 `long-running-progress-policy.md` 維持可見進度與輪詢。
6. 本機母體與 Git fallback 都不可用時必須明確報錯，不得靜默降級成沒有 PixiuCore 治理的一般回答。
7. 本檔只做路由，不複製治理規則、Skill 清單、Hook 定義、模型表或長期記憶。
