# PCLMS_AP 程式碼分析

> 專案：`PCLMS_AP`
> 路徑：`%GRAVITYTEST_ROOT%\PCLMS_AP`
> 階段：Phase 04 Code Analysis
> 狀態：第一輪分析完成
> 更新日期：2026-05-13
> 範圍：唯讀分析；本次未執行 build / test

---

## 摘要

`PCLMS_AP` 是保稅稽核系統的 AP / Web 層。它是舊式 Java Web 應用，實際可執行模組在 `JAVA/pclms_mvn`，以 WAR 打包；專案根目錄的 `pom.xml` 則主要是 Maven parent / aggregator。

這個專案不能只從 Spring service 角度分析。核心業務大多在 `web.xml` 註冊的 legacy servlet 裡，Jersey REST 只佔很小一部分。因此後續追問題時，主線應該是：`web.xml mapping -> servlet -> request/session -> SQL -> transaction -> table side effect`。

本輪確認到最重要的風險區，是庫存核銷的交易一致性。AP 會在多個 servlet 路徑中新增或修改 `outdetail`、調整 `indetail.balance`、寫 log，接著呼叫 `clearStore.procout(...)`。部分路徑在呼叫 `clearStore` 前已經先 commit，所以若 `clearStore` 失敗，必須從整條流程檢查資料漂移，而不能只看單一 method。

---

## 專案結構

| 項目 | 結論 |
|---|---|
| 根專案 | `%GRAVITYTEST_ROOT%\PCLMS_AP\pom.xml` |
| 根 artifact | `com.tradevan.pclms:pclms-web-parent` |
| 根 packaging | `pom` |
| 實際 WAR module | `JAVA/pclms_mvn` |
| WAR artifact | `pclms_web` |
| WAR packaging | `war` |
| Java 版本 | Java 8 |
| 啟動資訊 | README 指出 AP 可用 `clean compile tomcat:run -e` |
| 共用函式庫 | 依賴 `PCLMS_LIBS_new` 的 `com.tradevan.clms:pclms-lib:0.0.1-SNAPSHOT` |

重要路徑：

- `%GRAVITYTEST_ROOT%\PCLMS_AP\pom.xml`
- `%GRAVITYTEST_ROOT%\PCLMS_AP\JAVA\pclms_mvn\pom.xml`
- `%GRAVITYTEST_ROOT%\PCLMS_AP\JAVA\pclms_mvn\src\main\webapp\WEB-INF\web.xml`
- `%GRAVITYTEST_ROOT%\PCLMS_AP\JAVA\pclms_mvn\src\main\java`

---

## 技術快照

| 層面 | 結論 |
|---|---|
| Web 架構 | Legacy Servlet / JSP 為主，少量 Jersey REST |
| Spring | Spring 3.2.15 |
| Servlet API | 2.5 |
| JSP API | 2.0 |
| REST | Jersey 2，掛在 `/rest/*` |
| 資料庫 | Oracle，搭配 Tradevan DB / XDAO 相關 library |
| Logging | 使用 Log4j2 相關 bridge / library |
| Tradevan library | `tv-framework`、`tv-xdao`、`tv-easy`、`tv-commons`、`tv-logging-core` |

---

## 規模與入口點

本輪在目前 working tree 量到的數字如下：

| 區域 | 數量 / 結論 |
|---|---:|
| `src/main/java` Java 檔 | 601 |
| `src/main/webapp` JSP 檔 | 4 |
| `JAVA/pclms_mvn` XML 檔 | 17 |
| `web.xml` servlet 數量 | 435 |
| `web.xml` servlet mapping 數量 | 434 |
| filter 數量 | 8 |
| listener 數量 | 3 |
| 主要 route 型態 | `/servlet/*` |
| Jersey REST mapping | `/rest/*` |

主要 Java package 目錄：

- `clms`
- `com`
- `common`
- `components`
- `model`
- `restful`
- `service`
- `servlet`

---

## REST 介面

REST 面積不大。系統透過 `MyApplication` 註冊 Jersey package，主要 controller 如下：

| Controller | 主要用途 |
|---|---|
| `JobController` | Job 相關 GET endpoint，例如 `/oxAPS/{actoin}`、`/kill/{doc}`、`/query/{id}` |
| `KaohsiungController` | 高雄相關整合 POST endpoint，例如 `WSTOL`、`WSDECL`、`WSIN`、`WSOT`、`WSW1`、`WSPRD`、`WSUNCHECK`、recvlog 查詢 |
| `SecurityController` | 安全輔助 endpoint，例如 `GET_DES_KEY`、`GET_ACCESS_CODE` |

`MyApplication` 類別註冊了 `restful`、`restful.exceptionmapper`、exception mapper、logging、Jackson 等相關套件。

---

## Servlet 業務分群

AP 是 servlet-heavy 的系統。依 servlet 名稱與 mapping 做第一輪分群後，得到以下大致地圖：

| 分群 | 約略 mapping 數 | 說明 |
|---|---:|---|
| 出入倉 / 庫存 | 115 | `chkInDetail*`、`chkOutDetail*`、`clearAllOut`、`clearStore`、`Goods*`、`Stock*` |
| 報單 / 放行 | 84 | `AddDecl*`、`RlsDeclareConfirmItemsUpdate`、`RlsDeclar*`、`UnRls*` |
| 加工 / 報廢 / 測試 / BOM | 68 | `Work*`、`RlsWork*`、`Scrap*`、`RlsScrap*`、`Test*`、`BOM*` |
| 月報 / 彙報 | 42 | `CatMonth*`、`listCatMonth*`、`RlsCatMonth*`、`CancelMonth` |
| 其他 / 待分 | 40 | 後續需逐條 route 補分 |
| 登入 / 權限 / 基本資料 | 34 | Login、倉別、使用者、設定類功能 |
| 報表 / 匯出 / 紀錄 | 28 | 報表、匯出、操作紀錄、log 查詢 |
| 保證金 | 23 | `Grnt*`、`Check_*_grntitem`、`Guaranty` |

---

## 核心流程分析

### 1. 月報 / 彙報流程

既有 vault / recap 對月報流程的方向是有幫助的，本輪已用 AP 程式碼做過對照。

主要月報流程：

```text
CatInMonth
  -> CatMonthresult
  -> CatMonthSave / CatMonthBatchSave
  -> listCatMonth
  -> listCatMonthSele
  -> listCatMonthSave
```

月報退回 / rollback 相關流程：

```text
RlsCatMonth
  -> RlsCatMonthresult
  -> RlsCatMonthitem
  -> RlsCatMonth_Return
```

已確認行為：

- `CatMonthSave` 與 `CatMonthBatchSave` 會新增 `month`。
- 這兩支會更新 `indetail.monthno` 與 `outdetail.monthno`。
- 這些流程有明確 commit / rollback。
- `listCatMonthSave` 會設定 `declar.iconfirmed = 'Y'`。
- `listCatMonthSave` 還會更新 `outdetail`、`indetail`、`grntitem`、`testitem`、`workitem` 等多張表。
- `RlsCatMonth_Return` 是偏反向的月報退回流程。
- `CancelMonth` 會刪除 `month`、清空 `indetail/outdetail.monthno`、把 `DECLNO` 設回 `refbillno`，並處理 commit / rollback。

重要判斷：

- 月報不是單純報表或匯出功能，它會實際改動報單確認狀態與多張明細表。
- 後續若要修月報資料，必須先查出實際 touched rows，不能只憑畫面名稱判斷。

### 2. 庫存核銷 / `clearStore`

`clearStore.java` 是庫存核銷核心。

已確認行為：

- 內含 static synchronized 的 `procout` 變體與 `procout2`。
- 會更新 `indetail.balance` 與 `outdetail.outstatus`。
- 涉及狀態包含 `OS10`、`OS09`、`OS07`、`OS08`、`OS12`。
- 內部有 commit / rollback，失敗路徑會寫 `errlog`。
- 部分 caller 在呼叫 `clearStore.procout(...)` 前，已經先 commit 自己的變更。

重要 caller：

| Caller | 行為 / 風險 |
|---|---|
| `chkOutDetailaddSave` | 新增 `outdetail` 後先 commit，再寫 log 並呼叫 `clearStore.procout(...)`。這是重要交易邊界風險。 |
| `chkOutDetailcheck` | 若原狀態為 `OS10`，會先補回 `indetail.balance`、commit，再呼叫 `clearStore.procout(...)`。 |
| `chkOutDetaildel` | 刪除 `outdetail`；若原狀態為 `OS10`，會補回 `indetail.balance`，再 commit / rollback。 |
| `clearAllOut` | 找出尚未 `OS10` 的 `outdetail`，逐筆呼叫 `clearStore.procout(...)`。 |
| `RlsDeclareConfirmItemsUpdate` | 新增 `OutDetail`、多次 commit、呼叫 `clearStore.procout(...)`，並更新 `declar.iconfirmed='Y'`。 |

主要風險：

- 如果 caller 已經 commit `outdetail`，但 `clearStore` 後續失敗，`outdetail` 與 `indetail.balance` 可能產生漂移。
- 查庫存問題時，必須一起看 `outdetail.outstatus`、`indetail.balance`、`errlog`、來源 servlet path。

### 3. 報單 / 放行

重要 route family：

- `AddDecl*`
- `RlsDeclareConfirmItemsUpdate`
- `RlsDeclar*`
- `UnRls*`

已確認模式：

- AP 負責報單資料的新增、修改、確認與放行相關操作。
- 放行 / 確認路徑可能產生 `OutDetail`，並呼叫庫存核銷。
- 放行流程與 `clearStore` 的資料副作用高度重疊，後續分析不可分開看。

### 4. 加工 / 報廢 / 測試 / BOM

重要 route family：

- `Work*`
- `RlsWork*`
- `Scrap*`
- `RlsScrap*`
- `Test*`
- `BOM*`

第一輪判斷：

- 這些是獨立業務切片，但仍共享 AP 的基本型態：servlet 入口、Oracle SQL 更新、共用表與 log。
- 若要深入，應等到有具體 bug、畫面或資料案例時，再做 vertical slice tracing。

---

## 與其他 PCLMS 專案的關係

| 關聯專案 | 關係 |
|---|---|
| `PCLMS_LIBS_new` | AP 依賴 `pclms-lib`。當 AP 使用共用 PO / DAO / service / XDAO helper 時，必須回頭看 LIBS。 |
| `PCLMS_BK_new` | BK 預期處理 batch / JMS / SCT message flow，可能碰到同一批報單、庫存、recv/send log、保證金資料表。AP/BK 要在月報、放行、庫存、IOG、message processing 上交叉比對。 |
| `PCLMS_FD` | 前端 / client layer 尚未分析。不能假設 AP JSP 已涵蓋全部使用者行為。 |

---

## 後續分析建議

PCLMS 群組建議順序：

1. 先分析 `PCLMS_BK_new`，把 SCT / shell job 對到 Java entry class。
2. 對照 BK message processing、IOG、grnt check 與 AP 共用表：`declar`、`decldetail`、`indetail`、`outdetail`、`grntitem`、`month`、`recvlog`、`sendlog`、`errlog`。
3. 再分析 `PCLMS_LIBS_new`，因為 AP/BK call site 先看完後，LIBS 的 PO / DAO / service 才能判斷實際用途。
4. 最後分析 `PCLMS_FD`，把 UI/API 意圖接回 AP/BK 流程。

AP 單點追問題時，建議用這條 vertical slice：

```text
web.xml mapping
  -> servlet class
  -> request parameters / session values
  -> SQL and transaction boundary
  -> touched tables
  -> related BK or LIBS side effects
```

---

## 待釐清問題

- 哪些 AP servlet route 仍在正式環境使用，哪些只是 legacy / dead mapping？
- 哪些 transaction boundary 是歷史 DB 行為刻意保留，哪些是事故風險？
- BK 是否會修復 AP 造成的 `outdetail` / `indetail` 漂移，或只是透過 IOG 類流程檢查出來？
- `PCLMS_FD` 或外部系統實際呼叫了哪些高風險 AP 流程？

---

## 驗證備註

本文件根據本輪直接讀取 repository 的結果，加上既有 vault / recap 線索整理而成。分析期間沒有修改 AP 原始碼，也沒有執行 Maven build 或自動化測試。
