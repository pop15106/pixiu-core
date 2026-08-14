# PixiuCore Gemini Global Entry

<!-- PIXIU-GLOBAL-ENTRY:1 tool=gemini -->

1. 依序解析 `PIXIU_CORE`、`PIXIU_CORE_PATH`、`%USERPROFILE%\.pixiu-core`，將第一個有效母體路徑視為 `<core>`。
2. 讀取 `<core>\GEMINI.md`；依入口協議載入 `<core>\vault\bootstrap\SESSION-BOOTSTRAP.md`。
3. 對本次需求執行 `node <core>\scripts\router\resolve-capabilities.js "<需求>"`。
4. 只讀 Router 回傳的 `filesToLoad`；Router 失敗時才使用入口檔定義的降級流程。
5. 本檔只做路由，不複製治理規則、Skill 清單、Hook 定義、模型表或長期記憶。
