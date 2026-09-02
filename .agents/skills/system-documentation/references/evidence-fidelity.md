# Evidence and Fidelity Rules

## Evidence Priority

同一個事實有多個來源時，依問題類型選最高可信來源，不機械套單一順位。

### Runtime / UI 行為

1. 當前目標環境的實際畫面 / Runtime 行為。
2. 當前部署版本的設定與原始碼。
3. 正式操作手冊 / 變更單 / UAT 證據。
4. Repo 中舊文件與註解。
5. 記憶、聊天摘要、推測。

### 程式與資料行為

1. Active code path + runtime evidence。
2. 當前 branch 的原始碼 / SQL / config。
3. Schema / Trigger / Procedure 定義。
4. 正式技術文件。
5. 註解、README、記憶。

若來源互相衝突，文件中保留衝突，不自行「選一個看起來合理的」。

## Evidence Map

開始撰寫前至少盤點：

| Layer | 要找什麼 | 常見來源 |
|---|---|---|
| Entry | Menu、Route、Button、Batch、API | JSP/HTML、route config、Struts XML、Controller mapping |
| UI | 欄位、按鈕、Tab、提示 | JSP、HTML、component、template |
| Behavior | show/hide、required、readonly、calculation | JS、validator、server condition |
| Server | Action/Controller/Service | Java/C#/TS/Python 等 |
| Data | SQL、Mapper、Table、Trigger | DAO、XML SQL、Schema CSV、DDL |
| Side effect | DB、檔案、Mail、API | code、config、log |
| Runtime | 實際狀態與資料 | screenshot、log、test、query |

## Claim Discipline

每一個可被讀者當作「系統規格」的句子都應屬於以下之一：

- **Verified**：來源直接支持目前 As-Is 行為。
- **Derived**：由多個已驗證來源可確定推導，需說明推導鏈。
- **Requested To-Be**：使用者、需求單或變更單明確要求的目標行為，尚未證明已實作。
- **Approved To-Be**：已有核准規格或可追溯決策支持的目標行為，尚未證明已上線。
- **Example only**：只是文件範例資料，不代表 Runtime 真實值。
- **Needs runtime verification**：程式碼存在，但無法確認當前部署是否啟用。
- **Unsupported**：來源無法支持，不寫成結論。

## Fidelity Rules

### 允許

- 文件加圖號、箭頭、紅框、步驟編號。
- 為保護敏感資料替換成合法格式的虛構值。
- 為了閱讀把大畫面裁成局部，但不得裁掉操作所需上下文。
- 在旁邊補「程式來源」「注意事項」「狀態說明」。

### 不允許

- 把 Legacy table UI 重畫成現代 card UI。
- 改按鈕名稱、欄位名稱、頁籤名稱或狀態名稱。
- 因為覺得流程「應該這樣」就補一個畫面或步驟。
- 把程式碼還原畫面稱為正式環境實際截圖。
- 忽略 Trigger、JS validator、Session 權限等非主要 Java 檔造成的行為。
- 看到 class/file 名稱就直接當成「現行啟用功能」。需確認 route/include/config/entrypoint。

## Conflict Handling

若「實際畫面」與「repo 原始碼」不同：

1. 先確認是否不同系統層（例如 Portal shell vs embedded app）。
2. 再確認 branch / deploy version / feature flag。
3. 文件中分開標示：「Runtime evidence」與「Repo evidence」。
4. 無法確定原因時，不自行宣稱哪一個是最新規格。

## Minimum Evidence by Document Type

- 操作手冊：至少要有入口 + UI + submit/action + result/status。
- 受測文件：至少要有 requirement/change + execution path + observable expected result。
- As-Is 功能規格：至少要有 entry + business rules + data/side effect。
- To-Be 需求/變更規格：至少要有可追溯需求來源 + As-Is 基準 + Before/After + acceptance criteria；若已指定實作方向，再補 impact path。
- 模組解說：至少要有 module responsibility + active entrypoints + dependencies。
- DB 解說：至少要有 schema + code usage 或 runtime usage；只有 table name 不足。
