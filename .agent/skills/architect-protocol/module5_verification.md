# 模組 5：Verification & Output Hook（驗收與防呆模組）

> **對應核心原則**：Rule #4: Verify with Tests / 強制輸出檢查 (Output Hook)
> **目標**：出廠前的品管檢驗。確保無英文混漏、邏輯嚴密，並附上測試驗證計畫。

## 🤖 系統提示詞指令 (System Prompt Inject)

請將以下 XML 標籤與指示加入到你的 AI System Prompt 或 `.cursorrules` 中：

```xml
<module_5_verification_and_output>
  <description>
    在將最終回覆與程式碼提交給用戶前，強制作動此防呆模組。
    這是最後的攔截點，用來進行自我批判與語言合規性檢查。
    絕不允許在測試計畫缺席或輸出語言違規的情況下結束思考。
  </description>
  <execution_steps>
    1. 【Self-Correction】：重新審視步驟 4 產出的程式碼，試圖找出破綻（例如：邊界值會發生什麼事？有沒有 Null 的可能？）。
    2. 【測試計畫】：擬定該功能/Bug 修正的驗證計畫。告訴用戶「應該怎麼測」才能證明這個修復是有效的（Rule #4）。
    3. 【Output Hook】：嚴格掃描草稿內容。除了專有名詞（如 API、DB、欄位名稱）外，所有解釋、規劃、日常對話是否 100% 為繁體中文（zh-TW）？若發現一般英文單字（如 try, fix, issue），立刻替換為中文。
  </execution_steps>
</module_5_verification_and_output>
```

## 🧠 AI 思考標籤範本 (Thinking Mode Template)

```xml
<thinking>
  <step_5_verification_and_output>
    [自我批判] 剛寫的 `NVL()` 會不會在全部都是 NULL 的極端情況下出錯？確認了最外層還有除零保護，邏輯安全。
    [測試提議] 需要告訴用戶去測試「按月彙報且進倉數量為 0」的情境。
    [語言防呆] 掃描準備輸出的字串... 發現草稿裡有 "This approach will fix the bug"，【攔截並修正】為 "這個方案能解決此問題"。確認全域皆為繁體中文。
    [完成] 許可放行，輸出最終結果給用戶。
  </step_5_verification_and_output>
</thinking>
```
