---
type: memory
readAt: session-init
lastUpdated: 2026-05-06
tags: [memory, pixiucore]
---

# Memory Summary — 最新記憶快照

> 此檔案是跨 session、跨 AI 的共用記憶。
> 每次重要決策或架構變更後請更新。
> AI 每次 session 必讀，確保不需要重新交代背景。
> 詳細 recap 見 [[🏠 Dashboard]] 或 `vault/memory/recaps/` 目錄。

---

## 目前狀態（2026-05-06）

### 進行中的工作

- **PCLMS — 庫存核銷手動調整根因清查（AP）**（已完成唯讀清查，待修正）：已針對 PCLMS_AP 清查 `clearStore`、出倉 CRUD、進倉修改、按月彙報、加工與報廢流程；結論為最高風險不是單一 outstatus，而是多處「先 commit 後核銷」、log I/O 阻斷核銷、進倉流程直接改 `balance`、月彙報 key 漂移與核銷交易邊界不完整。下一步應先用 SQL 比對 outdetail/indetail/balance，再排修交易邊界。 → [[2026-05-06-PCLMS_AP庫存核銷手動調整根因清查]]

<<<<<<< Updated upstream
- **PixiuCore gravityTest README 更新**（已完成）：已將 <workspace-root>\pixiu-core\README.md 翻修為現況入口文件，補上實際盤點數字、目錄導覽、安裝入口、Session 啟動規則與已知技術債；未同步正式母體，待使用者決定。 → [[2026-05-04-142717-PixiuCore-README更新]]
=======
| 日期         | 狀態  | 主題                | 摘要                                        | 連結                                                     |
| ---------- | --- | ----------------- | ----------------------------------------- | ------------------------------------------------------ |
| 2026-05-27 | 已完成 | PERMS AM001/AM002 SQL 分析 | 展開 MyBatis 動態 SQL 為可執行語句，並對比兩支功能在粒度、NOW_STATUS 過濾、跨店查詢等差異 | [[2026-05-27-perms-am001-am002-sql-analysis]] |
| 2026-05-18 | 資料修正待辦 | PCLMS_BK L4 舊格式封包 | 已確認客戶使用舊格式 L4，PM 暫不修流程，改走人工資料修正 | [[2026-05-18-142719-pclms-bk-l4-t1-procedure-pending-recap]] |
| 2026-05-13 | 可測試 | 第二大腦 n8n UI workflow | Code node 版可在 UI publish | [[2026-05-13-000000-second-brain-n8n-ui-publish-workflow]] |
| 2026-05-13 | 已完成 | PISSO 架構分析 | psaab + tv-isso-api 雙專案完整分析，發現 5 項高風險 | [[2026-05-13-PISSO-psaab-tv-isso-api-架構分析]] |
| 2026-05-12 | 可推送 | 第二大腦 GitHub 部署 | 一鍵部署與 release 檢查完成 | [[2026-05-12-123000-second-brain-github-one-click-deploy]] |
| 2026-05-12 | 可用 | 第二大腦 NVIDIA API | 全量索引完成，Qdrant 204 points | [[2026-05-12-114315-second-brain-full-index-and-ops]] |
| 2026-05-11 | 待修復 | PCLMS_BK TS/L8 收訊 | 根因為 PFTZZB pool 帳密失效                      | [[2026-05-11-PCLMS-BK-TS-L8-無法收訊調查]]                   |
| 2026-05-06 | 待修正 | PCLMS_AP 庫存核銷     | 已完成唯讀清查，下一步排修交易邊界                         | [[2026-05-06-PCLMS_AP庫存核銷手動調整根因清查]]                    |
| 2026-05-05 | 待驗證 | PEPIS eDDA 3.4    | Vue bug 已修，待重啟部署驗證                        | [[2026-05-05-PEPIS-eDDA-3.4-Bug修復]]                    |
| 2026-05-04 | 已完成 | PixiuCore README  | gravityTest README 已翻修為現況入口               | [[2026-05-04-142717-PixiuCore-README更新]]               |
| 2026-05-04 | 已調查 | PCLMS 彙報孤兒表頭      | 已確認 `month` 有表頭但缺 `outdetail`             | [[2026-05-04-100000-PCLMS彙報出倉孤兒表頭與未確認報單調查]]            |
| 2026-05-04 | 已完成 | Recap 跨專案回寫       | 已強化 skill / rules，recap 必須回寫母體 vault      | [[2026-05-04-191150-PEPIS-3.4查詢修改與Recap跨專案回寫]]         |
>>>>>>> Stashed changes

- **PCLMS — 按月彙報出倉流程調查與測試資料搬移**（進行中）：已確認按月彙報出倉流程可在前段未完整填原進倉報單項次，後續由彙報確認補齊 `decldetail`、存倉紀錄與 `monthno`；下一步產出 CD178 兩筆報單/料號的測試環境搬移 SQL。 → [[2026-05-04-PCLMS按月彙報出倉調查與Recap技能修正]]

- **PCLMS — CW  1401371477 彙報出倉孤兒表頭調查**（已完成調查）：已確認 `listCatMonthSave` 允許 `iconfirmed=N` 且已放行的報單作為彙報報單號；`25MB0001060022` 目前為有 `month` 表頭但無 `outdetail` 明細的孤兒表頭，後續需追 `CancelMonth / RlsCatMonth_Return / chkOutDetaildel` 等操作痕跡。 → [[2026-05-04-100000-PCLMS彙報出倉孤兒表頭與未確認報單調查]]

- **PEPIS/CCPS eDDA 3.4 Bug 修復**（已修復，待重啟部署驗證）：修復 EachAuthApplyQuery `computeAvailableTypes` 缺 type=2 特判導致終止授權選項消失；修復 `loadEditDetails` 無 guard 覆蓋 view/review/authorize dialogMode 導致察看明細時 applyType 可選。兩個 Vue 檔案均已修正。 → [[2026-05-05-PEPIS-eDDA-3.4-Bug修復]]

- **PixiuCore Recap 跨專案回寫規則**（已完成）：已強化 `skills/pixiu-session-recap/SKILL.md` 與 `user_rules.md`，規定只要使用者下達 `recap` 或等價請求，不論 cwd/repo/project，都必須直接回寫 `%PIXIU_CORE%\vault\memory\recaps\`，並同步 `memory-summary.md` / decisions；若權限不足需立即請求升權。 → [[2026-05-04-191150-PEPIS-3.4查詢修改與Recap跨專案回寫]]

- **Spec Improve 技能新增與同步**（已完成）：已新增獨立 `spec-improve` 技能，專門審查既有 spec：先評分、列優缺點、補強建議，再詢問 user；已同步至 `%PIXIU_CORE%` 與 gravityTest 六個技能位置，YAML 僅放 `.agents\skills\spec-improve\agents\openai.yaml`。 → [[2026-04-29-151239-Spec-Improve技能新增同步]]
- **Pixiu Auto Research SAST triage 規則**（已完成）：已在 MVP 中加入保守 triage，輸出 P0/P1/P3/P4、優先複核項目與 dedupe 群組；使用者 CSV 驗證通過。 → [[2026-04-29-121857-Pixiu-Auto-Research-SAST-triage規則]]
- **Pixiu Auto Research MVP 實作落地**（已完成）：已在 <workspace-root>\pixiu-auto-research 建立無 API、Manual Codex Scoring Mode 的 Node.js MVP；Desktop 目標路徑 smoke test 通過。 → [[2026-04-29-112703-Pixiu-Auto-Research-MVP實作落地]]
- **Pixiu Auto Research Manual Codex Scoring Mode**（已完成）：因目前無 API，Auto Research MVP 改為產出 `candidate.md`、`codex-eval-prompt.md`、`scorecard.md`，由使用者手動交給 Codex 評分後回填 registry。 → [[2026-04-29-105958-Pixiu-Auto-Research-Manual-Codex-Scoring]]
- **Pixiu Auto Research Core 實作方案**（已完成方案文件，待審閱）：已產出 DOCX，採通用核心 + domain plugin 架構；第一個 MVP 建議 SAST 報告分析。 → [[2026-04-29-105025-Pixiu-Auto-Research-Core實作方案]]
- **PixiuCore — Agent Team 前置判斷硬閘門**（已完成）：已在 `user_rules.md` 新增硬閘門；每次需求在提出方案或執行前，必須先判斷是否建議啟用 agent team，並等待使用者決定。 → [[2026-04-29-102717-Agent-Team前置判斷硬閘門]]
- **CCA-F 教材書籍化輸出**（已完成）：已產出含封面、Word 自動目錄、深度補充篇與 PDF 驗證的教材版 DOCX。
- **DOCX 文件產生工具鏈沉澱**（已完成）：`make-docx` 已補上需求規格書產生腳本與 Windows 中文編碼避坑規則。
- **OpenSpec 中央化導入規劃**：架構設計完成，Phase 1-3 待執行 → [[2026-04-21-111300-OpenSpec導入規劃]]
- **PixiuCore 母體維護**：雙向同步完成，gravityTest 待 git push → [[2026-04-20-母體雙向同步]]
- **PCLMS — L1/L4/N1C 訊息傳送問題調查**（已完成規則盤點與 N1C 實測）
  - 已確認：L1/L4 依賴 `warehse.sepid`，N1C 依賴 `syscode`。
  - N1C 實測：`status:0` 代表成功，Log 出現 `has not exist` 為重複搬移誤報。
  - 發現問題：N1C `getRecvId` SQL 缺監管編號過濾；L1 檔名匹配需嚴格對應資料檔名。
  - 下一步：修正 N1C 程式碼 Bug 並驗證資料庫欄位。

### 最近重要決策

| 日期 | 決策 | 選擇 | 原因 |
|------|------|------|------|
| 2026-05-04 | PixiuCore README 文件策略 | 採短版現況入口文件 | 舊 README 與實際內容落差大，短版入口較容易維護，也符合最小改動原則 |
| 2026-05-04 | Recap 觸發必須回寫 Obsidian | User-triggered Recap 必須立即寫入 vault/memory/recaps | 避免 recap 只留在對話中，確保 Obsidian 與下次 session 可接續 |
| 2026-05-04 | Recap 跨專案強制回寫 PixiuCore | 任一專案/任一 cwd 只要使用者下達 recap 就必須寫入 `%PIXIU_CORE%\vault` | 使用者明確要求 recap 不受專案範圍限制，避免 AI 在非 PixiuCore repo 只輸出文字而漏寫 vault |
| 2026-05-04 | PCLMS 彙報出倉未確認報單判斷 | 區分「出倉明細彙整」與「彙報報單號碼確認」 | `CatMonthresult` 從 `outdetail` 挑明細，不會挑到無 `outdetail` 報單；`listCatMonthSave` 則允許 `iconfirmed=N` 且已放行報單，並更新 `month/declar` |
| 2026-04-30 | eDDA 3.4 查詢修改 UI 策略 | 申請類別欄位改成中文選項；狀態 2/5 全欄位可改；狀態 4 僅修改授權開付款限額、終止授權全唯讀 | 實測證明底部按鈕式切換與需求不符，且目前欄位鎖定邏輯錯誤 |
| 2026-04-29 | Spec Improve 技能策略 | 新增獨立 `spec-improve`，不修改原 `spec`，且不納入 `make-docx` | 讓既有 spec 的審查/翻修流程獨立，避免污染新 spec 建立流程；DOCX 僅是文件輸出工具 |
| 2026-04-29 | Pixiu Auto Research SAST triage 規則 | 採保守規則型 triage：嚴重 P0、敏感中風險 P1、資訊降權保留群組摘要 | 無 API / 無 golden set 階段避免主觀誤判，先降低噪音但不刪線索 |
| 2026-04-29 | Pixiu Auto Research MVP 落地路徑 | 獨立子專案 <workspace-root>\pixiu-auto-research；無 API、無外部套件、先跑手動 Codex 評分 | 避免污染 gravityTest 既有資料，先用最小閉環驗證流程 |
| 2026-04-29 | Pixiu Auto Research Manual Codex Scoring Mode | 無 API 階段先產 Markdown 結果，由使用者用 Codex 手動評分並回填 | 避免 API key 與串接阻塞 MVP，先驗證研究閉環資料結構與評分流程 |
| 2026-04-29 | Pixiu Auto Research Core 架構策略 | 通用核心 + Domain Plugin，第一個 MVP 建議 SAST 報告分析 | 評分器與實驗空間必須 by case，runner / registry / reset / budget 可通用 |
| 2026-04-29 | Agent Team 前置判斷硬閘門 | 每次需求前先判斷是否建議啟用 agent team，並由使用者決定 | 避免無條件開啟造成 token、延遲與協作風險；硬閘門可降低漏問機率 |
| 2026-04-27 | DOCX 驗證流程調整 | 不再預設執行 artifact-tool / Chrome headless 截圖；改用 Word COM + PDF 頁數/文字檢查 | 已知本機 renderer 與 Chrome 截圖無效，應避免重複空轉 |
| 2026-04-27 | DOCX 教材書籍化輸出標準 | 封面 + Word TOC + PDF 驗證 | 教材型文件需要讀者導覽與可開檔驗證，不只產出正文 |
| 2026-04-27 | DOCX 產生工具鏈標準化 | 更新既有 `make-docx` skill + 新增 reusable script | 避免 PowerShell 中文管線亂碼，讓需求規格書可重複產生 |
| 2026-04-20 | PCLMS 訊息傳送規則盤點 | 完成 L1/L4/N1C 對照表 | 使用者反應換 Port 後仍無法發送，需確認資料面約束 |
| 2026-04-20 | N1C Log 診斷 | 判定為 Library 自動搬移 | 解釋 `has not exist` 誤報，確認 status:0 為成功。 |
| 2026-04-20 | 決策寫入流程優化 | 採用獨立決策檔 + 總表同步 | 活化 Dashboard 顯示並便於檢索 |
| 2026-04-20 | PPOST 件數比對不符修正 | 修改顯示變數為 `_DeclNoHwbDt` | 解決比對邏輯與顯示數值不一致的矛盾 |
| 2026-04-20 | PCLMS 彙報出倉待確認原因 | 先查/補原進倉報單與項次，不先補 monthno | 待確認原因是出倉報單缺原進倉對應欄位 |
| 2026-04-20 | 母體同步策略 | gravityTest 為 git 版本基底 | 有版本歷史較安全 |
| 2026-04-20 | Obsidian 整合方式 | 獨立 recap 檔 + Dataview Dashboard | 比追加更好搜尋與視覺化 |
| 2026-04-20 | PCLMS bug 修法 | 驗證 executeUpdate 回傳值 + rollback | 不改 schema，最小侵入 |
| 2026-04-16 | Vault 架構 | 在 PixiuCore 建 vault/ | 全域共用、不綁定特定專案 |

### 已確認的技術約束

- PCLMS_AP 庫存核銷問題需同查交易邊界、`clearStore`、出/進倉修改、月彙報 key、加工/報廢與測試退料流程；不可只看單一 `outstatus` 或單一 servlet。
- PCLMS DB schema 不可大改
- Java 版本維持現有（非 Java 8 以上需確認）
- 分支策略：`feature/*` → `r_sit` → `r_uat` → `master`

### 踩坑紀錄

| 日期 | 坑 | 解法 |
|------|-----|------|
| 2026-04-29 | `spec-improve` 技能驗證時，PATH 無 `python` 且 bundled Python 缺 `yaml`，導致 `quick_validate.py` 無法完成 | 使用 bundled Python 執行初始化；驗證改用 SHA256 一致性、TODO 掃描與 YAML 內容人工確認；後續若要跑 quick_validate 需補 PyYAML |
| 2026-04-29 | Windows Node path 與 sandbox spawn 踩坑：import.meta.url 直接取 pathname 會產生 C:\\C:\\...；Node spawnSync(process.execPath) 在 sandbox 會 EPERM | 使用 fileURLToPath(import.meta.url) 處理路徑；smoke test 改直接呼叫核心函式，不再 spawn Node |
| 2026-04-29 | DOCX 視覺驗證補充：artifact-tool 無 stderr 失敗、LibreOffice 不存在、pdf2image 缺 Poppler、PDF.js 中文呈方框 | DOCX 驗證以 Word COM 匯出 PDF + pypdf 頁數/文字檢查為主；PDF.js 只用於頁面結構總覽 |
| 2026-04-27 | DOCX 自動視覺驗證工具鏈不可靠：artifact-tool 本機失敗；Chrome headless PDF 截圖只得到深色空白 viewer | 後續不再預設執行這段，改用 Word COM 匯出 PDF + `pypdf` 頁數/文字檢查；視覺 QA 改人工抽查或待可靠 renderer 修復 |
| 2026-04-27 | DOCX 原檔有重複 Heading styleId，artifact-tool 可能失敗；直接去重 styles.xml 可能讓 Word 判定檔案毀損 | 改用乾淨 DOCX 重建內容，目錄用 Word COM 更新，驗證改走 PDF 頁數/文字檢查與必要時人工視覺抽查 |
| 2026-04-27 | PowerShell here-string pipe 到 `python -` 時中文變亂碼，檔名變成問號導致 DOCX 儲存失敗 | 改用 UTF-8 `.py` / `.json` 檔案，再由 Python 直接執行或讀取 |
| 2026-04-23 | AI 跳過母艦連結聲明直接工作，使用者無法確認規範是否載入 | 已寫入 `user_rules.md` 硬閘門：每次新任務第一句必須聲明 |
| 2026-04-20 | `/recap` 斜線指令被 Claude Code 過濾 | 用純文字「現在到哪了？」觸發 |
| 2026-04-20 | `cp -r` 在已存在目錄產生雙層路徑 | 改用 `cp -rn src/. dst/` |

---

## 更新指引

每次 session 結束前，若有以下情況請更新：
- 做了架構級決策 → 同時建立 `vault/memory/decisions/` 獨立檔案
- 發現新的技術約束
- 解決了重要 bug 或踩了新坑
- 待辦事項有重大變更

**詳細 recap 請存為獨立檔案**：`vault/memory/recaps/YYYY-MM-DD-主題.md`（用 Templater 模板）



