---
type: recap
date: 2026-05-27
project: perms
system: gravityTest
repo: perms
topic: NOW_STATUS-使用全覽與資料來源流程
status: complete
tags: [perms, now-status, apply-main, ptrs, pos, batch, rest-api, 口徑不一致]
summary: 全面盤點 perms 系統中 NOW_STATUS 的使用位置，並追蹤 nowStatus 的兩條資料來源路徑（排程同步 ptrs_appquery、POS現場開立 ptrs_pos）。
---

# perms — NOW_STATUS 使用全覽與資料來源完整流程

## 背景

本次分析目標：釐清 perms 系統中 `NOW_STATUS` 欄位在哪些地方被使用，以及 `nowStatus` 的值究竟是哪個外部系統給的，用於排查報表筆數口徑不一致問題。

---

## 一、NOW_STATUS 使用全覽

### 模型層欄位定義

`NOW_STATUS` 存在於 4 個 Java 實體：

| 模型 | 欄位 | 資料表 |
|------|------|--------|
| `ApplyMain.java` | `nowStatus` / `nowStatusDate` | `APPLY_MAIN` |
| `ApplyMainTmp.java` | `nowStatus` / `nowStatusDate` | `APPLY_MAIN_TMP` |
| `ApplyDtlFia.java` | `nowStatus` / `nowStatusDate` | `APPLY_DTL_FIA` |
| `ServCompany.java` | `nowStatus` | `SERV_COMPANY` |

### SQL 篩選（業務邏輯核心）

#### APPLY_MAIN — `'999'` = 作廢

| SQL ID | 報表 | 有無排除 `'999'` |
|--------|------|----------------|
| `sel_rpt_001` | AM002 月統計 | ✅ 排除 |
| `sel_rpt_001_02` | AM002 多公司統計 | ✅ 排除 |
| `sel_mg004` | AM004 銷情報表 | ✅ 排除 |
| `sel_mg001_01` | AM001 明細查詢 | ❌ **未排除** |
| `sel_rpt_002/003/004` 系列 | AM003 國籍／月統計 | ❌ **未排除** |

#### SERV_COMPANY — `'Y'` = 服務啟用

`CompanyBillSumMapper.xml` 與 `CompanyBillMainMapper.xml` 查帳單時，以 `NOW_STATUS = 'Y'` 過濾有效公司（`SERV_ID='RPT-CompRptDaily'`）。

### 業務邏輯層（Java 寫入點）

| 類別 | 行號 | 動作 |
|------|------|------|
| `MG001Action` | :174 / :205 / :264 / :289 | `setNowStatus("Y")` — 新增/更新服務介接時預設啟用 |
| `MG015Action` | :193 | `getNowStatusList()` — 提供狀態清單給前端篩選 |
| `PtrsAppQueryServiceImpl` | :411 / :562 | API 回傳 map → 寫入 `ApplyMain` / `ApplyMainTmp` |
| `RestServiceImpl` | :86 / :78 | POS 回傳 map → 寫入 `ApplyMain` |

### 已知問題：口徑不一致

```
AM001 / AM003 → 未加 NOW_STATUS != '999' → 包含作廢單，筆數偏多
AM002 / AM004 → 有加 NOW_STATUS != '999' → 口徑正確
AM005         → 來自 ERMS_DAY_STAT，上游 DO_DAY_STAT 是否排除待確認
```

若要統一，應讓 AM001 / AM003 對齊 AM002 / AM004 的口徑。

---

## 二、nowStatus 資料來源完整流程

> **核心結論：nowStatus 完全來自外部系統，本地端不自行產生值，只做傳遞與寫入。**

### 路徑一：排程同步（PtrsAppQueryServiceImpl）

```
排程觸發 queryTax()
  └─ callRestApi()
       ├─ 帳號密碼：sysSetService.getAuthData()
       ├─ URL：properties ptrsAppQuery.queryTax
       └─ POST 到外籍平台退換貨 API（ptrs_appquery）
            └─ JSON 回傳 → apply_main List，每筆含 "nowStatus"
                 ├─ createApplyMainTmp() → setNowStatus(map.get("nowStatus")) → APPLY_MAIN_TMP
                 └─ createApplyMain()    → setNowStatus(map.get("nowStatus")) → APPLY_MAIN
```

`nowStatus` = **外籍平台退換貨系統（ptrs_appquery）** 的原始值，本地不做任何修改。

### 路徑二：POS 現場開立（RestServiceImpl）

```
前端呼叫 REST API → saveApply()
  └─ callPostApply()
       ├─ POST /ptrs_pos/service/applyMain           → 開立退稅單，取得 taxAppNo
       └─ GET  /ptrs_pos/service/applyMain/{taxAppNo} → 查回完整申請單 JSON
            └─ getApplyMainModel(queryMap)
                 └─ model.setNowStatus(map.get("nowStatus"))  ← POS 給的值
                      └─ commonService.insert → APPLY_MAIN
```

`nowStatus` = **POS 退稅系統（ptrs_pos）** 開立後的申請單狀態，E指購只搬運不決定。

### 兩條路徑對照

| 路徑 | 外部系統 | API | 觸發者 | 寫入目標 |
|------|---------|-----|--------|---------|
| 排程同步 | ptrs_appquery | `ptrsAppQuery.queryTax`（properties） | `PtrsAppQueryServiceImpl.queryTax()` | APPLY_MAIN_TMP → APPLY_MAIN |
| 現場開立 | ptrs_pos | `/ptrs_pos/service/applyMain/{no}` | `RestServiceImpl.callPostApply()` | APPLY_MAIN |

---

## 輸出產物

| 檔案 | 說明 |
|------|------|
| `perms/NOW_STATUS_分析文件.md` | Markdown 原稿 |
| `perms/NOW_STATUS_分析文件.docx` | Word 文件（含表格、程式碼區塊、封面） |

---

## 後續建議

1. **AM001 / AM003** 查詢補上 `AND NOW_STATUS != '999'`，對齊 AM002 口徑。
2. **AM003 Sheet2** `sel_rpt_004_01` 的日期條件目前寫死 `201601`–`201609`，須改為動態參數。
3. 確認 `DO_DAY_STAT` procedure 是否對 `APPLY_MAIN` 使用相同的狀態排除條件，再判斷 AM005 是否需要修正。

---

## 關聯

- [[vault/projects/gravityTest/index]] — gravityTest 系統群總索引
- [[vault/projects/gravityTest/04_code-analysis/perms-NOW_STATUS-analysis]] — 詳細程式碼分析（本次新建）
