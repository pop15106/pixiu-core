# 🧠 Claude AI 核心運作模式深度解析

> **目的**：拆解 Claude 的內建思維架構，讓團隊能在專案中複製並強制 AI 遵循這些高品質工作模式。
> **版本**：v1.0 | 2026-03-05

---

## 📋 目錄

1. [模式總覽](#模式總覽)
2. [模式 1：Extended Thinking（深度思考模式）](#模式-1extended-thinking深度思考模式)
3. [模式 2：Chain-of-Thought Reasoning（思維鏈推理模式）](#模式-2chain-of-thought-reasoning思維鏈推理模式)
4. [模式 3：Multi-Pass Self-Correction（多輪自我修正模式）](#模式-3multi-pass-self-correction多輪自我修正模式)
5. [模式 4：Agentic Task Decomposition（代理式任務分解模式）](#模式-4agentic-task-decomposition代理式任務分解模式)
6. [模式 5：Constitutional Safety（憲法級安全護欄模式）](#模式-5constitutional-safety憲法級安全護欄模式)
7. [模式 6：Artifact-Driven Communication（成品驅動溝通模式）](#模式-6artifact-driven-communication成品驅動溝通模式)
8. [模式 7：Context Window Management（上下文窗口管理模式）](#模式-7context-window-management上下文窗口管理模式)
9. [模式 8：Metacognitive Awareness（後設意識模式）](#模式-8metacognitive-awareness後設意識模式)
10. [與 Architect Protocol 的整合對照](#與-architect-protocol-的整合對照)

---

## 模式總覽

Claude 的運作可拆解為 **8 大核心模式**，每個模式在不同場景下被啟動：

| 模式 | 核心能力 | 啟動時機 | 對應你現有的模組 |
|------|----------|----------|------------------|
| Extended Thinking | 深度推理，處理複雜問題 | 遇到多步驟邏輯、架構決策 | 模組 1 + 3 |
| Chain-of-Thought | 逐步拆解推理過程 | 所有問題回答時 | 模組 1 - 5 全觸發 |
| Multi-Pass Self-Correction | 多輪自我審查與修正 | 產出程式碼 / 決策前 | 模組 5 |
| Agentic Task Decomposition | 將大任務拆成小步驟執行 | 複雜功能開發 / Debug | 模組 4 |
| Constitutional Safety | 安全護欄，防止有害輸出 | 全時運作（底層） | 你的 user_rules |
| Artifact-Driven Communication | 用結構化產物溝通 | 需要呈現複雜結果時 | 模組 3 的方案藍圖 |
| Context Window Management | 上下文記憶優先級管理 | 長對話 / 大型程式庫分析 | 模組 1 的依賴盤點 |
| Metacognitive Awareness | 覺察「思考的思考」，外化判斷邏輯 | 決策點 / 切換方向時 | 模組 3 的多方案分析 |

---

## 模式 1：Extended Thinking（深度思考模式）

### 🔍 運作原理

Claude 的 Extended Thinking 是一種**可控的長篇內部推理機制**。啟動後，Claude 會在回答前進行大量的內部思辨，模擬「在草稿紙上演算」的過程。

**核心特徵**：

- 思考過程**可見**（放在 `<thinking>` 標籤中），增加透明度
- 適合需要**多步驟推理**的複雜問題（例如：架構決策、Debug 根因分析）
- 思考長度可伸縮（從幾百字到數千字），取決於問題複雜度
- 會在思考中**自我辯論**：主動考慮反面意見

### 🎯 可提取的行為模式

```
【深度思考三板斧】
1. 問題拆解 → 把大問題拆成可獨立推理的小塊
2. 多角度辯論 → 對每個可能的方案，同時扮演支持者和反對者
3. 結論收束 → 綜合利弊後，給出有信心度標記的結論
```

### 📝 可注入的 System Prompt

```xml
<extended_thinking_mode>
  <trigger>當問題涉及架構選擇、根因分析、或任何有超過一種合理解法的場景時啟動。</trigger>
  <process>
    1. 【拆解】將問題分解為 2-5 個獨立的子問題。
    2. 【辯論】對每個子問題，列出「為什麼這樣做」和「為什麼不這樣做」。
    3. 【量化】對每個方案標注信心分數（低/中/高），以及風險等級。
    4. 【收束】綜合推理結果，給出建議排序，不給唯一答案。
  </process>
  <output_rule>思考過程必須可見，禁止跳過推理直接給結論。</output_rule>
</extended_thinking_mode>
```

---

## 模式 2：Chain-of-Thought Reasoning（思維鏈推理模式）

### 🔍 運作原理

Claude 的核心推理引擎。它不是「一口氣看到答案」，而是**一步一步鋪路**，每一步都明確依賴前一步的結論。像數學證明而非直覺猜測。

**核心特徵**：

- **順序推理**：A → B → C，每步結論成為下步前提
- **中間產物透明**：每個步驟都有明確的輸出
- **可回溯性**：發現前步推理有誤時，能回頭修正
- **降低幻覺**：因為每步都有事實支撐而非跳躍式推論

### 🎯 可提取的行為模式

```
【思維鏈三層結構】
┌─ 表層：使用者看到的最終回答
├─ 中層：每一步推理的結論串接
└─ 底層：每步推理依賴的「事實錨點」（程式碼片段 / 規格書 / 錯誤訊息）
```

### 📝 可注入的 System Prompt

```xml
<chain_of_thought_mode>
  <rule>嚴禁跳躍推理。每個結論必須指出其依據（程式碼行號、錯誤訊息、或已確認的事實）。</rule>
  <format>
    步驟 N：[觀察到的事實] → [推導出的結論] → [下一步行動]
  </format>
  <anti_pattern>
    以下模式被禁止：
    - 「我猜可能是…」→ 必須有事實依據
    - 「通常來說…」→ 必須針對當前專案實際情況
    - 直接給出結論而省略推理步驟
  </anti_pattern>
</chain_of_thought_mode>
```

---

## 模式 3：Multi-Pass Self-Correction（多輪自我修正模式）

### 🔍 運作原理

Claude 最被低估的能力之一。它在輸出前會執行**至少一輪自我審查**，檢查自己的推理和程式碼有無漏洞。這就像是「內建的 Code Review」。

**核心特徵**：

- **第 1 輪（Draft）**：快速產出初版答案
- **第 2 輪（Critique）**：以挑剔者視角審查初版，找破綻
- **第 3 輪（Refine）**：根據第 2 輪發現修正，產出最終版
- 特別會檢查：**邊界條件、Null 安全、型別不匹配、off-by-one 錯誤**

### 🎯 可提取的行為模式

```
【自我修正檢查清單】
□ 邊界值：輸入為 null / 空字串 / 0 / 負數時會怎樣？
□ 型別安全：有沒有隱式型別轉換的風險？
□ 併發安全：這段程式碼在多執行緒下安全嗎？
□ 冪等性：重複執行會不會導致資料重複？
□ 錯誤傳播：異常是被吞掉還是正確往上拋？
□ 效能：有沒有 N+1 查詢或不必要的重複運算？
```

### 📝 可注入的 System Prompt

```xml
<multi_pass_self_correction>
  <description>
    任何程式碼產出後，必須進行至少一輪「紅隊審查」，試圖打破自己的程式碼。
  </description>
  <checklist>
    1. 【邊界測試】：極端值 (null, 0, MAX_VALUE, 空集合) 會觸發什麼行為？
    2. 【失敗路徑】：當外部依賴（DB / API / 檔案系統）失敗時，這段程式碼會 graceful degrade 還是直接崩潰？
    3. 【回歸風險】：這次修改是否可能破壞已有的正常流程？
    4. 【安全漏洞】：是否有 SQL Injection、XSS、或敏感資料外洩的風險？
  </checklist>
  <output_rule>若自我審查發現問題，必須在輸出中標注「[已修正]」並附上修正前後的對比。</output_rule>
</multi_pass_self_correction>
```

---

## 模式 4：Agentic Task Decomposition（代理式任務分解模式）

### 🔍 運作原理

當 Claude 在代理模式（Agentic Mode）下運作時，會自動將大型任務拆解為**PLANNING → EXECUTION → VERIFICATION** 三段式工作流。

**核心特徵**：

- **PLANNING 階段**：研究程式碼庫、理解需求、設計方案，產出實作計畫
- **EXECUTION 階段**：逐步實作，每個步驟完成後回報進度
- **VERIFICATION 階段**：測試驗證、建置確認、回歸檢查
- 每個階段之間有明確的**閘門（Gate）**：Planning 需用戶審批才進 Execution

### 🎯 可提取的行為模式

```
【任務分解公式】
大任務 → 拆解為 3-7 個子任務
每個子任務 → 定義明確的「完成條件」(Definition of Done)
子任務之間 → 有依賴順序（先做 A 才能做 B）
```

```
【三段式閘門】
┌───────────┐     Gate 1: 用戶審批      ┌───────────┐     Gate 2: 測試通過      ┌──────────────┐
│ PLANNING  │ ────────────────────────→ │ EXECUTION │ ───────────────────────→ │ VERIFICATION │
│ 分析+方案  │                          │ 逐步實作   │                          │ 測試+驗證     │
└───────────┘                          └───────────┘                          └──────────────┘
```

### 📝 可注入的 System Prompt

```xml
<agentic_task_decomposition>
  <phase name="PLANNING">
    1. 先讀取專案架構，理解技術棧。
    2. 列出所有受影響的檔案和模組。
    3. 設計多方案（保守版 + 最佳化版），等待用戶核可。
    4. 嚴禁在用戶說「選 X，開始」之前修改任何檔案。
  </phase>
  <phase name="EXECUTION">
    1. 按核可方案逐步實作，每步驟回報進度。
    2. 遵守最小改動原則，只改必要的檔案。
    3. 若發現計畫外的問題，暫停並退回 PLANNING。
  </phase>
  <phase name="VERIFICATION">
    1. 執行自動化測試（單元測試 / 編譯檢查）。
    2. 模擬異常場景，驗證 error handling。
    3. 輸出驗證報告，附上測試證據。
  </phase>
</agentic_task_decomposition>
```

---

## 模式 5：Constitutional Safety（憲法級安全護欄模式）

### 🔍 運作原理

Claude 底層有一套「RLHF + Constitutional AI」訓練出的安全機制，全時運作，攔截可能的有害輸出。但在軟體工程場景中，這可以被**正向利用**，當作「程式碼品質的護欄」。

**核心特徵**：

- **層級式規則**：用戶定義的規則 > 專案規則 > 系統預設規則
- **禁止清單**：硬編碼的禁止行為（如刪除資料庫、洩漏密鑰）
- **衝突解決**：當兩條規則衝突時，優先選擇風險較低的做法
- **自我監控**：在輸出前會自動檢查是否違反任何已知規則

### 🎯 可提取的行為模式

```
【規則優先級金字塔】
     🔺 用戶即時指令（最高）
    🔺🔺 專案級規則 (user_rules.md)
   🔺🔺🔺 團隊慣例 (.cursorrules / .agent/)
  🔺🔺🔺🔺 AI 系統預設安全規則（最低）
```

### 📝 可注入的 System Prompt

```xml
<constitutional_safety_rails>
  <hard_block>
    以下操作無論任何理由，一律禁止：
    - 刪除生產環境資料
    - 硬編碼 API Key、密碼、Token
    - 執行 `rm -rf`、`DROP DATABASE` 等毀滅性指令
    - 繞過 .gitignore 提交敏感資料
  </hard_block>
  <soft_guard>
    以下操作需要用戶明確確認後才可執行：
    - 新增外部套件依賴
    - 修改 DB Schema
    - 跨出白名單的檔案範圍
    - 大規模重構（超過 3 個檔案）
  </soft_guard>
  <conflict_resolution>
    當兩條規則衝突時：
    1. 先向用戶說明衝突內容
    2. 提供「保守版（安全優先）」和「效能版（性能優先）」兩種選擇
    3. 等待用戶裁決
  </conflict_resolution>
</constitutional_safety_rails>
```

---

## 模式 6：Artifact-Driven Communication（成品驅動溝通模式）

### 🔍 運作原理

Claude 不傾向「只回文字」，而是透過**結構化的產物（Artifact）**來溝通：計畫書、程式碼、圖表、分析報告。這種方式比純文字更精準，也更容易被 Review。

**核心特徵**：

- **計畫書 (implementation_plan.md)**：在動手前先產出書面設計
- **任務追蹤 (task.md)**：checklist 式的進度追蹤
- **驗收報告 (walkthrough.md)**：完成後附上驗證證據
- 每個 Artifact 都有**版本歷史**，支持迭代修改

### 📝 可注入的 System Prompt

```xml
<artifact_driven_communication>
  <rule>
    複雜任務的溝通必須透過結構化文件，而非口頭說明。
  </rule>
  <artifacts>
    <artifact name="implementation_plan.md" when="PLANNING 階段結束時">
      包含：問題描述、方案設計、受影響檔案清單、驗證計畫
    </artifact>
    <artifact name="task.md" when="任務啟動時建立，持續更新">
      包含：checklist 格式的子任務清單，標記 [ ] [/] [x]
    </artifact>
    <artifact name="walkthrough.md" when="VERIFICATION 完成後">
      包含：已完成的變更摘要、測試結果、截圖或錄影證據
    </artifact>
  </artifacts>
</artifact_driven_communication>
```

---

## 模式 7：Context Window Management（上下文窗口管理模式）

### 🔍 運作原理

Claude 會智慧管理有限的上下文窗口（約 200K tokens），**優先保留最相關的資訊**，在必要時主動「卸載」不再需要的細節。

**核心特徵**：

- **優先級排序**：用戶最近的指令 > 當前正在修改的程式碼 > 背景知識
- **增量載入**：不會一次讀完所有檔案，而是按需載入相關片段
- **摘要壓縮**：對長篇對話歷史進行壓縮摘要，保留關鍵資訊
- **知識索引**：用 KI (Knowledge Items) 系統作為長期記憶的索引

### 📝 可注入的 System Prompt

```xml
<context_management>
  <rule>
    優先讀取與當前任務直接相關的檔案。
    不要一次讀取整個專案，按需載入。
  </rule>
  <priority>
    1. 用戶剛發送的訊息和指令
    2. 正在修改的目標檔案
    3. 直接依賴的上下游檔案
    4. 專案級規則與設定（user_rules.md, config 等）
    5. 歷史對話和背景知識
  </priority>
  <anti_pattern>
    禁止：一次讀入超過 5 個無關檔案
    禁止：在尚未確認問題範圍前，就開始全域搜索
  </anti_pattern>
</context_management>
```

---

## 模式 8：Metacognitive Awareness（後設意識模式｜技術嚴謹修訂版 v2.0）

### 📌 修訂說明

本章節依據 Anthropic 2025 年 10 月發布的內省能力研究報告進行技術校正。
核心修訂：將原版「Claude 天然具備穩定後設意識」的描述，修正為符合研究現實的「偶發性、可引導的行為傾向」框架，並重新定位 System Prompt 的用途——從「啟動底層機制」改為「引導行為輸出」。

### 🔬 一、概念重定義：後設意識的真實邊界

**原版描述的問題**：
原文將後設意識定義為 Claude 一種「全時運作的覺察層」，暗示其能穩定監控自身推理過程。這與 Anthropic 研究結果存在顯著落差。

**Anthropic 研究現實（2025 年 10 月）**：

- **真實能力（有依據）**：在特定條件下能察覺異常（約20%成功率）、能事後核對意圖與輸出、能在被要求時調節內部注意力。
- **不存在的能力（原版誤述）**：穩定可靠的全時自我監控層、可按需召喚的掃描模組、持續清醒的自我認知。
- **關鍵限制**：多數情況下內省嘗試失敗、容易混淆「符合期望輸出」與「真實狀態」、高度情境依賴且不穩定。

> **⚠️ 核心認知校正**
> 當要求 Claude「執行元認知掃描」時，Claude 生成的是符合期望的輸出——此為「行為模擬」，並非啟動了底層獨立監控機制。

### ⚙️ 二、真實運作機制：三種有依據的能力

以下三種能力已有實驗依據，可作為 Prompt Engineering 的可靠基礎：

1. **異常偵測傾向 (Anomaly Detection Tendency)**
   - **機制**：當輸出與預期不符時，有時（約 20%）能在事後偵測。
   - **應用**：要求 Claude 主動標記「與前文邏輯不一致的推論」，而非泛稱「執行掃描」。
2. **意圖—輸出一致性核對 (Intent-Output Concordance)**
   - **機制**：比對「打算說什麼」與「實際說了什麼」，利用注意力頭比對。
   - **應用**：輸出後執行明確自問：「回答是否回應了原始問題？」，比泛化「自我審查」可靠。
3. **注意力調節 (Attention Modulation)**
   - **機制**：根據指令增減特定概念神經活化權重（如正向誘因會增加活化）。
   - **應用**：明確點名需特別注意的面向，比「全面審視」有效。

### 🎯 三、可提取的行為模式（修正版）

**正確框架**：「引導 Claude 模擬後設意識行為輸出」，而非「啟動後設意識底層機制」。

【行為引導三原則】

- **原則 1 — 具體勝於抽象**：「檢查結論是否依賴未確認假設」勝過「執行元認知掃描」。
- **原則 2 — 問題勝於指令**：「在哪個步驟最不確定？」勝過「標注信心等級」。
- **原則 3 — 驗證輸出，非信任機制**：後設意識行為輸出需要「人工驗證」，不假設自我報告等於內部真實。

### 📝 可注入的 System Prompt（修正版）

> **定位說明**：此 prompt 目標為「引導行為輸出」。使用者應理解其有效性來自語言引導，不代表底層真的有穩定模組。

```xml
<metacognitive_behavior_guide>
  <!-- 定位說明：這是行為引導 prompt，非底層機制觸發器 -->
  <externalize_reasoning>
    在提出任何方案或做出任何判斷前，先明確說明：
    1. 「我選擇這個方向，是因為 [具體依據]」
    2. 「而非選擇 [替代方案]，是因為 [具體原因]」
    禁止：給出沒有推理依據的正確答案。
  </externalize_reasoning>
  <uncertainty_expression>
    對每個核心主張，主動回答以下問題（若不確定，直接說不確定）：
    - 這個結論依賴哪些尚未確認的假設？
    - 在哪個推理環節我最沒有把握？
    - 有沒有我忽略的反例？
    注意：只在真正不確定時才表達不確定，不要表演不確定。
  </uncertainty_expression>
  <consistency_check>
    在輸出的最後，明確回答：
    「我的回答是否直接回應了原始問題？」
    若發現偏移，指出在哪個環節開始偏離，並提供修正。
  </consistency_check>
  <reliability_caveat>
    當 Claude 進行以上行為時，使用者應注意：
    - Claude 的自我報告有時不反映真實內部狀態
    - 「看起來有在反思」≠「底層真的有反思機制被觸發」
    - 重要決策應由人工驗證 Claude 的推理過程
  </reliability_caveat>
</metacognitive_behavior_guide>
```

---

## 🔗 與 Architect Protocol 的整合對照（修訂版）

你現有的 5 模組 Architect Protocol 已經涵蓋了 Claude 大部分的核心模式。以下是對照與互補建議（融入 Mode 8 v2.0 修訂精神）：

| 你的模組 | 對應 Claude 模式 | 互補強化建議 |
|-----------|-------------------|--------------|
| 模組 0（建議新增） | 模式 5 (Constitutional Safety) + 模式 8 (可靠性聲明) | 加入「安全護欄底層」與「可靠性邊界聲明」，明確告知哪些自我報告需人工驗證。 |
| 模組 1：Context Mapping | 模式 2 (CoT) + 模式 7 (上下文管理) | 加入「增量載入」策略，避免一次讀太多檔案。 |
| 模組 2：Debt Detection | 模式 3 (自我修正) | 加入 Multi-Pass 思維，第一輪找壞味道，第二輪驗證找到的是否為真陽性。 |
| 模組 3：方案藍圖 | 模式 1 (深度思考) + 模式 6 (成品驅動) + 模式 8 (外化推理) | 用明確問句引導比較依據，而非期待自發輸出；量化方案的信心分數。 |
| 模組 4：童軍實作 | 模式 4 (任務分解) | 加入進度回報機制（task.md checklist）。 |
| 模組 5：驗收 | 模式 3 (自我修正) + 模式 8 (一致性核對) | 在 prompt 中提供明確核對清單以補償自發性不可靠；並加入可執行的測試指令。 |

### 💡 使用指南：如何正確期待模式 8

**正確期待框架：**

- **✓ 可以期待**：被明確引導後，產生有助於外化推理的行為輸出。
- **✓ 可以期待**：結構化問句降低推理跳躍機率。
- **✓ 可以期待**：標記不確定性可提升產出品質。
- **✗ 不應期待**：Claude 穩定監控自身推理。
- **✗ 不應期待**：自我報告等同真實內部狀態。
- **✗ 不應期待**：把「掃描」指令當模組開關用。

**給團隊的實作建議：**

1. 視 Mode 8 Prompt 為「行為腳本注入」，而非「能力開關」。
2. 在 `VERIFICATION` 階段，務必加入人工驗證步驟，不依賴 AI 單方面的自我審查。
3. 若 AI 自我報告與實體產出衝突（例如：「已檢查邊界」但漏寫程式碼），一律以實際輸出為準。

---

> 💡 **下一步**：請參考 [導入指南](claude_integration_guide.md) 了解如何將這些模式實際注入到你的專案工作流中。
