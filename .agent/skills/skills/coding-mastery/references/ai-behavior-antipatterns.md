# AI 助理行為反模式

> 本文件記錄 **AI 助理常見的行為錯誤**，而非程式碼品質問題。
> 程式碼品質反模式請見 [antipatterns.md](./antipatterns.md)。

---

## 🔴 類型一：假設業務範圍

**症狀**：使用者說「匯出資料」，AI 沒問就自己決定匯出哪些欄位、格式、範圍。

### ❌ AI 常做的事

```java
// 使用者說「幫我把保證資料匯出」
// AI 直接假設：全部資料、CSV 格式、包含所有欄位
public void exportGrntData() {
    List<Grnt> all = grntDao.findAll();          // 假設匯出全部（隱私問題？）
    writeToCsv("grnt_export.csv", all);          // 假設存成 CSV
    // 假設包含 custId、amount、rate 等所有欄位
}
```

### ✅ 正確行為：先列出假設，再詢問

```
在實作前，我需要確認以下假設：

1. 範圍：匯出全部保證資料，還是特定狀態（如：有效中）？
2. 格式：CSV 下載、Excel、還是 API 回傳 JSON？
3. 欄位：哪些欄位需要匯出？custId 等敏感欄位是否需要脫敏？
4. 量級：資料筆數大概多少？（影響是否需要分頁或背景工作）

最簡單的做法是：新增一個 API endpoint 回傳篩選後的 JSON。
請確認需求後我再實作。
```

**觸發條件**：需求包含「匯出」「查詢」「產生報表」「顯示清單」等模糊動詞時，必須先詢問範圍與格式。

---

## 🔴 類型二：過早抽象

**症狀**：使用者說「新增一個計算利息的功能」，AI 直接建了 Strategy Pattern + Factory + Abstract Class。

### ❌ AI 常做的事

```java
// 使用者只要一個計算利息的函式
public interface InterestStrategy {
    BigDecimal calculate(BigDecimal principal, BigDecimal rate, int days);
}

public class SimpleInterestStrategy implements InterestStrategy { ... }
public class CompoundInterestStrategy implements InterestStrategy { ... }
public class TieredInterestStrategy implements InterestStrategy { ... }

public class InterestStrategyFactory {
    public static InterestStrategy create(String type) { ... }
}

public class InterestCalculatorContext {
    private InterestStrategy strategy;
    // 又 30 行設定程式碼...
}
```

### ✅ 正確行為：最小實作，等需求出現再擴展

```java
/**
 * 計算單利利息。
 * principal: 本金, rate: 年利率(%), days: 天數
 */
public BigDecimal calculateInterest(BigDecimal principal, BigDecimal rate, int days) {
    return principal.multiply(rate)
                    .multiply(BigDecimal.valueOf(days))
                    .divide(BigDecimal.valueOf(36500), 2, RoundingMode.HALF_UP);
}
```

**何時加複雜度**：當實際需求出現第二種計算方式時，再重構。不要為「可能的未來」設計。

---

## 🔴 類型三：風格漂移

**症狀**：使用者說「修正 calcBalance 計算錯誤」，AI 修好 bug 之後順便改了命名、加了 annotation、統一了縮排。

### ❌ AI 常做的事

```diff
- public BigDecimal calcBalance(String custId,String acctNo){
-     BigDecimal bal = dao.getBalance(custId,acctNo);
-     if(bal==null) return BigDecimal.ZERO;
-     return bal;
- }
+ /**
+  * 計算帳戶餘額。
+  *
+  * @param custId 客戶編號
+  * @param acctNo 帳號
+  * @return 帳戶餘額，若無資料回傳零
+  */
+ public BigDecimal calcBalance(String custId, String acctNo) {  // 加空格
+     BigDecimal balance = dao.getBalance(custId, acctNo);        // 改變數名
+     if (balance == null) {                                       // 加大括號
+         return BigDecimal.ZERO;
+     }
+     return balance;
+ }
```

問題：除了 bug fix，改了參數間距、變數命名、Javadoc、if 大括號 —— **使用者沒有要求任何這些**。

### ✅ 正確行為：只動造成 bug 的那幾行

```diff
  public BigDecimal calcBalance(String custId,String acctNo){
-     BigDecimal bal = dao.getBalance(custId,acctNo);
-     if(bal==null) return BigDecimal.ZERO;
-     return bal;
+     BigDecimal bal = dao.getBalance(custId, acctNo);
+     return bal != null ? bal : BigDecimal.ZERO;  // 修正: null check 錯誤
  }
```

**判斷標準**：diff 裡的每一行，都必須能說出「這行改動對應到使用者的哪個需求」。

---

## 🔴 類型四：模糊目標直接執行

**症狀**：使用者說「把查詢速度優化一下」，AI 直接改了 SQL 和加了 cache，沒有定義「優化到什麼程度算成功」。

### ❌ AI 常做的事

```
好的，我來優化查詢速度：
1. 加了 Redis cache
2. 改寫了 3 個 SQL
3. 加了 index

（沒有任何驗證標準，不知道是否真的變快了）
```

### ✅ 正確行為：先定義可驗證的成功標準

```
「優化查詢速度」需要先定義成功標準，才能驗證是否達成：

目前狀況：
- grntList 查詢回應時間：~1200ms（從 log 量測）
- 主要瓶頸：N+1 查詢問題（每筆保證各自查一次擔保品）

建議計畫：
1. 改寫 SQL，用 JOIN 取代 N+1 查詢
   verify: grntList 回應時間 < 300ms，查詢次數從 N+1 降為 1

2. 確認既有功能不受影響
   verify: 現有測試全部通過

要開始嗎？或是你有其他效能目標？
```

**原則**：「優化」「改善」「修好」都是命令式指令。必須轉換為「**達到什麼狀態才算成功**」再執行。

---

## 快速自我檢查清單

在實作前掃描：

| 問題 | 若答案是「不確定」則… |
|------|---------------------|
| 業務範圍是否已確認？（欄位/格式/資料量） | 先詢問，不假設 |
| 這個抽象現在真的需要嗎？ | 先寫最簡版，等需求出現再重構 |
| 我的 diff 有沒有動到使用者沒說要改的行？ | 還原那些行 |
| 我有沒有定義「完成」的驗證標準？ | 先列出 verify 點再開始 |
