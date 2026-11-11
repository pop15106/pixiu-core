# PixiuCore Codex 原生副本發布工具

## 目前狀態

2026-11-03：已在工作機實際 Codex 使用者目錄完成安裝，並依「分析工作模式」測試回覆補齊短指令辨識與規格載入說明。本次發布版本為 `1bcc7d0e5f3f68b4`，來源為目前母體工作樹。Pro 與 XHigh 個人 Skill 的啟動描述已列出短指令，允許宿主依明確選用語句匹配；分析階段仍依純文字規格執行。

- 全域入口：`C:\Users\7010\.codex\AGENTS.md`
- 規範副本：`C:\Users\7010\.codex\pixiu-native-core\releases\1bcc7d0e5f3f68b4\core`
- 原生 Skill：`C:\Users\7010\.agents\skills\pixiu-native-core\SKILL.md`
- 本次原入口備份：`C:\Users\7010\.codex\pixiu-native-core\backups\2026-11-03T09-24-32-161Z-59943fc0-72a4-4e60-894e-c2fc656c91fb`

前版隔離驗證保留於 `.cr/codex-native-core/acceptance-profile-v2`。正式規範已安裝到上述使用者目錄；隔離目錄僅供測試。

## 發布內容

- 保留母體的 L0 規範、Bootstrap、Capability Manifest、相關治理及情境文件。
- 依 Capability Manifest 選取 Skills，補齊明確引用的技能目錄與其參考檔。
- 發布原版 Router 與 Critical Relay completion gate；另以 route.cjs 將規範路徑映射至副本。
- Codex 使用者層只新增一個 `pixiu-native-core` 技能入口，避免將整個技能庫重複加入 discovery。
- `vault/memory`、現行 CR ledger、Handoff、工作中狀態不納入規範快照。接續任務仍讀正式來源。
- 同步方式為從母體重新建置並發布。此工具不建立排程。
- 此工具安裝原生規範及 Skill，不寫入 Codex 的自動 Memories。

副本內的外部工具操作、未收錄的執行腳本、MCP、套件或帳戶能力，仍須在執行環境確認。規範副本不代表這些能力已安裝。

## 目標位置

- `<Codex home>/AGENTS.md`：管理區塊；保留其餘個人指示。
- `<Codex home>/pixiu-native-core/releases/<版本>/`：可核對雜湊的規範副本。
- `<使用者目錄>/.agents/skills/pixiu-native-core/SKILL.md`：單一原生 Skill。
- `<Codex home>/pixiu-native-core/backups/<備份批次>/`：原始入口的位元組備份。

Codex home 預設使用 `CODEX_HOME`，未設定時使用使用者目錄下的 `.codex`。CLI 可明確指定 `--codex-home`。隔離測試必須指定 `--profile`，不使用真實使用者設定。

## 正式安裝

本次已依使用者授權完成正式安裝。以下命令供預覽、更新與再次核對使用；安裝前先核對目標路徑。

~~~powershell
Set-Location 'C:\Users\7010\Desktop\gravityTest\pixiu-core'

node .\scripts\codex-native-core\publish.mjs plan `
  --bundle .\.cr\codex-native-core\release-20261103-alias-startup

node .\scripts\codex-native-core\publish.mjs install `
  --bundle .\.cr\codex-native-core\release-20261103-alias-startup `
  --confirm

node .\scripts\codex-native-core\publish.mjs check `
  --bundle .\.cr\codex-native-core\release-20261103-alias-startup
~~~

先確認 plan 回報的實際目標與預期一致。install 自動備份、寫入、回讀，成功後輸出 backupSet。再次安裝相同內容會回報 current，不建立新備份。

下列情況在寫入前停止：

- 存在非空 `AGENTS.override.md`，需確認真正生效的入口。
- 舊 Pixiu 橋接含未知修改，需先核對個人指示。
- 已有未知的同名 Skill。
- 安裝路徑含 symlink 或 junction。
- 發布雜湊不符、路徑穿越或正在執行另一個安裝。

已安裝的管理區塊若被外部修改，先核對差異，不覆蓋。發布工具本身若更改入口格式，也需重新核對既有入口。

## 更新

先在母體修改規範，再使用新的輸出目錄。每一份發布保留來源路徑、來源版本及逐檔雜湊；來源包含當下工作樹的未提交內容。

~~~powershell
node .\scripts\codex-native-core\publish.mjs build `
  --out .\.cr\codex-native-core\<新的發布目錄>
~~~

接著針對新目錄執行 plan、install、check。保留舊版副本供回復。

原有 `scripts/entry-sync/Sync-PixiuGlobalEntries.ps1` 也管理 Codex 的 AGENTS.md。本次以 Get-ScheduledTask 查詢，未找到 action 參數含 Sync-PixiuGlobalEntries 或 entry-sync 的排程。日後人工執行舊入口同步時，仍需保留原生管理區塊；本次保留其他 AI 的入口與設定。

## 使用新版分析規格

工作機的全域 AGENTS.md 已接上原生入口。在新的 Codex 對話可直接使用 `Pro析` 或 `X析`；`$pixiu-native-core` 是明確手動選用入口的方式，可省略。Bootstrap 先走純文字專用入口，載入指定規格後停用工具、外部查詢與子代理。兩個名稱是自訂工作法，不改變模型或 effort。

ChatGPT 的個人 Skill 是另一個入口，可直接選用「Pro 參考分析」或「XHigh 參考分析」。目前個人 Skill 描述已列出 `Pro析`／`/prostyle` 與 `X析`／`/xstyle`，`allow_implicit_invocation` 設為 true；引述測試回答、討論名稱或維護 Skill 依原任務處理。宿主是否實際載入，仍須在新對話驗證；需要明確指定時，在 ChatGPT 輸入 `@` 選取對應 Skill。

本對話首次實際採用時，規格要求標示名稱及識別：`pro-text-20261103-r2` 或 `xhigh-text-20261103-r2`。工作模式說明依實際載入的正文，保留 P1–P8／X1–X8 正式對應。個人 Skill 可獨立使用，無須為了使用它而連回母體。只有宣告名稱或識別仍不足以證明實際行為符合規格。

- `Pro析，先規劃：<問題>`：只交付計畫。
- `X析，照計畫分析：<問題與已提供資料>`：完成已授權的純文字分析。
- 已啟用後可用「定目標、更新計畫、目標驗收」調整流程。

Skill 的初次載入仍依宿主行為處理；需要從開始就零工具時，直接貼入完整文字版。這些規則不保證免額度。

## 回復

使用 install 真正回傳的 backupSet。回復前驗證備份與目前入口的雜湊，保留安裝後的外部變更。

~~~powershell
node .\scripts\codex-native-core\publish.mjs restore `
  --backup '<install 回傳的 backupSet>' `
  --confirm
~~~

回復原始位元組；原本不存在的入口檔才移除。發布副本和備份保留供查核。再次回復回報 already-restored。

## 驗證與證據

~~~powershell
node --test --experimental-test-coverage .\scripts\codex-native-core\publish.test.mjs
~~~

目前驗證涵蓋：發布範圍、純預覽、明確套用、完整性、重複安裝、個人指示保留、舊入口衝突、override、同名技能、junction、回復、外部變更保護與版本更新。

本次發布包含 289 個檔案，總計 1,280,906 bytes。正式安裝回讀及完整性檢查通過，Pro析 與 X析 的路由指向新版副本內的對應 Skill。兩份 Skill 正文與個人 Skill、母體來源及可攜副本一致。既有發布工具的 11 項測試已在前次安裝通過；本次只更新 Skill 內容與中繼資料，未修改發布程式。本次證據存於 `.cr/codex-native-core/verification-20261103-alias-startup.json`；前次記錄 `.cr/codex-native-core/verification-20261103-goal-views.json` 保留。

檔案安裝、完整性及路由已驗證；本次未另啟模型對話或子代理，Codex App／CLI 新對話中的載入與分析行為尚未進行情境實測。未量測 Instant 與 Pro／xhigh 的效能差距。

## 來源

- https://learn.chatgpt.com/docs/agent-configuration/agents-md
- https://learn.chatgpt.com/docs/build-skills
- https://learn.chatgpt.com/docs/customization/memories
