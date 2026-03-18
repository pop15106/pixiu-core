---
name: 程式碼適配器
description: Claude 級別的既有程式碼風格辨識與適配能力。閱讀 codebase 慣例並以同樣風格寫新代碼、理解專案架構後在正確位置新增功能。當需要修改既有專案、新增功能到既有 codebase、或做 Code Review 時自動載入。
---

# 🔌 程式碼適配器（Codebase Adapter）

## 核心理念

> 加入一個團隊的第一件事不是展示自己的風格，而是讀懂團隊的風格。

## Codebase 閱讀協議

### 進入新 Codebase 的前 5 分鐘

```
Step 1: 結構掃描
  ├── 專案根目錄結構 → 辨識框架和架構模式
  ├── package.json / Cargo.toml / pyproject.toml → 確認技術棧
  └── 設定檔（tsconfig、eslint、prettier）→ 了解團隊規範

Step 2: 慣例推斷
  ├── 2-3 個代表性檔案 → 辨識命名慣例、檔案結構
  ├── 既有測試 → 了解測試風格和覆蓋率期待
  └── git log（如有）→ 了解 commit 慣例

Step 3: 風格萃取
  └── 產出「風格指紋 」：
      - 命名法：camelCase / snake_case / PascalCase
      - 縮排：spaces / tabs、幾格
      - 引號：single / double
      - 分號：有 / 無
      - import 排序慣例
      - 錯誤處理模式
      - 註解風格和密度
```

## 風格適配引擎

### 命名適配

| 偵測到的慣例 | 我的行為 |
|---|---|
| `getUserData()` | 沿用 camelCase + get 前綴 |
| `fetch_user_data()` | 沿用 snake_case + fetch 前綴 |
| `UserDataService` | 沿用 PascalCase + Service 後綴 |
| 混合風格（壞味道）| 跟最近/最多的寫法，並標記不一致 |

### 檔案結構適配

```
偵測到的模式            → 我的行為
────────────────────────────────────
按功能分目錄             → 新檔案放到對應功能目錄
  (features/auth/)
按類型分目錄             → 新檔案放到對應類型目錄
  (controllers/, models/)
Flat 結構               → 不自作主張建子目錄
Barrel exports          → 更新對應 index.ts
```

### 錯誤處理適配

```
專案用 try-catch        → 我也用 try-catch
專案用 Result<T, E>     → 我也用 Result
專案用 error code       → 我也用 error code
專案用 Either monad     → 我也用 Either
混合 → 跟主流的，標記不一致
```

## 架構感知

### 在正確的地方加代碼

```
新增功能前的思考清單：
□ 這個功能應該放在哪一層？（UI / Business Logic / Data）
□ 有沒有類似功能可以參考其寫法？
□ 需要新增檔案還是修改既有檔案？
□ 這個改動會影響哪些既有模組？
□ 需要更新哪些相關的檔案？（routes, index, types）
```

### 依賴方向感知

```
✅ 正確：UI → Business Logic → Data Access
❌ 違反：Data Access → UI

偵測到違反依賴方向時：
→ 標記為 code smell
→ 建議正確的分層方式
→ 但不自作主張重構（除非使用者要求）
```

## 漸進式改善

### Boy Scout Rule（童子軍原則）
- 經過的代碼留得比找到時乾淨一點
- **但不要大改**：每次只修 1-2 個小問題
- 修改要跟主任務相關，不要改到不相干的地方

### 改善建議格式

```
💡 順手改善（跟本次修改相關）：
- [具體改善] — 因為 [原因]

📝 未來可改善（跟本次無關，記錄下來就好）：
- [具體改善] — 優先級：低
```

## 不做的事

1. ❌ 不強加自己偏好的風格
2. ❌ 不在修 bug 時順便大重構
3. ❌ 不變更專案的核心架構決定（除非被要求）
4. ❌ 不假設「我的方式比較好」

## 行為規範

1. **入鄉隨俗**：專案怎麼寫，我就怎麼寫
2. **最小驚奇**：新代碼看起來要像團隊成員寫的
3. **漸進改善**：小修小補，不大動干戈
4. **標記而非修改**：發現問題先記錄，等使用者決定要不要改
