# 輔助鎖、套件交易與清理恢復

## 範圍

本輪處理 M6d 及 M6e 的部分故障時序：控制鎖、安裝鎖、套件入口交易及建置清理。保持單一 Agent；不啟動背景模型，不安裝或重啟正在使用的 DevSpace。Java 8／Maven、真實 UI／API 與多專案驗收仍是後續工作。

## 持有與恢復規則

新鎖 schema 為 `pixiu.auxiliary-lock.v1`。持有者記錄包含操作 ID、完整工作區、主機、使用者、PID、程序出生時間與上一世代的指紋。身分資料先完整寫入並 fsync，再使用同一檔案系統的硬連結排他發布。目的名稱已存在時不覆蓋；不支援硬連結或 I/O 失敗時保持失敗，不退回不安全的刪鎖方式。

固定的 control.lock／workflow-install.lock 是第一世代入口；旁邊的 `.chain` 目錄保存 owner、next、done 與準備檔。每個世代只能發布一個 next。正常釋放只追加 done，恢復只追加 RECOVER 世代，不刪除或重用固定路徑。

這個設計讓兩個恢復者競爭同一世代時，只有一個能發布下一棒；舊請求無法把另一個操作者新取得的鎖刪掉。恢復者本身遭強制終止時，新的操作 ID 仍有可查核身分，可再依同一程序恢復，不新增另一把恢復鎖。

**鎖檔存在不代表忙碌。** 必須使用 inspect 查看目前最後一棒的狀態。不要手動刪除 `.chain` 或舊鎖。歷史鏈目前保留全部紀錄，達到讀取上限時阻擋；自動壓縮尚未實作。

## 控制鎖操作

```text
node scripts/critical-relay/auxiliary-lock.js inspect control
node scripts/critical-relay/auxiliary-lock.js recover control <operationId> <ownerDigest> --authorized
```

`operationId` 與 `ownerDigest` 使用本次 inspect 的實際值。只有本次明確授權、工作區／主機／使用者／指紋吻合，而且持有程序已終止，才可恢復。活 PID 即使出生時間不符也拒絕；無法判斷時保持阻擋。不依經過時間刪鎖，不終止任何程序。

新鎖只保護同步主控寫入。測試子程序仍由 runner.lock 的 children／launchPending 檢查處理。恢復輔助鎖只改變鎖紀錄，不修改測試成功／失敗、CR state 或套件入口。控制鎖未釋放時，正式證據 gate 不能完成。

計劃遷移若已留下 migration-pending.json，先恢復 control，再執行既有 `plan-migration.js resume <migrationId> --authorized`。不要重建任務來消除中斷紀錄。

舊格式鎖缺少完整持有者身分時，新入口回報 `AUX_LOCK_INVALID_OR_LEGACY` 並保留原檔。新工具不能替舊檔補造身分；舊版工具遇到新常駐入口也會阻擋，應使用一致版本。

## 安裝鎖與套件入口交易

```text
node scripts/critical-relay/auxiliary-lock.js inspect install <binDirectory>
node scripts/critical-relay/auxiliary-lock.js recover install <operationId> <ownerDigest> --authorized <binDirectory>
node scripts/devspace-portable/workflow-bundle.mjs resume <binDirectory> <transactionId> --authorized
```

在已解壓的 portable 套件中，輔助鎖工具位於 `workflow-runtime/scripts/critical-relay/auxiliary-lock.js`，套件入口工具是頂層 `workflow-bundle.mjs`。上述操作須使用明確授權的 binDirectory，不針對未知或正在更新的服務目錄試跑。

套件安裝與回復先保存 receipt、前後入口 bytes 與指紋，再寫入 `workflow-transition.pending.json`，最後原子切換單一入口。pending 存在時，其他新安裝／回復操作會拒絕執行；只可恢復同一 transactionId。

恢復時會重新驗證交易、套件內容、前後快照與原備份。當前入口只能是切換前或切換後的精確 bytes。切換後但終態未落盤時，只完成交易紀錄，不重複切換。第三方改動入口、快照或備份時保持 pending，拒絕覆蓋。

在 receipt 保存後、pending 尚未發布就中止，入口尚未被切換；保留該 receipt，恢復鎖後可另開正常安裝。真正 import 在切換鎖外執行，鎖內不啟動可能留下可寫子程序的模組探測。尚未承諾全機斷電時儲存裝置的所有排序與刷新行為。

## 建置清理

`Portable.Cleanup.psm1` 僅接受系統暫存目錄中本工具建立的 GUID 目錄，逐層檢查 reparse point，拒絕 junction、符號連結與超過掃描上限的內容。

預設最多重試三次。重試後仍被占用時回傳 RETAINED，建置器顯示暫存路徑及錯誤。清理例外不覆蓋原建置例外；已有 ZIP 在新封裝成功以前不會被刪除。警告只表示暫存清理未完成，不代表建置或驗證已成功。

模組以 UTF-8 BOM 保存以相容 Windows PowerShell 5.1。清理測試會實際持有禁止共享的中性測試檔案，驗證重試上限、主要錯誤保留與釋放後的清理。

## 驗證與限制

測試包含兩種輔助鎖的發布／釋放前後硬終止、恢復者再中斷、雙恢復競爭、活 PID 與錯身分拒絕、計劃 binding/state 間硬終止、安裝／回復入口切換間硬終止、第三方改動拒絕，以及 write／fsync／link／rename 的失敗注入。

故障注入不等於真的填滿硬碟；程序 SIGKILL 不等於實體斷電。當前支援以 Windows 本機檔案系統及 Linux CI 的實測結果為準，網路檔案系統沒有提供相同保證。任何取得同一 OS 寫入權限的人都能改動紀錄；雜湊不是數位簽章，不替代跨信任邊界驗證。測試執行器也不是 OS 沙盒。
