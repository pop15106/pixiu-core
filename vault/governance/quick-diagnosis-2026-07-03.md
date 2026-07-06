---
type: governance
date: 2026-07-03
project: PIXIUCORE
system: PIXIUCORE
topic: quick-diagnosis
status: active
tags: [pixiucore, governance, diagnosis, token, harness]
summary: 2026-07-03 母體健檢：漏 token、失焦、出錯各前三名，附症狀、原因、修法與落點。後續制度檔皆引用本檔。
---

# 快速診斷 — 2026-07-03

> 由 Fable 5 實地盤點 `vault/` 產出。證據皆來自當日實際檔案狀態，非推測。
> 根目錄入口檔（`CLAUDE.md` / `CODEX.md` / `GEMINI.md` / `AGENTS.md` / `user_rules.md` / `SKILLS_INDEX.md`）因掛載限制**本次無法讀取**，相關項目標註【未確認】。

## 一、最漏 token 前三名

### 1. hook-state 佔 vault 99.8% 體積（827MB）

- **症狀**：`vault/memory/hook-state/codex-thread-watcher/` 有 81 個 JSON、12 個孤兒 `.tmp`，加上 transcripts 共 827MB。任何 agent 對 vault 做 glob、全文搜尋、或第二大腦全量索引，都可能掃進這批機器狀態檔。
- **原因**：codex-thread-watcher hook 把執行狀態與完整 transcript 寫進「知識」vault，機器狀態與知識混放。
- **修法**：把 hook-state 整層移出 vault（建議 `%PIXIU_CORE%\state\`，加入 `.gitignore`）；修改 hook 的輸出路徑；在此之前，所有 agent 的搜尋一律排除 `memory/hook-state/`。搬移與刪除屬不可逆操作，**需使用者授權後執行**（指令草稿見〈給未來 session 的信〉）。
- **落點**：`governance/maintenance-protocol.md`（排除規則）＋使用者一次性手動作業。

### 2. auto recap 洪水：217 份 recap 中 139 份是 auto 噪音（64%）

- **症狀**：`memory/recaps/` 大量檔名為原始使用者語句的檔案（如 `…auto-是0.md`、`…auto-這樣.md`、`…auto-這裡對吧.md`），每則對話產一份，內文含剪貼簿路徑與 transcript 路徑。recaps-index、Dashboard dataview、第二大腦索引全被稀釋。
- **原因**：auto recap hook 以「每個 turn」為單位觸發，且拿使用者原句當 topic，違反 `sop/recap-standard.md` 自己定的「auto 只當保險網、內容取 topic 保持可掃讀」。
- **修法**：(a) hook 改為每 session 至多一份、topic 由摘要產生；改不動 hook 就停用 auto、只留 manual。(b) 既有噪音檔批次隔離到 `memory/recaps/_auto-quarantine/`（移動可逆，刪除需授權）。(c) 所有 agent 查 recap 時預設過濾 `recap_mode: auto`。
- **落點**：hook 設定（根目錄，【未確認】位置）＋`governance/maintenance-protocol.md` 的查詢過濾規則。

### 3. 必讀檔 memory-summary.md 過期近兩個月

- **症狀**：`lastUpdated: 2026-05-12`，今天是 2026-07-03。每個 session 的 init 序列都載入這份過期快照：已完成的事仍標「待修復」，6 月整月進展不存在。weaker model 會照舊狀態行動，白花 token 重查已解決的問題。
- **原因**：更新 summary 依賴「AI 提醒、使用者手動」，沒有綁定觸發點，5 月中之後儀式斷更（decisions 同日停更，為同一次斷更）。
- **修法**：把「更新 memory-summary 對應列」寫進 recap 流程的固定步驟（產完正式 recap 後立即更新，不另設儀式）；summary 開頭加「最後更新日期若距今超過 14 天，先提示使用者本檔可能過期，再引用內容」。
- **落點**：`governance/maintenance-protocol.md` ＋ `sop/recap-standard.md`（待使用者同意後加一行）。

## 二、最容易失焦前三名

### 1. 制度散落四處，弱模型找不到「該遵守哪一條」

- **症狀**：載入政策在 `context/`、recap 標準在 `sop/`、封存慣例在 `memory/`、行為準則在 `identity/`，另有根目錄 rules/（【未確認】）。沒有單一索引說「什麼情境讀哪份」。
- **原因**：制度隨事件逐次生成，缺路由層。
- **修法**：本次新建 `vault/governance/INDEX.md` 作唯一制度路由；四個 AI 入口檔只指向它（見 `entry-files-alignment.md`）。
- **落點**：`governance/INDEX.md`。

### 2. auto recap 把「發生過」當成「值得記」

- **症狀**：Inbox、Dashboard、recap 索引裡混入大量無決策價值的片段，session 開場讀 recap 時注意力被垃圾標題吃掉。
- **原因**：同漏 token 第 2 項；記錄門檻為零。
- **修法**：同上；另在 `judgment-rubrics.md` 定義「值得寫入記憶」判準。
- **落點**：`governance/judgment-rubrics.md` 第 7 條。

### 3. Dashboard Inbox 積壓 5 月的待辦無人清

- **症狀**：`🏠 Dashboard.md` 的 AI_INBOX 仍掛著 5 月第二大腦部署待辦；每次讀 Dashboard 都重新看到、重新解釋一遍，卻沒有機制決定「做掉或關掉」。
- **原因**：Inbox 只有寫入規則，沒有清理規則。
- **修法**：維護協議規定：每次讀到 Inbox 項目，只允許三種動作——執行、問使用者是否作廢、保留並標註日期；超過 30 天的項目必須問。
- **落點**：`governance/maintenance-protocol.md` 第 5 節。

## 三、最容易出錯前三名

### 1. 三個 recap 目錄 I/O error（資料損毀風險，最高優先）

- **症狀**：`memory/recaps/PCLMS_AP/2026-06`、`memory/recaps/PCLMS_BK/2026-07`、`memory/recaps/母體/2026-06` 讀取時回 Input/output error，重試不變。
- **原因**：檔案系統層問題（磁碟壞軌、或同步軟體佔位檔），非權限問題。制度救不了，**需使用者在本機檢查**（`chkdsk`、確認 OneDrive/同步狀態）。
- **修法**：修復前，所有 agent 讀 recaps 必須容錯：讀不到就記「該目錄暫不可用」繼續做事，**禁止**因讀取失敗就重建或覆寫同名目錄（會蓋掉可能救得回的資料）。
- **落點**：`governance/judgment-rubrics.md` 第 6 條＋使用者手動檢修。

### 2. 制度有規則、無執行者：封存與稽核全部斷更

- **症狀**：`vault-archive-convention.md` 規定每月 1 日封存，但 decisions 根層仍留著 2026-05 檔案、6 月之後零筆 decision；`auto-mode-audit.log` 只有 4 月的初始化一行。規則活著，執行死了。
- **原因**：規則寫「AI 執行」，但沒指定觸發語意、沒有 checklist，弱模型不會自發想起來。
- **修法**：維護協議定義「每月首次 session 維護清單」：封存上月檔案、檢查 summary 日期、清 Inbox 過期項，共三步，每步有完成判準。
- **落點**：`governance/maintenance-protocol.md` 第 6 節。

### 3. 編碼與檔名地雷反覆踩

- **症狀**：after-action 與 instincts 中，UTF-8 控制字元、PowerShell 編碼、中文檔名問題重複出現多次；auto recap 又持續產出含原始語句、空白、特殊符號的長檔名，`.tmp` 孤兒檔已出現 12 個。
- **原因**：Windows＋中文＋多工具鏈環境本身脆弱；而 auto recap 的命名方式持續製造新雷。
- **修法**：檔名規則收斂為單一判準：`YYYY-MM-DD-<專案KEY>-<kebab-topic>.md`，topic 只允許 `[a-z0-9-]` 與必要中文詞、禁止空白與標點；寫檔一律 UTF-8 no BOM。此規則寫入維護協議，並成為 auto hook 修復的驗收條件。
- **落點**：`governance/maintenance-protocol.md` 第 4 節。

## 四、一句話總結

> 這套母體不缺規則，缺的是「規則的執行者、路由與衛生」。本次交付把三者制度化：路由（entry-files-alignment ＋ INDEX）、執行者（maintenance-protocol 的觸發點與 checklist）、衛生（噪音隔離與容錯判準）。

## 本檔維護

- 性質：一次性健檢快照，**不需要**持續更新。
- 下次健檢：產新檔 `quick-diagnosis-YYYY-MM-DD.md`，本檔留作基線對照。
