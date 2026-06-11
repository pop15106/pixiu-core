---
type: session-recap
date: 2026-05-25
project: PCLMS
system: PCLMS_AP
repo: PCLMS_AP
topic: pclms-ap-announce-system-architecture
status: done
tags: [recap, PCLMS, PCLMS_AP, 公告, announce, 架構調查, sql-injection]
source_paths:
  - c:/Users/7010/Desktop/gravityTest/PCLMS_AP/JAVA/pclms_mvn/src/main/java/servlet/Main.java
  - c:/Users/7010/Desktop/gravityTest/PCLMS_AP/JAVA/pclms_mvn/src/main/java/servlet/Announce.java
summary: 調查 PCLMS_AP 公告系統的維護與顯示機制。公告無前端管理介面，完全靠 DBA 直接操作 ANNOUNCE 資料表；前端 Main.java 撈清單、Announce.java 顯示詳細，均以 JDBC 直查 Oracle，存在 SQL Injection 風險。
---

# Session Recap：PCLMS_AP 公告系統架構調查

> 日期：2026-05-25
> 專案：PCLMS_AP
> AI：Claude Code (Sonnet 4.6)

## 觸發與背景

調查 PCLMS_AP 系統的公告（announce）功能，了解公告是如何維護、如何顯示的。

---

## 架構概覽

```
用戶登入
  ↓
Main.java（Servlet）
  → SELECT publisher, announcedate, title, serialno
    FROM announce
    WHERE isdisplay='Y'
    ORDER BY announcedate DESC
  → 渲染公告清單（HTML table）
  ↓
用戶點擊公告標題（target='_blank' 開新視窗）
  ↓
Announce.java（Servlet）
  → SELECT publisher, announcedate, title, content, url01, url02, url03
    FROM announce
    WHERE serialno='<sno>'
  → 渲染公告詳細頁
```

---

## 主要檔案

| 檔案 | 說明 |
|------|------|
| `servlet/Main.java` | 主頁，撈 `isdisplay='Y'` 的公告清單並渲染成 HTML |
| `servlet/Announce.java` | 詳細頁，接收 `sno`（serialno）與 `count`（列表序號）參數 |
| `WEB-INF/web.xml` | URL mapping：`/servlet/Announce` |

---

## 資料表：ANNOUNCE

| 欄位 | 說明 |
|------|------|
| SERIALNO | 主鍵（流水號），URL 參數 `sno` |
| TITLE | 標題 |
| PUBLISHER | 發布單位 |
| ANNOUNCEDATE | 公告日期（格式：YYYYMMDD 字串，顯示時轉 YYYY-MM-DD） |
| CONTENT | 內文（以 `<pre>` 標籤顯示） |
| URL01 / URL02 / URL03 | 附加連結（最多 3 個） |
| ISDISPLAY | `'Y'` = 顯示；其他 = 隱藏 |

---

## 維護方式

**沒有前端管理介面**，公告完全靠 DBA 或管理員直接操作資料庫：

| 操作 | SQL |
|------|-----|
| 新增公告 | `INSERT INTO announce (...)` |
| 下架公告 | `UPDATE announce SET isdisplay='N' WHERE serialno=xxx` |
| 刪除公告 | `DELETE FROM announce WHERE serialno=xxx` |

---

## 技術特點

- **架構**：Model 1，Servlet 直接以 `out.println()` 產生 HTML，無 JSP 分離
- **資料庫**：Oracle，自製 JDBC 框架（`DbFactory`），無 ORM
- **基類**：`HttpServletJXGB`
- **日期處理**：DB 存 8 碼字串（YYYYMMDD），在 Servlet 轉為 YYYY-MM-DD 顯示

---

## 已知風險

`Announce.java` 約第 78 行，`sno` 直接從 request 參數拼入 SQL：

```java
// 有 SQL Injection 風險
String sql = "... WHERE serialno='" + sno + "' ";
```

應改用 `PreparedStatement`。

---

*依 [[pixiu-session-recap]] 產出。*
