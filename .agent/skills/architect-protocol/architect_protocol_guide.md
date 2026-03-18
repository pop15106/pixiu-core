# 👷 架構師工作流 (Architect Protocol) 導入與操作指南

為了對齊團隊的工程規範（user_rules.md），我們將 AI 的思考分為 5 個強制經歷的模組。這套系統能有效壓制 AI 盲猜、順便重構、以及語言錯亂的壞習慣。

## 📁 模組文件清單

五個核心模組的 System Prompt 範本已放置於專案中的 `.agent/skills/architect-protocol/` 目錄下：

1. [模組 1：Context Mapping (釐清地基)](file:///c:/Users/7010/Desktop/gravityTest/PTWCS/.agent/skills/architect-protocol/module1_context_mapping.md) - 強制盤點框架與連動檔案
2. [模組 2：Debt Detection (技術債掃描)](file:///c:/Users/7010/Desktop/gravityTest/PTWCS/.agent/skills/architect-protocol/module2_debt_detection.md) - 掃描 NPE/效能/壞味道
3. [模組 3：Architectural Blueprinting (方案藍圖)](file:///c:/Users/7010/Desktop/gravityTest/PTWCS/.agent/skills/architect-protocol/module3_architectural_blueprinting.md) - 提供保守與最佳化多方案交由用戶決定
4. [模組 4：Boy Scout Execution (童軍實作)](file:///c:/Users/7010/Desktop/gravityTest/PTWCS/.agent/skills/architect-protocol/module4_boy_scout_execution.md) - 在白名單範圍內精準打擊並清理垃圾
5. [模組 5：Verification & Output Hook (驗收與防呆)](file:///c:/Users/7010/Desktop/gravityTest/PTWCS/.agent/skills/architect-protocol/module5_verification.md) - 強制繁體中文檢驗與提出測試計畫

## 🚀 如何啟動這套工作流？

你有三種方式可以啟動這套工作流：

### 方式一：全面強制套用（推薦給團隊協作）

建立或修改專案根目錄的 `.cursorrules` (或 `.windsurfrules`)，將上述五個模組的 XML 標籤內容依序貼入其中。

```xml
<architect_protocol>
  <system_instructions>
    你必須嚴格遵守以下 5 個思考模組。所有回答前都必須在 <thinking> 標籤中印出這 5 個 step 的思考過程。
  </system_instructions>
  <output_formatting>
    強烈要求：在 <thinking> 標籤中印出的內容，必須具備良好的 Markdown 排版與可讀性。
    1. 每個 <step_X> 標籤內的內容，必須適當使用斷行 (換行符號)。
    2. 使用條列式 (Bullet hooks) 或粗體 (Bold) 標示重點。
    3. 絕不允許將數十字的長篇大論擠在同一行而不換行，這會造成閱讀困難。
  </output_formatting>
  <!-- 貼上 module_1 到 module_5 的 xml 設定 -->
</architect_protocol>
```

### 方式二：建立 Claude Project (或 Custom GPTs)

如果你是在獨立網頁版的 Claude 使用，可以在建立 Project 時，將這五份 md 文件上傳至 Knowledge base，並在 Custom Instructions 告訴它：
> "Act as a Tech Lead. Always follow the guidelines defined in the uploaded architect protocol modules when solving coding problems."

### 方式三：單次任務召喚 (Slash Command 形式)

若不想全域套用，可以建立一份整合版的 `architect-flow.md` 放在 `.agent/workflows/` 中，往後只要對 AI 說：

> "使用 architect-flow 分析並且修復 L6移倉的 API 問題。"

---

### 💡 Tech Lead 的溫馨提醒

一開始導入時，你可能會覺得 AI 變「囉嗦」了。但這正是這套流程的價值—把**思考過程透明化**。
與其讓它花 10 秒吐出一段有隱患的 Code，不如讓它花 30 秒把所有的權衡利弊講清楚，因為架構師的職責是「除盲」，而不是「打字」。
