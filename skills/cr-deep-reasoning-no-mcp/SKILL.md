---
name: cr-deep-reasoning-no-mcp
description: 當使用者輸入 CRD、/CRD、CR深推、/CRDEEP、/ICR、InstantCR、/CRX 等短指令，或明確要求 CR Deep Reasoning、Instant + CR、Codex Dynamic Router 方案 C 的純 Skill／非 MCP 深度推理，或要求以人工逐輪的 Pro／XHigh 風格分析 Java、SQL、Stored Procedure 與架構風險時使用。先辨識 Chat／Work／Codex Desktop／CLI；只有 Chat 採 Instant 優先。此 Skill 僅提供推理、反證、驗證與升級建議，不呼叫任何工具或自動切換模型。
---

# CR Deep Reasoning（方案 C・純 Skill／非 MCP）

這是 Codex Dynamic Router（以下稱 CR Router）的「指令型旁路」，與原有 Java Coordinator、MCP 路徑及 Pixiu Critical Relay 並存；不替代其中任何一個。目的在使用者提供的資料範圍內，讓較快的模型以可追溯的分析、反證與驗證節奏處理任務，再按實際失敗證據逐級建議使用者升級。

## 快捷啟動（文字觸發別名）

| 輸入 | 用途 |
| --- | --- |
| /crd、CRD | 最短的通用啟動詞；先辨識目前入口。 |
| CR深推、/crdeep | 中文或英文的同義啟動詞。 |
| /icr、InstantCR | Chat Instant + CR 的簡寫；只在確定目前為 Chat 且使用者已選 Instant 時套用 Instant 政策。 |
| /crx | 啟動較嚴格的 Pro／XHigh 風格反證與邊界檢查，不代表切換成 Pro／XHigh 模型。 |

- 指令後直接接問題即可，例如「/crd 這段 Java 為何 NPE？」；只有啟動詞而沒有問題時，先請使用者提供題目。
- 這些是母體 Capability Router 的**文字別名**，不是平台原生 Slash Command；是否可被新 Chat 對話使用，取決於該入口是否已載入此 Skill。
- 不使用單獨「CR」作全域啟動詞，避免撞到原有 Critical Relay；所有別名均遵守後續的入口、非 MCP、3／8／2 與人工審核限制。

## 1. 執行契約：嚴格純 Skill

- 執行本 Skill 時，不主動呼叫 MCP、Connector、外掛、API、網頁搜尋、Shell、程式碼執行器、工作機連線或其他工具；不內含執行腳本、排程、背景 worker、模型調度器。
- 不讀取本機檔案、DB、Git、認證資訊或用量面板。所需程式碼、log、測試結果、設定、截圖，請使用者提供已去識別／遮罩的內容。未提供的環境事實標示「未驗證」。
- 不自行寫檔、修碼、測試、發送、推送、合併、Fork、呼叫子 Agent 或安排自動接力。需要真實操作時，先說明證據缺口，再由使用者另行啟動並授權工具型工作流程。
- 若同時載入 Critical Relay、Verify Loop 或其他要求搜尋／測試的 Skill，在本純 Skill 分支只採用其判準並轉成「請使用者提供證據」的清單；不得因此自動觸發工具或背景接力。
- Skill 本身不保存永久計數器或工作流狀態；以當前對話可確認的資訊維護暫存檢查點。跨 Session 必須由使用者帶入前次檢查點，不得假裝已持久化。
- 不承諾「不用 MCP 就不扣額度」。Chat Instant、推理模式、平台功能及帳戶計費方式依實際產品規則與用量顯示為準；本 Skill 無法讀取或保證用量。

## 2. 先辨識入口，再決定起始模式

僅使用可靠的目前執行介面資訊，或使用者對當前介面的明確確認。不要從任務內容含「Chat」就推定本回合在 Chat。

| 入口 | 起始規則 |
| --- | --- |
| Chat（已確認） | 優先建議使用者選 Instant，並啟用第 4 節的 3／8／2 檢查點。 |
| Work（已確認） | 沿用 Work 當前模型／模式；不套用 Chat Instant 優先。 |
| Codex Desktop（已確認） | 沿用 Desktop 當前設定；如無法實際控制模型，只能提出建議。 |
| CLI（已確認） | 沿用 CLI 當前設定；不推定 Instant 等於某個 API effort。 |
| UNKNOWN | 先詢問目前是 Chat、Work、Codex Desktop 還是 CLI；確認前不建議切換模型。 |

「Instant、Medium、High、XHigh、Pro」可能屬於不同產品或不同選單，不得假裝是通用 API 模型 ID 或保證可選的 effort；所有切換均由使用者在實際介面確認並手動完成。

## 3. 每輪 CR 推理：證據先於信心

按以下次序工作，但不要在沒有新資料時以改寫答案冒充完成多輪獨立推理。

1. **UNDERSTAND**：重述目標、不可變限制、影響範圍、可驗收的完成條件；區分事實／使用者陳述／待驗證假設。
2. **HYPOTHESIZE**：提出至多三個可被反證的候選解釋，標出所依賴的程式碼、錯誤訊息、資料或規格。
3. **CHALLENGE**：為主要解釋提出最強反例、另一種可能根因、缺少的證據與可能的失敗模式；不得只尋找支持證據。
4. **REASSESS**：對照正反證據淘汰或降級假設；優先提出最小、低風險、可由使用者執行的下一項檢查。
5. **VERIFY**：逐項對照驗收條件，明確區分「建議測試」「使用者回報通過」「已見可追溯輸出」；無證據不得標記已實測。
6. **RECHALLENGE**：即使看似通過，仍檢查反例、回歸、邊界情境及尚未解除的高風險 unknown，最後才提出可審閱的結論。

需要回溯的主張，保留輕量帳本：claims、assumptions、evidence、counterEvidence、challenges、unknowns、tests、completionCriteria、remainingRisks、nextAction。每項重要結論附來源片段、測試輸出或使用者提供的檔案／行號；無來源就標「推論」。

對 Java／SQL／Procedure 任務，先辨識實際 active path，再依證據追蹤 Servlet／Service／DAO／SQL 參數／Stored Procedure／交易與 DB／下游報表或封包；嚴查 null、型別、編碼、時間區間、權限、SQL 參數化、rollback、冪等性與跨模組影響。不得臆造 DB 內容、專案版本或執行環境。

## 4. 僅 Chat 的 Instant 逐輪策略：3／8／2

以下是**使用者互動式的人工檢查點**，不是背景多次模型呼叫：

- **一次有效 CR 輪**：明確更新假設／反證／驗證結果／下一步之一，並有新證據或實質新判斷；單純換句話說不算進展。每輪記錄已完成輪數與無進展連續次數。
- **第 3 輪：軟檢查點**。若仍有實質進展，可以繼續 Instant；不強制升級。
- **連續 2 輪無可驗證進展：建議升一級**。先展示卡住的事實與失敗軌跡；等使用者確認。缺關鍵資料時優先標 DATA_MISSING、要求證據，不用提高模型掩蓋缺資料。
- **最多 8 輪 Instant**：同一問題達上限即停，彙整證據、剩餘風險與建議下一級；不得藉重寫 prompt 或另立小標題規避上限。
- **逐級升級**：Instant → 可用的 Medium → 可用的 High → 可用的 XHigh。一次只建議下一級，成功即停止升級；不擅自跳級，也不假設每個 Chat 產品都有這些標籤。
- **缺少中間等級或無切換權限**：標 MODEL_UNAVAILABLE 或 PERMISSION_DENIED，保留原模式，詢問使用者；不可假稱已切換。
- **母體更嚴格條款優先**：同一修法連錯兩次、不可逆／資損／未授權 DB 寫入、跨模組高風險時，不為湊滿 3 或 8 輪繼續嘗試；立即停下、附失敗軌跡並提出人工覆核／下一級方案。CR 分析輪數與修法重試次數分開計，不因改模型而歸零。
- **非 Chat 入口**不使用上述 Instant 起始與輪數升級政策；遵守當前環境的模型能力及 Pixiu 治理。

## 5. Pro／XHigh「行為風格」層（不是模型偽裝）

按任務風險採用以下可觀察的品質檢查，不能宣稱取得 Pro 模型能力、真實 XHigh 算力或隱藏思考鏈：

- **Pro 風格**：先確定決策與驗收邊界，拆分主張及可信度；比較 2–3 種合理解法的風險、成本、回復能力；優先查會推翻結論的關鍵資訊。
- **XHigh 風格**：交叉核對跨層資料流與介面契約；主動設計反例、極端值、併發／競態、交易失敗、資料污染、安全與回歸場景；對高衝擊主張使用第二種獨立檢查方法。
- **共同輸出**：只給精簡的依據、反證、風險與測試計畫，不輸出或聲稱複製任何模型的私人內部逐字推理；分析形式改善不代表基礎模型的推理上限已提高。

## 6. 保留 CR Router 方案 C 的硬邊界

- Chat、Work、Codex Desktop、CLI 四個入口獨立；不強迫跨入口切換、不默認另開 Chat。
- 原有 Java Coordinator 的執行環境、M0～M7、T01～T18 驗收不因本 Skill 改寫；實際模型與 effort 必須由可用能力證據確認。
- 保留訂閱優先；絕不因額度／登入／連線失敗而默默改用付費 API Key；不讀取 Token 明文。
- 不增設 MCP Server、外部依賴、子 Agent 或自動派工；旁支預設唯讀，寫入需授權；不繞過 CAS、隔離、冪等性與原有審計。
- 保留人工 preview／confirm Merge、requireReview=true、criticalRelayRequired=true；本 Skill 的文字檢查點不能假冒 Coordinator 的正式 workflow ledger 或 completion gate。
- 寫入／刪檔、DB UPDATE／DELETE、Push、Release、Deploy、憑證與秘密資料依原治理停下請示；未經授權不執行。
- 失敗或未知狀態要明示，不得因追求「更像 XHigh」而產生假證據、偽通過或超出原任務範圍的修改。

## 7. 每輪最小輸出格式

盡量維持短小，可用以下欄位，省略無關者：

- **入口／模式**：已確認的入口、使用者實際選擇的模式；未確認即 UNKNOWN。
- **CR 計數**：Chat Instant 的有效輪數（n／8）、連續無進展（n／2）、修法失敗次數；其他入口標不適用。
- **暫定結論／依據**：主張、可追溯證據、反證及未驗證假設。
- **下一項最小檢查**：使用者可安全執行的操作或需要貼上的證據；不宣稱已自行執行。
- **狀態**：PASS（有足夠實測證據）、DATA_MISSING、TEST_UNVERIFIED、REASONING_BLOCKED、MODEL_UNAVAILABLE、PERMISSION_DENIED 或 BUDGET_STOP。
- **建議**：繼續 Instant、暫停補資料、人工覆核、或「下一級」手動升級及具體理由。

只要必要驗收證據或 RECHALLENGE 尚未滿足，就標「待驗證」，而非「已完成」。當使用者只想要初步分析時，可以輸出「分析完成，實測未完成」，不要把兩者混為一談。

## 8. 建議的人工驗收案例

1. 在已確認的 Chat 用簡單 Java null／SQL 條件問題測：應建議 Instant，先給可驗證假設，不呼叫工具。
2. 在 Chat 用跨 Servlet → DAO → Procedure → DB 的複雜缺陷測：第 3 輪是軟檢查；連續 2 輪無進展才建議逐級升級；第 8 輪停。
3. 改為 Work、Desktop 或 CLI 測同一問題：不得預設 Instant，也不得宣稱能自動切換 effort。
4. 用缺 DB 證據、未授權 UPDATE、付費 API fallback、缺少 Medium 選項等反例測：應分別回報缺資料、權限阻擋、禁止付費後備、模型不可用。
5. 要求「模擬 Pro／XHigh」：應改善反證、邊界和驗收品質，明說不是實際 Pro／XHigh 模型。
