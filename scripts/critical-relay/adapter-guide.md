# 通用驗證 adapter

CR 的協調與事件記錄需要 Node 22+，受驗證的應用可使用其他語言。所有命令由明確的計畫指定；adapter 不安裝工具、不下載相依、不變更全域 JDK，也不自動啟動被測服務。工具存在不等於該專案已驗收。

| adapter | evidenceKind | 真實證據 |
|---|---|---|
| node-test | test | Node 官方逐案例事件 |
| junit-command | test、api、ui | 實際命令 + 明列的 JUnit XML 報告 |
| playwright-command | ui | 實際 Playwright 命令 + JSON reporter |
| build-command | build | 成功命令 + 本輪重新產出的非空檔案 |
| http-json | api | GET／HEAD 回應狀態及指定內容比對 |

`junit-command` 可接入能輸出相容 XML 的工具；不能只因使用相同副檔名就假設相容。自訂測試啟動器可以處理專案自己的服務啟停，最後由同一命令返回結束碼及原生報告。大型產物、TRX、LCOV、任意 XML 方言與 document 目前未支援。

## 計畫和命令

計畫採既有 `pixiu.test-plan.v1`。下例存為工作區中的 `plan.json`，不是放在 `.cr/`：

```json
{
  "schemaVersion": "pixiu.test-plan.v1",
  "id": "project-checks",
  "revision": 1,
  "profile": "local-only",
  "criteria": [{"id": "criterion-tests", "requiredEvidenceKinds": ["test"]}],
  "commands": [{
    "id": "unit-tests", "adapter": "junit-command", "file": "validation/maven.json",
    "evidenceKind": "test", "required": true, "timeoutMs": 180000,
    "criterionRefs": ["criterion-tests"]
  }]
}
```

以下是 `validation/maven.json` 的 Windows 範例；執行檔位置、測試類別及報告檔需依專案實際配置調整：

```json
{
  "schemaVersion": "pixiu.adapter-spec.v1",
  "adapter": "junit-command",
  "exec": {
    "executable": "mvn",
    "args": ["-o", "-V", "test"],
    "envFromHost": ["JAVA_HOME"]
  },
  "reports": ["target/surefire-reports/TEST-example.AddTest.xml"]
}
```

`executable` 接受 PATH 名稱或絕對檔案路徑，`args` 是參數陣列；`cwd` 預設專案根目錄，也可指定專案內相對目錄。報告與產物路徑一律相對專案根目錄，明列全部必要檔案，不使用 glob。新增案例若產出新檔案，應更新計畫／spec 並重新驗證。`envFromHost` 只列需要繼承的變數名稱，避免在 JSON 直接放秘密；預設不傳入完整環境，禁止 Node 注入與 CR 控制變數。

Windows `.cmd/.bat` 由受限 cmd 啟動，拒絕可能重新解譯的引號及 `% ! ? & | < > ^` 等字元。有複雜參數時使用可直接啟動的工具或經審查的專案啟動器，不把 shell 語句塞進 args。其他可執行檔使用 `shell:false`。

Playwright spec 使用 `playwright-command`、`evidenceKind:ui`，例如 `exec.executable:node`、`args:["node_modules/@playwright/test/cli.js","test"]`；在專案 Playwright 設定中啟用 JSON reporter 並明確設定 outputFile，將該路徑列在 `reports`。詳見 [Playwright 官方 reporters](https://playwright.dev/docs/test-reporters#json-reporter)。Maven XML 位置由 [Surefire 的 reportsDirectory](https://maven.apache.org/surefire/maven-surefire-plugin/test-mojo.html#reportsDirectory) 控制。

build spec 使用 `build-command`，將 `reports` 改成 `artifacts`，例如 `["target/application.jar"]`。檢查的是本輪命令成功與非空產物，不表示產物可部署，也不替代 test／ui／api。

產物目錄如 `target/`、`test-results/` 應列入專案既有 `.gitignore`；否則 runner 會正確將新增輸出視為來源變動而拒絕通過。不要忽略測試、spec 或計畫來源。

```text
node <core>/scripts/critical-relay/test-runner.js plan.json
```

報告及產物上限每檔 8 MiB。原生程序日誌、exe/script hash、argv、cwd、exit code、時間、報告副本與摘要保存在 `.cr/runs/<runId>/`。Node 外層事件和原生案例計數必須一致，回讀時重查報告、日誌與工具指紋。腳本間接啟動的 JDK／瀏覽器等版本應由原生工具版本輸出另行核對；本版不宣稱對整條工具鏈做簽章。

舊報告未重新產生、空報告、零案例、略過、flaky/retry、錯誤統計、非零結束碼、逾時或缺工具均不能完成。只接受已知 XML 結構，拒絕 DTD／外部實體；不確定格式時保持失敗。雜湊防止意外不一致，不防同一 OS 使用者刻意重寫全部證據。

## HTTP API

先啟動已獲授權的測試服務，再執行 `http-json` 計畫。spec 範例：

```json
{
  "schemaVersion": "pixiu.adapter-spec.v1",
  "adapter": "http-json",
  "allowedOrigins": ["http://127.0.0.1:8080"],
  "requests": [{
    "id": "health", "url": "http://127.0.0.1:8080/health",
    "method": "GET", "expectedStatus": 200,
    "expectedJson": {"status": "ok"}
  }]
}
```

僅允許明列 origin 的 GET／HEAD，拒絕 URL 帳密、秘密 query key 與 redirect。`expectedJson` 比對整個解析結果，`bodyIncludes` 可比對字串。這只是明確授權範圍內的請求限制，不是網路沙盒或 DNS 防護。涉及認證、寫入或較複雜 API 時，使用既有專案測試命令產出 JUnit；憑證不放入 argv/spec 或公開證據。

## 純研究

來源必須先由執行者實際取得，保存為工作區中的 UTF-8 原文檔；此命令不代替搜尋或論點判斷。

```json
{
  "schemaVersion": "pixiu.research-plan.v1",
  "id": "research-example", "revision": 1,
  "criteria": [{"id": "criterion-source", "criterion": "核對原始來源並查反證"}],
  "sources": [{
    "id": "source-a", "file": "sources/reference.txt", "locator": "https://example.org/reference",
    "criterionRefs": ["criterion-source"]
  }]
}
```

```text
node <core>/scripts/critical-relay/relay-evidence.js init-research research-plan.json standard
node <core>/scripts/critical-relay/relay-evidence.js sources
node <core>/scripts/critical-relay/lifecycle-cli.js status
```

此模式不要求 Git、程式測試或 executionContract。來源與計畫 digest 固定於獨立 binding；原文快照保存在 `.cr/research/`。仍需真實 claims、sources、countersearch、resolved challenges、evidence_review 及 RECHALLENGE。來源變動會開新 cycle，舊覆核不能重用；正式 workflow 禁止重寫既有來源歷史。原文快照留在本機，公開前要另行去敏。
