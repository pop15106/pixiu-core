# PixiuCore 審核修正：Windows 套用與回歸驗證

日期：2026-09-05（Asia/Taipei）

## 結論

本機既有候選整合版本已存在於 `6726fd36743bb4627ceaa39fac235d6ec05889f4`，本輪保留該版本，不以較舊的 ZIP 覆蓋。實際補修兩類使用相容性缺陷，新增 24 項測試，並在 Windows 工作區與乾淨 Git 暫存版本各完成同一組 229 項測試，全部通過，無失敗或跳過。兩次執行不重複計入測試總數。

判定：本次路由修正及既有相關檢查通過。這不是全部 F01–F10 問題結案，也不是所有 AI 宿主、Telegram、資料庫及服務的完整端對端驗收。

## 基準與範圍

- 本機：`C:\PixiuCore`。
- 分支：`feature/standalone-session-workflow-20260819`。
- 本輪父提交：`6726fd36743bb4627ceaa39fac235d6ec05889f4`。
- 既有提交內容：主要驗證技能與 Codex 副本、候選路由、既有及追加審核測試。
- 本輪只修改 `scripts/router/resolve-capabilities.js`，新增 `scripts/router/audit-usage-preservation.test.js` 與本報告。
- 未修改其他未提交內容，未更新子模組，未啟停使用中服務，未修改通知、排程、資料庫、依賴及全域設定；未派遣 Agent。
- commit/push 已取得使用者明確授權。實際提交及遠端雜湊由本輪最終回覆與 Git 查核紀錄提供；本文件記錄提交前驗證證據。

## 本輪補修

### 1. 純引用與唯讀語句

先前 `「啟動完整自動接力」`、`請記錄「啟動完整自動接力」這句話`、`只讀完整自動接力`、`唯讀完整自動接力` 等文字仍選入執行流程說明。

修正：模式僅在引文內時，要求引文外存在控制詞；唯讀描述納入資訊型情境。同時保留 `請啟動「完整自動接力」`、口語「請用」、裸模式名稱，以及停止、暫停、取消等既有控制路由。明確使用完整接力做唯讀檢查的指令仍可選取工作流。

這是文件選取判斷，不是新增或放寬執行授權。Router 的輸出欄位、最多三個能力、優先序、去重及降級行為保持原契約。

### 2. 文件與程式混合修改

先前 `修正 README 錯字並修復登入`、`修正文件錯字，並修正 Python parser` 等需求，會被一般文件分支錯誤排除程式實作能力。

修正：兩個輕量文件分支共用 `hasImplementationContext`，統一登入、前後端及程式語言等判準。純文件錯字仍採輕量路由，混合真正程式修改時保留實作與 TDD。

## 測試結果

### 先失敗、後修正

新增的 24 項測試在修正前為 12 通過、12 失敗；修正後全部通過。沒有刪除失敗案例或修改既有原始 Router 測試來取得綠燈。

### 不重複計算的 229 項檢查

| 檢查組 | 通過數 |
|---|---:|
| 路由意圖、候選回歸、驗證文字契約及新增使用相容性 | 146 |
| 原有 Router 單元測試 | 12 |
| 啟動量測測試 | 5 |
| 按需載入整合測試 | 9 |
| 技能欄位驗證器測試 | 6 |
| 全域入口同步的隔離測試 | 41 |
| Agent Learning 的隔離測試 | 6 |
| Codex Hook 安裝路徑的隔離測試 | 2 |
| Codex 專案設定檢查 | 2 |
| 合計 | 229 |

執行命令：

```text
node --test --test-reporter=tap scripts/router/audit-intent.test.js scripts/router/audit-routing-regression.test.js scripts/router/audit-verification-contract.test.js scripts/router/audit-usage-preservation.test.js
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/performance/run-lazy-loading-tests.ps1
node --check scripts/router/resolve-capabilities.js
node --check scripts/router/audit-usage-preservation.test.js
git diff --cached --check
```

Node 為 `v24.13.0`。入口同步、Agent Learning 與 Hook 安裝相關測試均使用測試暫存目錄，不套用到真實使用者設定。

## 實際提交版本的隔離驗證

只暫存兩個程式／測試檔後，以 `git write-tree` 取得程式版本：

`6cc663b968eac7e3f6bd6a192d8f29eb1cc2a75a`

透過 `git checkout-index --all --prefix=<本輪新建暫存目錄>/` 匯出精確暫存版本，在該副本重跑以上 229 項測試及整套按需載入檢查，全部通過；匯出、測試前後暫存樹相同。測試建立的暫存目錄已清除。報告在程式版本驗證後新增，不變更已驗證的程式與測試。

首次改用 `git archive` 搭配 Windows `tar.exe` 時，解包中文檔名失敗，測試未啟動。改用 Git 原生 `checkout-index` 解決測試包裝問題後，完整重跑通過。未修改使用者原始中文檔名，也未跳過測試。

### 靜態量測補充

| 項目 | Windows 工作區 | 乾淨暫存副本 |
|---|---:|---:|
| Codex 固定入口 bytes／門檻 | 7,008／8,192 | 7,029／8,192 |
| Claude 固定入口 bytes／門檻 | 3,939／6,144 | 3,939／6,144 |
| Gemini 固定入口 bytes／門檻 | 3,963／6,144 | 3,963／6,144 |
| 主技能驗證器接受項目 | 93，通過 | 92，通過 |
| Codex 發布層接受項目 | 90，通過 | 89，通過 |

工作區包含其他尚未提交的技能；提交副本刻意不納入那些內容。固定入口量測均在門檻內；這不是完整會話 Token 或所有宿主實際載入量測。技能欄位接受項目數另列，不加入 229 項測試總數。

## 既有使用與未提交內容保護

以 `git ls-files --cached --others --exclude-standard` 取得已追蹤及未忽略檔案，排除本輪 Router、測試及報告路徑，依路徑排序後累加路徑與檔案位元組的 SHA-256。

- 受保護一般檔案：2,792 個。
- 修改前及回歸測試後結果相同：
  `f947f383a1d2c1047bb60c345791da277b03c0720eb6c6817ddab485335c964e`
- 暫存區開始為空；本輪採明確檔案清單暫存，未使用 `git add .`。
- 首次遠端更新後，本機父提交與既有 upstream 的 ahead／behind 為 0／0。

此雜湊不涵蓋被忽略檔案、Git 內部資料或子模組內部；本輪沒有操作那些使用中資源。成功呼叫本機 DevSpace 讀、寫及執行工具，是本輪連線可用的直接證據，但不能代替 Telegram 通知送達等其他系統的端對端測試。

## 交付限制

其餘審核項目及其他任務的未提交修訂保留在原處，不以本次測試結果宣稱已全部發布。未強制推送、未合併到 main/master，未重寫歷史。驗證結論只涵蓋本次明列的程式與測試範圍。
