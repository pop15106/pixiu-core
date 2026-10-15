# Session Workflow schema 3 的 CR 相容套件

此配置保留既有 SessionWorkflow 核心、專案解析、接管和 schema 1／2／3 帳本，不以只支援 schema 1 的 controller 取代它。

## 已確認的根因

舊候選 controller 把 `event.schemaVersion !== 1` 與 `previousHash` 不一致放在同一個判斷。遇到 schema 2 事件時，即使雜湊串接正確也會顯示 broken hash chain。相容套件保留既有的完整事件解析與 hash 計算，不修改事件、不重算歷史 hash、不建立空帳本取代舊資料。

## 建置與信任邊界

`prepare-session-workflow-cr.mjs` 只接受程式內列出的三個已核對 SHA-256 基準，分別是原核心、DevSpace adapter 與專案 resolver。原核心已與來源 repository 的 canonical core 比對一致。任何基準變動都需重新覆核；工具不自動猜補丁位置。

```text
node scripts/devspace-portable/prepare-session-workflow-cr.mjs <母體來源> <已核對的舊bin> <全新套件目錄>
node scripts/devspace-portable/workflow-bundle.mjs verify <套件目錄>
```

新配置為 `session-workflow-v3-cr-v1`，有 18 個明確 runtime 檔案。一般 PixiuCore 配置仍是原本的 15 個檔案。套件完整性檢查、安裝交易與回復使用同一套 bundle 工具；套件中的核心與 resolver 採固定相對路徑，不被舊環境變數轉向。

雜湊是內容關聯，不是簽章。安裝仍須明確授權、備份原入口、確認現行程序身分並保留帳本。原始 ledger 不包含在可攜套件中。

## 原帳本交易內的 CR gate

建立和所有原本的 mutation seam，在既有 ledger 交易範圍內加入必要 CR 狀態、固定計劃與來源根目錄。完成必須通過原始證據回讀、必要測試及 VERIFY／RECHALLENGE；普通 update 和 extension mutation 都不能省略 gate。

已啟用 CR 的任務不能刪除必要性或更換 binding。狀態由持有者更新；同專案交接後發現來源變動會清除驗證 checkpoint，要求重測。原本非 CR 任務不被強制改型，既有跨專案及控制角色的可見性規則保持原樣。

本配置只支援單專案 CR。新的多專案 CR 建立會明確拒絕；原有非 CR 跨專案任務維持原流程。跨專案完整證據、顯式計劃遷移的 schema 3 adapter 仍需後續實作，不冒稱全部工作流已支援。

原 ledger lock 名稱保留。新持有者寫入完整身分，不再按 30 秒鎖齡移除未知鎖。非同步交易完成前保持鎖定；重複 revision 以原有 CAS 判斷。硬中止後的這一種 legacy ledger lock 仍需另外核對，不與 CR 的 auxiliary-lock 格式混用。

## 可重跑的相容性測試

需明確提供已授權且符合基準的舊 runtime，以及原核心的專案範圍回歸檔；未提供時測試報錯，不偷偷略過。這套實機相容性測試與公共核心 CI 分開回報。

```bat
set "PIXIU_SESSION_BASELINE_DIR=<原runtime備份目錄>"
set "PIXIU_SESSION_CORE_REGRESSION=<原核心的core-project-scope.test.mjs>"
node --test --test-reporter=spec scripts/devspace-portable/tests/session-workflow-cr.test.mjs
```

包含正常完成、缺狀態、必要性降級、原始輸出缺失、extension gate、同 revision 競爭、交接來源變動、原任務保留與套件回復。原核心六項角色及專案驗收直接改為載入 patched core，其餘斷言保持原樣。

家用機 Node 24.13.0 在刪除 Git 暫存 fixture 時曾原生退出。測試改用獨立 PowerShell 只清理自身的 Git fixture，錯誤仍不略過；沒有改動全域 Node／JDK，也不對真實帳本做破壞性測試。這不是宣稱已修復 Node 本身。

## 啟用驗收

在停止舊服務前核對完整既有任務與原帳本指紋。切換後由實際 Node 程序回讀 integrationProfile、schema、來源 commit、runtime digest 與載入位置，再測本機／公開健康端點及實際 workflow 工具。metadata 或單獨 import 通過不能代替現行服務已生效。
