---
type: session-recap
date: 2026-05-26
project: PCLMS_AP
system: PCLMS
repo: PCLMS_AP
topic: pclms-ap-cssave-codegraph-flow
status: done
tags: [recap, pclms, pclms-ap, codegraph, cssave, servlet-flow]
source_paths:
  - C:/Users/7010/Desktop/gravityTest/PCLMS_AP/JAVA/pclms_mvn/src/main/java/servlet/CSsave.java
  - C:/Users/7010/Desktop/gravityTest/PCLMS_AP/JAVA/pclms_mvn/src/main/webapp/WEB-INF/web.xml
  - C:/Users/7010/Desktop/gravityTest/pixiu-core/vault/projects/gravityTest/04_code-analysis/PCLMS_AP-analysis.md
summary: 本次用 CodeGraph 與 repo 證據確認 CSsave 是 PCLMS_AP legacy servlet 流程的一個入口，最短追查鏈為 web.xml mapping -> CSsave.doGet -> request/session binding -> SQL -> commit/rollback -> warehse/userinf/userbondno/ctmcode。
---

# Session Recap：PCLMS_AP CSsave CodeGraph 流程定位

> 日期：2026-05-26 15:39
> 專案：PCLMS_AP
> AI：Codex

## 觸發與背景

使用者在 IDE 開啟 `PCLMS_AP/JAVA/pclms_mvn/src/main/java/servlet/CSsave.java`，先要求執行：

```text
codegraph query CSsave.java
codegraph context "這個 repo 的主要流程"
```

後續要求 `recap`，因此依 PixiuCore recap 標準寫入本交接紀錄。

## 結論

- `codegraph query CSsave.java` 只命中檔案層級：`JAVA/pclms_mvn/src/main/java/servlet/CSsave.java:1`。
- 改跑 `codegraph query CSsave` 後可看到符號層級：`CSsave` class、`init`、`doPost`、`doGet`、`destroy`、`logger`、`apCtx`。
- 原始 `codegraph context "這個 repo 的主要流程"` 命中偏歪，回到 `clmsmenu.js:reposition()`，不適合代表 PCLMS_AP 主流程。
- 用較貼近本 repo 型態的查詢 `PCLMS_AP legacy servlet web.xml request session SQL transaction main flow CSsave` 後，CodeGraph 命中 `CSsave`、`Wsession`、`Main`，並帶出共同基底 `HttpServletJXGB`。
- 綜合 repo 與 vault analysis lead，PCLMS_AP 主流程不是單純 Spring controller，而是 legacy servlet 為主：

```text
web.xml mapping -> servlet -> request/session -> SQL -> transaction -> table side effect
```

## 證據與流程

### CodeGraph 結果

`codegraph query CSsave` 回傳：

```text
class CSsave
JAVA/pclms_mvn/src/main/java/servlet/CSsave.java:47

method init
JAVA/pclms_mvn/src/main/java/servlet/CSsave.java:51

method doPost
JAVA/pclms_mvn/src/main/java/servlet/CSsave.java:55

method doGet
JAVA/pclms_mvn/src/main/java/servlet/CSsave.java:59

method destroy
JAVA/pclms_mvn/src/main/java/servlet/CSsave.java:627
```

`codegraph context "PCLMS_AP legacy servlet web.xml request session SQL transaction main flow CSsave"` 回傳的 entry points：

```text
CSsave - JAVA/pclms_mvn/src/main/java/servlet/CSsave.java:47
session - JAVA/pclms_mvn/src/main/java/servlet/Wsession.java:1
Main - JAVA/pclms_mvn/src/main/java/servlet/Main.java:44
```

相關 symbols 包含：

```text
HttpServletJXGB
CSsave.init / CSsave.doPost / CSsave.doGet / CSsave.destroy
Main.init / Main.doPost / Main.doGet / Main.destroy
```

### `web.xml` 入口

`WEB-INF/web.xml` 將 servlet name `cssave` 對到 class `servlet.CSsave`，URL 是 `/servlet/CSsave`：

```xml
<servlet-name>cssave</servlet-name>
<servlet-class>servlet.CSsave</servlet-class>

<servlet-mapping>
  <servlet-name>cssave</servlet-name>
  <url-pattern>/servlet/CSsave</url-pattern>
</servlet-mapping>
```

### `CSsave` servlet 行為

`CSsave` 繼承 `HttpServletJXGB`，`doPost()` 直接轉呼叫 `doGet()`。

`doGet()` 先建立 session：

```java
HttpSession session = req.getSession(true);
```

接著讀取 request 參數，包含：

```text
type, newbondid, bondno, bondpw, bondname, customsoffice, status,
activedate, chargedate, enddate, tel, complexity, changeTime,
lockTime, otp, email, mustChange, csrfToken, billFlag
```

checkbox 類欄位在 Java 端轉換：

```text
complexity: on -> Y, else N
otp: on -> Y, else N
mustChange: on -> newAcc=Y, else newAcc=N
billFlag: on -> Y, else N
email: null -> ""
```

也會讀取 session 值：

```text
BondID, Authority, Right, TempType, lantype, csrfToken
```

### DB 與 transaction

`CSsave` 使用 `DbFactory.open()` 取得 connection，進入新增資料區段後設定：

```java
con.setAutoCommit(false);
```

主要資料表 side effect：

- `warehse`：新增倉庫/業者資料，包含 `email`, `newacc`, `BILL_FLAG`。
- `userinf`：新增使用者資料，包含 `email`, `newacc`。
- `userbondno`：新增使用者與 `bondno` 對應。
- `ctmcode`：當 `type=7` 時更新 `ctmid`。

成功時：

```java
con.commit();
```

SQL exception 時：

```java
con.rollback();
```

因此 `CSsave` 的最短追查鏈可以固定成：

```text
web.xml /servlet/CSsave
-> CSsave.doGet()
-> request/session binding
-> INSERT/UPDATE SQL
-> commit/rollback
-> warehse / userinf / userbondno / ctmcode
```

## 已做變更

- 新增本 recap 檔：
  - `C:/Users/7010/Desktop/gravityTest/pixiu-core/vault/memory/recaps/2026-05-26-153900-pclms-ap-cssave-codegraph-flow.md`
- 未修改 `PCLMS_AP` repo 原始碼。

## 驗證

已執行並檢查：

- `codegraph query CSsave.java`
- `codegraph query CSsave`
- `codegraph context "這個 repo 的主要流程"`
- `codegraph context "PCLMS_AP legacy servlet web.xml request session SQL transaction main flow CSsave"`
- `rg` / line read 驗證 `web.xml` 中 `/servlet/CSsave` mapping。
- line read 驗證 `CSsave.java` 的 request/session binding、SQL insert/update、`commit()` / `rollback()`。

尚未執行 Maven build 或測試，因本次工作是唯讀 tracing 與 recap 寫入。

## 下一步

- [ ] 若要繼續追 CS 使用者維護完整 UI 到 DB flow，建議沿 `CSlist` / `CSdisplay*` / `CSsave` / `CSupdate` / `csrecord.js` 串起來。
- [ ] 若問題聚焦 `email` 或 `BILL_FLAG`，先驗證 list/display 的欄位順序與 request binding，再判斷 save/update SQL。

## 備註

本次 second-brain / memory lead 只作為方向；最終流程以目前 repo 的 `web.xml`、`CSsave.java` 與 CodeGraph 查詢結果為證據。

---

*依 [[pixiu-session-recap]] 與 [[recap-standard]] 產出。*
