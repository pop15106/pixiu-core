---
type: session-recap
date: 2026-04-20
project: PCLMS_AP
system: PCLMS
repo: PCLMS_AP
topic: reported-month-sheet-no-data-bug
status: follow-up
tags: [recap, session, pclms, bug, java]
summary: 診斷 PCLMS_AP 已申報彙報單點入無資料的 bug，確認 month 表頭與 indetail/outdetail 明細脫鉤。
---

# Session Recap：PCLMS_AP 已申報彙報單無資料 Bug 診斷

> **日期**：2026-04-20
> **專案**：PCLMS_AP
> **AI**：Claude Code

---

## 問題描述

從「已申報彙報單清表」點擊彙報單號，進入明細頁後出現「此查詢條件下無資料！」。

---

## 診斷過程

### 流程追蹤

1. **清表**：`RlsCatMonthresult.java` — 查詢 `month` 表，點擊彙報單號產生連結至 `RlsCatMonthitem`
2. **明細頁**：`RlsCatMonthitem.java:153-161` — 依 `bondno + monthno` 查詢 `indetail` 或 `outdetail`
3. **結果**：`count <= 0` → 顯示「此查詢條件下無資料！」

### 確認資料狀態

| 表 | 狀態 |
|----|------|
| `month` | 有資料 ✓ |
| `indetail` / `outdetail`（`monthno` 欄位） | 無對應資料 ✗ |

---

## 根本原因

**`CatMonthSave.java:262`** — 彙整時寫入 `monthno` 的邏輯有靜默失敗問題：

```java
stmt.executeUpdate(sqlstore);  // UPDATE 0 筆不拋例外
itemcount++;                   // 但 itemcount 仍然 +1
```

### 問題時序

```
UPDATE indetail SET monthno='...'
  → 找不到 refbillno/item/inpost 對應資料列
  → 影響 0 筆，不拋例外
  → itemcount 照樣 +1

INSERT INTO month(...)
  → 成功寫入

monthcount == itemcount → COMMIT
  → month 表有資料 ✓
  → indetail.monthno 未更新 ✗
```

---

## 修復方案（待實作）

在 `CatMonthSave.java:262` 驗證 `executeUpdate` 回傳值：

```java
int updatedRows = stmt.executeUpdate(sqlstore);
if (updatedRows == 0) {
    buffer1.append("<p>參考單號:" + drefbillno + "項次:" + ditem + " 找不到對應明細，無法回寫彙報單號，請檢查!<p>");
    itemcount--;  // 讓 monthcount != itemcount，觸發 rollback
} else {
    itemcount++;
}
```

### 效果
- UPDATE 0 筆 → `monthcount != itemcount` → `con.rollback()` → 兩表都不寫入
- 使用者收到明確錯誤訊息，不會產生資料不一致

---

## 待辦

- [ ] 實作上述修改並測試
