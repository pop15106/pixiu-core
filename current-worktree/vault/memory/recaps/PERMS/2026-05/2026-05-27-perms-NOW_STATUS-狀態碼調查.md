---
type: recap
date: 2026-05-27
project: perms
system: PERMS
repo: perms
topic: NOW_STATUS-狀態碼調查
status: partially-confirmed
tags: [perms, apply-main, now-status, status-code, 作廢, 999]
summary: 調查 APPLY_MAIN.NOW_STATUS 各值的含義，確認 '999' = 作廢，其餘值由外部系統決定，repo 本身不主動寫入 '999'。
---

# PERMS NOW_STATUS 狀態碼調查

## 背景

用戶詢問 `APPLY_MAIN.NOW_STATUS = '999'` 及 `'2'` 的業務含義，並追查哪段程式碼在什麼情況下寫入 `'999'`。

## 確認結果

### `'999'` = 作廢（已確認）

來源：[AM004_銷情報表_流程分析.md](../../../../../Desktop/gravityTest/perms/AM004_銷情報表_流程分析.md)，明確標注：

```sql
AND  A.NOW_STATUS != '999'  ← ✅ 排除作廢
```

整個 codebase 對 `'999'` 的唯一用途是**讀取過濾**，從未有任何地方主動寫入 `'999'`。

### `'2'` 及其他數字值（無法從 codebase 確認）

`NOW_STATUS` 的數字值由**外部系統（POS 退稅機）透過 REST API 傳入**，程式碼只被動接收：

```java
model.setNowStatus(MapUtils.getString(map, "nowStatus",""));
```

狀態碼定義在外部 PTRS/PERMS 系統規格書，不在此 repo。

常見台灣退稅系統慣例（僅供參考，未從 code 確認）：

| 值 | 推測含義 |
|----|---------|
| `0` | 已申請（初始） |
| `1` | 已出境 |
| `2` | 已退稅（完成） |
| `9` | 例外 / 退件 |
| `999` | 作廢 |

## '999' 的寫入來源調查

### 此 repo 內：無

- Java Action / Service / Controller 中，完全沒有 `setNowStatus("999")` 的呼叫。
- Mapper XML 中，`'999'` 只出現在 `WHERE` 條件，不在 `INSERT`/`UPDATE`。

### 可能來源

1. **外部 POS 退稅機** — 透過 REST API `POST` 時在 payload 帶入 `nowStatus: "999"`
2. **DB Procedure** — repo 本身沒有呼叫 APPLY_MAIN 相關的 procedure（只有 `SPC_RPT_AM005` 是報表用），但 DB 端可能有排程 procedure

### 建議查法

```sql
-- 查 DB2 中哪支 procedure 有寫入 APPLY_MAIN 且涉及 999
SELECT ROUTINENAME, TEXT
FROM SYSCAT.ROUTINES
WHERE ROUTINESCHEMA = 'PERMSMGR'
  AND TEXT LIKE '%APPLY_MAIN%'
  AND TEXT LIKE '%999%'
```

或直接觀察資料分佈：

```sql
SELECT NOW_STATUS, COUNT(*), MIN(NOW_STATUS_DATE), MAX(NOW_STATUS_DATE)
FROM PERMSMGR.APPLY_MAIN
GROUP BY NOW_STATUS
ORDER BY NOW_STATUS
```

## 結論

| 問題 | 答案 |
|------|------|
| `'999'` 是什麼 | 作廢（confirmed） |
| `'2'` 是什麼 | 無法從 repo 確認，需查外部規格或 DB |
| 誰寫入 `'999'` | 外部 POS 端或 DB procedure，此 repo 不寫入 |
| 查寫入來源 | 需查 DB procedure 或外部 client 端程式碼 |
