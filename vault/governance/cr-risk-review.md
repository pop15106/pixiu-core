# CR 風險與分析品質規範

## 1. 啟動與適用範圍

CR 研究、設計、開發、全流程均使用本規範。「CR 風險盤點」及「CR 風險審查」直接要求風險覆核，沿用同一案件與 state。單純討論、安裝或同步 Skill 時依維護任務處理。

開始時記錄目標、完成條件、資料截止時間、適用環境與來源版本。先記錄已讀取的母體版本、Skill 名稱與路由結果；未讀取時標示未確認。文字風格相似不構成載入證據。

## 2. 分析深度與廣度

| 檢查面 | 必須交付的內容 |
| --- | --- |
| 需求覆蓋 | 每項需求對應 claim、criterion、證據或測試；明列未覆蓋項及理由。 |
| 因果與假設 | 區分觀察、推論、假設；寫出成立條件、競爭解釋與可推翻的觀察。 |
| 來源獨立性 | 記錄原始來源或資料集的 originId；轉載、摘要及同一來源的不同 URL 歸同組。 |
| 方案比較 | Standard／Deep 比較可行方案，加入維持現況；依使用者目標比較成本、效益與限制。 |
| 敏感度 | 指出哪些輸入、假設或權重改變會改變決策。沒有數據時使用條件描述，保留資料不足。 |
| 停止與重開 | 記錄 reopenWhen：失效證據、版本變更、觸及風險界線或新反例；保留舊決策及修改原因。 |

Deep 原有程式只檢查不同來源位置。執行者須另核對來源是否獨立，並在 source_check 的結果中寫明來源分組。兩個網址與同一模型的兩輪覆核均不等同獨立驗證。

## 3. 風險盤點

依案件檢查正確性、資料品質、隱私與權限、安全、版本與相依、成本與資源、營運與回復、外部規範及執行失敗。每個領域記錄適用、有證據支持的不適用，或尚未評估，並附理由。空的 remainingRisks 不代表完成盤點。

每個風險記錄觸發條件、影響、受影響對象、負責人、處置、證據、剩餘風險與重開條件。機率與損失分開評估；未取得依據時保留未知，不製造百分比或只用相乘分數掩蓋低機率高衝擊。

severity 使用 low／medium／high／critical；unknown 表示尚未評估並阻擋完成。status 使用 open／accepted／mitigated／resolved。高風險 open 阻擋完成；低、中風險 open 保留追蹤人與下一步。改寫等級不是處置，需記錄新證據與判斷理由。

## 4. 程式強制驗收

scripts/critical-relay/risk-review.js 由既有 CR completion gate 呼叫：

1. 拒絕無效等級、無效狀態及未評估等級，避免大小寫或拼字繞過。
2. 所有 accepted／mitigated／resolved 紀錄需要 disposition.owner、reason、context、非空且無重複的 evidenceRefs。
3. disposition.context 必須等於 riskVerificationContext(state)。state.riskContext.environment 指定環境；一般紀錄另填 sourceRevision。正式 v2 與研究型自動綁定現有 run／headSha／changeDigest／planDigest 或 researchDigest。
4. 被引用的 evidence 或 test 必須存在、riskRefs 包含風險 ID、context 相符。evidence 需可追溯定位；test 需 passed。
5. mitigated／resolved 另需 disposition.action，記錄實際措施。
6. accepted 另需 approval.actor、reference、evidenceRef。該 evidence 必須為 kind=risk-acceptance、authority=user、actor 相同、decision=accepted，reference 對應其原始定位，且列入 disposition.evidenceRefs。
7. 交接保留 riskContext 與全部風險紀錄並納入摘要。版本、環境、範圍、正式 run 或研究來源改變後，舊處置證據失效並需重新評估。

程式核對結構、引用、狀態及版本關係。接受者的真實身分、授權內容、證據品質、風險盤點完整性及來源獨立性需執行者回讀原文判斷。填寫 authority=user 不是授權證明。模型不得自行接受風險，也不得以一般的「繼續做」推導對特定剩餘高風險的接受。

## 5. 實作範本

先回讀真實來源與執行結果，再記錄下列欄位。此範本不是預先取得的證據。

```javascript
const { riskVerificationContext } = require('./scripts/critical-relay/risk-review');
state.riskContext = { environment: 'staging', sourceRevision: verifiedRevision };
const context = riskVerificationContext(state);
// 已有實測 testId；metadata 只記錄適用性，正式 runner 仍須回讀原始輸出。
const result = state.tests.find(item => item.id === testId);
result.riskRefs = [riskId];
result.context = context;
risk.disposition = {
  owner: responsiblePerson,
  reason: observedReason,
  action: implementedMitigation,
  context,
  evidenceRefs: [testId]
};
risk.status = 'mitigated';
```

## 6. 驗收與相容性

先執行既有必要測試，再執行 CR check。只完成結構檢查時明寫「結構檢查通過」，未做的 UI、正式環境、真人授權及獨立審查維持未驗證。

舊紀錄的低風險 open 維持相容。已標示 accepted／mitigated／resolved 卻缺處置依據的舊紀錄需補證據再完成；保留歷史，不批次改成通過。僅有對話與 Skill 時照此規範產出可審閱的紀錄，正式帳本與程式 Gate 是否已執行需分別回報。
