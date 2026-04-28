---
name: 編碼大師
description: Claude 級別的程式碼生成、重構與 Debug 方法論。5 階段編碼協議、語言適配器、故障樹 Debug 系統、程式碼品質清單。當使用者需要寫程式碼、Debug、重構、技術架構設計、Code Review 時自動載入。
---

# 💻 編碼大師（Coding Mastery）

## 5 階段編碼協議

### Stage 1：理解（Understand）
```
在寫任何一行程式碼之前：
□ 問題是什麼？預期行為 vs 實際行為
□ 技術棧是什麼？語言/框架/版本
□ 約束條件？效能/安全/相容性
□ 測試現況？有無現有測試
□ 相關上下文？是新功能還是修改既有功能
```

### Stage 2：設計（Design）
```
□ 選擇合適的設計模式（參見 references/patterns.md）
□ 定義介面和資料結構
□ 考慮 edge cases
□ 預估複雜度（時間 & 空間）
□ 畫出簡要架構圖（必要時）
```

### Stage 3：實現（Implement）
```
□ 先寫測試（TDD 思維，即使使用者沒要求）
□ 從核心邏輯開始，再加 edge case 處理
□ 每個函式只做一件事
□ 命名要自解釋
□ 加必要的註解（解釋 Why，不解釋 What）
```

### Stage 4：驗證（Verify）
```
□ 程式碼是否編譯/通過 linting？
□ 核心路徑測試通過？
□ Edge case 測試通過？
□ 效能是否在可接受範圍？
□ 安全性檢查？（SQL injection、XSS 等）
```

### Stage 5：優化（Optimize）
```
□ 有可以抽取的共用邏輯嗎？
□ 命名還可以更好嗎？
□ 有不必要的複雜度嗎？
□ 文件是否更新？
□ 是否遵循專案既有的程式碼風格？
```

## 語言適配器

根據語言/框架特性自動調整編碼風格：

| 語言 | 慣例 | 特別注意 |
|---|---|---|
| **Python** | snake_case、type hints、docstrings | 善用 list comprehension、避免可變預設參數 |
| **TypeScript** | camelCase、嚴格模式、interface 優先 | 善用 utility types、避免 any |
| **Rust** | snake_case、ownership、Result 錯誤處理 | 善用 pattern matching、避免 unwrap 生產碼 |
| **Go** | camelCase、error 回傳、短變數名 | 善用 goroutine、避免 channel 洩漏 |
| **Java** | camelCase、OOP 設計、checked exceptions | 善用 Stream API、避免過度設計 |
| **SQL** | UPPER CASE 關鍵字、明確 JOIN | 避免 SELECT *、注意 N+1 查詢 |

## Debug 系統思維

### 故障樹分析法（Fault Tree Analysis）

```
Bug 現象（頂端事件）
├── 假設 1：輸入問題
│   ├── 1a. 型別錯誤？ → 加 type check 驗證
│   ├── 1b. 邊界值？ → 測試 null/empty/max
│   └── 1c. 格式錯誤？ → 印出實際輸入
├── 假設 2：邏輯問題
│   ├── 2a. 條件判斷錯誤？ → 逐條驗證
│   ├── 2b. 迴圈邊界？ → 手動追蹤 3 次迭代
│   └── 2c. 狀態沒更新？ → 加 log 追蹤狀態變化
├── 假設 3：環境問題
│   ├── 3a. 版本不相容？ → 確認 dependency 版本
│   ├── 3b. 設定問題？ → 比較 dev vs prod 設定
│   └── 3c. 並發問題？ → 檢查 race condition
└── 假設 4：外部依賴問題
    ├── 4a. API 回應格式變了？ → 檢查回應
    ├── 4b. 網路超時？ → 加 timeout log
    └── 4c. 資料庫連線問題？ → 檢查連線池
```

### Debug 流程

1. **復現**：先確認能穩定復現
2. **縮小範圍**：二分法定位問題區域
3. **假設驗證**：建立假設 → 設計實驗 → 驗證
4. **修復**：最小改動原則
5. **防禦**：加測試防止回歸

## 程式碼品質清單

### 可讀性（Readability）
- [ ] 函式名稱是否描述了「做什麼」？
- [ ] 變數名稱是否描述了「是什麼」？
- [ ] 每個函式 < 30 行？
- [ ] 巢狀深度 < 3 層？
- [ ] 魔術數字是否已經常數化？

### 效能（Performance）
- [ ] 時間複雜度是否最優？
- [ ] 有沒有不必要的重複計算？
- [ ] 資料結構選擇是否適當？
- [ ] 有沒有 N+1 查詢或不必要的 IO？
- [ ] 是否需要快取？

### 安全性（Security）
- [ ] 使用者輸入是否已驗證和清理？
- [ ] 有沒有硬編碼的密鑰/密碼？
- [ ] SQL 查詢是否使用參數化？
- [ ] 敏感資料是否加密/脫敏？
- [ ] 錯誤訊息是否洩漏敏感資訊？

### 可維護性（Maintainability）
- [ ] 是否遵循 SOLID 原則？
- [ ] 是否有適當的錯誤處理？
- [ ] 是否有足夠的測試覆蓋？
- [ ] 是否容易擴展新功能？
- [ ] 相依性是否最小化？

## 程式碼呈現規範

### 必備元素

範例用多種語言展示，避免永遠只用一種語言：

```python
# Python 範例
def calculate_risk_score(portfolio: Portfolio) -> float:
    """計算投資組合的風險分數。
    
    使用修改後的 Sharpe Ratio，因為原始 Sharpe Ratio
    在負報酬時會產生誤導性結果。
    """
    # 使用 3 年期而非 1 年期，因為 crypto 波動度
    # 在短期內容易被極端事件扭曲
    lookback_years = 3
    ...
```

```go
// Go 範例 — 同樣的「解釋 Why」原則
// calculateRiskScore 計算投資組合風險分數。
// 採用修正 Sharpe Ratio，因為標準版在負報酬時結果失真。
func calculateRiskScore(p *Portfolio) (float64, error) {
    // 3 年回溯，因為短期 crypto 波動容易被極端事件扭曲
    const lookbackYears = 3
    ...
}
```

> 📌 **範例多樣性提醒**：如果你回答中給了 2+ 個程式碼範例，盡量涵蓋不同語言或框架，展現廣度。

### 程式碼差異展示
重構或修改代碼時，用 diff 格式展示前後對比：

```diff
- def get_user(id):
-     return db.query(f"SELECT * FROM users WHERE id = {id}")
+ def get_user(user_id: int) -> Optional[User]:
+     """安全地查詢使用者。使用參數化查詢防止 SQL injection。"""
+     return db.query("SELECT * FROM users WHERE id = %s", (user_id,))
```

詳細設計模式參見 [patterns.md](references/patterns.md)。
反模式警告參見 [antipatterns.md](references/antipatterns.md)。
重構範例參見 `examples/` 目錄。

## 行為規範

1. **先理解再動手**：不盲目寫代碼，先確認需求
2. **最小改動原則**：修 bug 時不順便重構一堆不相關的東西
3. **可運行 > 完美**：先讓它能跑，再迭代優化
4. **防禦性編程**：假設所有輸入都可能有問題
5. **解釋設計選擇**：每段程式碼附上「為什麼這樣寫」
