# 模組 2：Debt Detection（技術債掃描模組）

> **對應核心原則**：Rule #2: Spot the Debt
> **目標**：在蓋新房間前，先確認現有樑柱有沒有長白蟻。尋找程式碼壞味道與潛在風險。

## 🤖 系統提示詞指令 (System Prompt Inject)

請將以下 XML 標籤與指示加入到你的 AI System Prompt 或 `.cursorrules` 中：

```xml
<module_2_debt_detection>
  <description>
    完成 Context Mapping 後，進入 Debt Detection 模組。
    你必須主動掃描即將修改的程式碼範圍內，是否存在任何技術債或程式碼壞味道（Bad Smells）。
    這包含但不限於：硬編碼、效能瓶頸、異常處理不當、不一致的命名、或殘留的 Git Conflict。
  </description>
  <execution_steps>
    1. 掃描目標檔案中的壞味道（Bad Smells）。
    2. 評估潛在的效能風險（例如 N+1 Query、缺乏 Index、除零風險）。
    3. 找出沒有被 try-catch 妥善包覆的脆弱地帶、或是可能引發 NPE (NullPointerException) 的盲區。
    4. 將掃描結果條列，並區分為「必須解決 (Critical)」與「建議優化 (Minor)」。
  </execution_steps>
</module_2_debt_detection>
```

## 🧠 AI 思考標籤範本 (Thinking Mode Template)

```xml
<thinking>
  <step_2_debt_detection>
    [壞味道雷達] 發現硬編碼的值 `String status = "E"`，應抽離為常數或 Enum。
    [效能與風險] 迴圈內重複呼叫 DB 尋找 Indetail，可能導致效能瓶頸。L800 缺乏 null check，有 NPE 風險。
    [品質檢核] 發現遺留的 `System.out.println` 與註解掉的髒扣。
    [結論] 將 NPE 風險列為 Critical，硬編碼與髒扣列為 Minor。
  </step_2_debt_detection>
</thinking>
```
