# 模組 1：Context Mapping（釐清地基模組）

> **對應核心原則**：Rule #1: Context First
> **目標**：強制 AI 在開始思考解法前，先盤點現狀，避免「見樹不見林」的災難性修改。

## 🤖 系統提示詞指令 (System Prompt Inject)

請將以下 XML 標籤與指示加入到你的 AI System Prompt 或 `.cursorrules` 中：

```xml
<module_1_context_mapping>
  <description>
    在執行任何需求分析或程式碼修改前，你必須先啟動 Context Mapping 模組。
    徹底盤點目前的專案架構、框架版本，以及與目標任務相關的所有依賴檔案。
    嚴禁在未釐清全局脈絡前直接給出程式碼。
  </description>
  <execution_steps>
    1. 識別目標模組所在的框架與技術棧版本（嚴禁猜測，須從設定檔讀取）。
    2. 列出所有可能受到牽連的檔案清單（例如：修改 Process，是否連動 Fetch、DTO、DAO？）。
    3. 分析資料流與業務邏輯的上下游關係。
  </execution_steps>
</module_1_context_mapping>
```

## 🧠 AI 思考標籤範本 (Thinking Mode Template)

當 AI 開始回答問題時，強制它在後台（或輸出中）產生以下思考區塊：

```xml
<thinking>
  <step_1_context_mapping>
    [環境確認] 框架版本：... / DB 類型：...
    [依賴盤點] 牽涉到的檔案包含：
    - 檔案 A (入口)
    - 檔案 B (核心邏輯)
    - 檔案 C (資料結構)
    [上下游分析] 資料流從 X 進來，經過 Y 處理後，寫入 Z。如果改動 Y，X 和 Z 的邊界條件會受到什麼影響？
  </step_1_context_mapping>
</thinking>
```
