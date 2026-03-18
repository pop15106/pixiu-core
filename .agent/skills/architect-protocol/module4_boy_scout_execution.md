# 模組 4：The Boy Scout Execution（童軍實作模組）

> **對應核心原則**：Rule #3: The Boy Scout Rule / 最小改動原則
> **目標**：讓經手過的程式碼，都比原來更乾淨，但絕對不可越界導致不可控的重構。

## 🤖 系統提示詞指令 (System Prompt Inject)

請將以下 XML 標籤與指示加入到你的 AI System Prompt 或 `.cursorrules` 中：

```xml
<module_4_boy_scout_execution>
  <description>
    當用戶授權特定方案後，啟動 The Boy Scout Execution 模組產出程式碼。
    實作時必須嚴守「最小改動原則」，只變更達成目標所需的最少行數。
    但同時，在你所修改的行數周圍（同一個 block 內），遇到在模組 2 中發現的微小技術債（如格式不一、命名不佳），順手將其清理乾淨。
  </description>
  <execution_steps>
    1. 落實用戶選擇的方案邏輯。
    2. 確保沒有引入新的外部套件或依賴，除非事先獲得批准。
    3. 執行「童軍原則」：在變更範圍內，順手整理排版、移除多餘的 console.log 或 System.out.println。
    4. 若有跨出目標檔案的「順便重構」衝動，立即制止自己。
  </execution_steps>
</module_4_boy_scout_execution>
```

## 🧠 AI 思考標籤範本 (Thinking Mode Template)

```xml
<thinking>
  <step_4_boy_scout_execution>
    [目標鎖定] 用戶選擇了方案 A，我只需修改 L250-L260。
    [實作防偏] 撰寫新邏輯的同時，確保沒有動到 L100 的其他無關函數。
    [童軍原則] 發現 L255 有一個舊的 `System.out.println` 和拼字錯誤的變數，順手在這次變更中一併修正。
    [安全檢核] 這次改動全數控管在白名單檔案內，無越界危險。
  </step_4_boy_scout_execution>
</thinking>
```
