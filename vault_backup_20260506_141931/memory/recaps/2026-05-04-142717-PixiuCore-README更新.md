---
type: session-recap
日期: 2026-05-04
主題: "PixiuCore gravityTest 版 README 更新"
狀態: 完成
負責AI: Codex
專案: "pixiu-core"
tags: [recap, session, pixiucore, readme]
---

# Session Recap：PixiuCore gravityTest 版 README 更新

## 🎯 任務目標與背景

使用者要求查看 <workspace-root>\pixiu-core 目前內容，並更新根目錄 README.md。背景是原 README 仍保留 2026-04-20 左右的描述，與實際目錄狀態已有落差，像是 setup_zh.bat、.codex/、.opencode/、.agents/、spec-improve 等現況未完整反映。

影響範圍限定在：

- <workspace-root>\pixiu-core\README.md

未修改：

- %PIXIU_CORE%\user_rules.md
- <workspace-root>\pixiu-core\user_rules.md
- 安裝腳本、skills、hooks、vault 內容

## ✅ 本次完成

1. 依 PixiuCore 啟動規則讀取母體 context：ault/README.md、user_rules.md、ounder-profile.md、gent-persona.md、memory-summary.md，並因目前工作目錄為 PCLMS，也讀取 pclms-overview.md 與 	ech-stack.md。
2. 盤點 <workspace-root>\pixiu-core 實際內容，確認頂層目錄包含 .agent/、.agents/、.codex/、.cursor/、.opencode/、gents/、commands/、skills/、Tools/、ault/ 等。
3. 實際計數：頂層 Agents 27、ECC Agents 28、Commands 58、ECC Workflows 79、頂層 Skills 66、ECC Skills 142、OpenAI 可攜 Skills 43、Rules 51、Fleet 路徑 30。
4. 覆寫 README.md 為較短的現況入口文件，內容包含目前狀態、核心觀念、目錄導覽、安裝與同步、Session 啟動規則、維護原則、快速盤點指令、已知技術債與相關文件。
5. 清除 README UTF-8 BOM，避免 Git diff 第一行出現隱藏字元。
6. 用 Git diff 驗證只改 README.md，結果為 128 insertions / 714 deletions，另有 Windows 換行提示 LF will be replaced by CRLF，非內容錯誤。

## 🔄 進行中

- 目前步驟：README 更新已完成，正在依使用者 
ecap 要求回寫母體記憶。
- 整體進度：1 / 1 Phase 完成。
- 各 Phase 狀態：
  - Phase 1 盤點與 README 翻修：✅ 完成
  - Phase 2 Recap 回寫：✅ 完成後等待下次任務
- 卡點：無實作卡點；Git status 一開始遇到 dubious ownership，後續用 -c safe.directory=... 只針對該指令放行讀 diff，未修改全域 git 設定。

## 📐 當前規劃完整內容

README 的新定位改成「入口地圖」而非完整百科。這樣做是把大型母艦文件從巨量介紹翻修成可維護的導覽文件，讓使用者能快速知道：目前有什麼、從哪裡裝、哪些數字可信、哪些地方還有債。

新 README 結構：

1. 目前狀態：列盤點日期、路徑與實際數量。
2. 核心觀念：用治理層、能力層、記憶層說明 PixiuCore 的三層地基。
3. 目錄導覽：逐項說明根目錄與隱藏目錄用途。
4. 安裝與同步：區分 setup_zh.bat、setup.bat、Claude CLI setup、uninstall 與 Fleet 同步工具。
5. Session 啟動規則：記錄 PIXIU_CORE 優先，缺省回 %PIXIU_CORE%，並列必讀 vault 檔案。
6. 維護原則：提醒不要整包載入、分享前清理個人資料、新增 skill 時同步多個技能位置。
7. 快速盤點指令：提供 PowerShell 計數方式，避免未來 README 數字再漂移。
8. 已知技術債：記錄 PIXIU_CORE / PIXIU_CORE_PATH 併存、setup 腳本職責不一致、SKILLS_INDEX.md 過期等問題。

## 🎯 重要決策（含棄選方案）

| 決策點 | 選擇 | 棄選方案 | 原因 |
|--------|------|---------|------|
| README 形式 | 改成短版現況入口文件 | 保留長篇百科式 README 逐段修補 | 目前母艦內容變動快，短版入口較容易維護，避免數字與敘述再次過期 |
| 改動範圍 | 只修改 gravityTest 版 README.md | 同步修改 %PIXIU_CORE% 或 SKILLS_INDEX.md | 使用者只要求看 gravityTest pixiu-core 並更新 README，依最小改動原則不擴張 |
| 數量呈現 | 以實際檔案盤點數字為準 | 沿用舊 README / SKILLS_INDEX 的 176+ / 177 數字 | 盤點結果顯示舊數字已不精準，README 應反映目前地基狀態 |
| 環境變數說法 | 明列 PIXIU_CORE 與 PIXIU_CORE_PATH 併存為技術債 | 直接擇一寫成標準 | 目前不同規則與腳本使用不同名稱，未經完整相容性確認不應直接宣告統一 |

## ⚠️ 發現的問題 / 踩坑

- PIXIU_CORE 與 PIXIU_CORE_PATH 併存：啟動規則偏向 PIXIU_CORE，安裝腳本多設定 PIXIU_CORE_PATH。後續應統一或明確定義橋接策略。
- setup.bat 與 setup_zh.bat 職責不一致：setup_zh.bat 較完整，setup.bat 較偏 Gemini，README 已標出差異。
- SKILLS_INDEX.md 仍偏舊：內文顯示 176+ / 76 / 50 等舊數字，尚未翻修。
- Git dubious ownership：sandbox 使用者與 repo owner 不同，Git 操作需加 -c safe.directory=...，未做全域設定。
- README 換行提示：Git 顯示 LF will be replaced by CRLF，目前僅為 Windows 換行提示，不影響 Markdown 內容。

## 📌 下次 session 要做的事

優先執行：

- [ ] 若要讓文件群一致，下一步翻修 <workspace-root>\pixiu-core\SKILLS_INDEX.md，用同一批盤點數字更新。
- [ ] 檢查 setup.bat 與 setup_zh.bat 是否要合併主入口，或標示 legacy。
- [ ] 比對 %PIXIU_CORE% 與 <workspace-root>\pixiu-core 的 README 是否需要同步。

可並行：

- [ ] 盤點 .agent/skills、skills/、.agents/skills 三套 skill 來源與同步規則。
- [ ] 檢查 pack-for-friend 是否排除 ault/identity、ault/memory 與大型 Backup/。

待確認（需使用者決策）：

- [ ] 是否將這次 README 更新同步回正式母體 %PIXIU_CORE%。
- [ ] 是否把 PIXIU_CORE / PIXIU_CORE_PATH 統一成單一標準。

## 💾 關鍵狀態

- 專案：pixiu-core
- 工作路徑：<workspace-root>\pixiu-core
- 改動檔案：README.md
- 尚未 commit 的變更：有，README.md 已修改。
- 驗證：UTF-8 讀取成功、BOM 已清除、Git diff 只顯示 README 變更。