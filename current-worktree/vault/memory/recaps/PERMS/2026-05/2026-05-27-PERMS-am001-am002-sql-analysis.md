---
type: session-recap
date: 2026-05-27
project: PERMS
system: PERMS
repo: perms
topic: perms-am001-am002-sql-analysis
status: done
tags: [recap, perms, sql, am001, am002, mapper]
source_paths:
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/java/com/tradevan/perms/action/am/AM001Action.java
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/java/com/tradevan/perms/action/am/AM002Action.java
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/resources/mapper/ApplyMainMapper.xml
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/resources/mapper/ApplySignatureMapper.xml
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/resources/mapper/XauthCompanyMapper.xml
summary: 整理 AM001 與 AM002 所有使用的 SQL，展開 MyBatis 動態語法轉為可執行 SQL，並比較兩支功能在查詢粒度、NOW_STATUS 過濾、跨店查詢、日期格式等維度的差異。
---

# Session Recap：PERMS AM001 / AM002 SQL 分析與差異對照

> 日期：2026-05-27
> 專案：PERMS
> AI：Claude Sonnet 4.6

## 觸發與背景

使用者要求列出 AM001 使用的 SQL，再轉換為可直接執行的 SQL，最後比較 AM001 與 AM002 的 SQL 差異。使用 codegraph_context 搜尋符號後，直接讀 Action 與 Mapper XML 追查。

---

## AM001 使用的 SQL

### 1. 主查詢（ApplyMainMapper.sel_mg001_01）

**觸發**：`AM001Action.query()` → `commonService.query(..., "sel_mg001_01", map)`

```sql
SELECT
    TAX_APP_NO, TAX_APP_TYPE, SELLER_ID, TRADE_DATE, NOW_STATUS, NOW_STATUS_DATE,
    PASSPORT_NO, IDN, BIRTH, COUNTRY, ENAME, OUT_DATE, IN_DATE, FLIGHT_NO,
    ST_APPR_DOC_NO, UNV_AMT, BACK_AMT, FEE, REFUND_AMT, RET_MK, CR_DATE,
    CR_USERID, UPD_DATE, UPD_USERID, SEX, AGE_END, AGE_BEGIN, BIOS_ID,
    MAC_ADDRESS, CR_WEB_USER_ID, RPT_LANG, BIRTH_YEAR,
    SUBSTR(PASSPORT_NO, 1, 2)
        || RPAD('', LENGTH(PASSPORT_NO) - 4, '*')
        || SUBSTR(PASSPORT_NO, LENGTH(PASSPORT_NO) - 1) AS PASSPORT_NO_MASK
FROM PERMSMGR.APPLY_MAIN
WHERE 1 = 1
  [AND TAX_APP_NO   = #{taxAppNo}]
  [AND PASSPORT_NO  = #{passportNo}]
  [AND SELLER_ID    = #{sellerId}]   -- compBan 固定帶入
  [AND TRADE_DATE  >= TO_DATE(#{begDateStr}, 'YYYY\MM\DD HH24:MI:SS')]
  [AND TRADE_DATE  <= TO_DATE(#{endDateStr}, 'YYYY\MM\DD HH24:MI:SS')]
ORDER BY CR_DATE DESC
```

重點：護照號中段遮罩；所有條件可選；**無 NOW_STATUS 過濾**；日期精確到秒。

### 2. PDF 下載（ApplySignatureMapper.sel_001）

**觸發**：`AM001Action.displayPdf()` → `commonService.get("ApplySignatureMapper", "sel_001", beanSig)`

```sql
SELECT TAX_APP_NO, CR_DATE, CR_USER, FROM_POS, FILE_CONTENT
FROM PERMSMGR.APPLY_SIGNATURE
WHERE TAX_APP_NO = #{taxAppNo}
ORDER BY CR_DATE DESC
FETCH FIRST 1 ROWS ONLY
```

重點：只取最新一筆 BLOB；直接串流回前端瀏覽器。

---

## AM002 使用的 SQL

### 1. 單店月統計 Sheet1（ApplyMainMapper.sel_rpt_001）

**觸發**：`AM002Action.print()` → `commonService.queryList("ApplyMainMapper", "sel_rpt_001", params)`

```sql
SELECT TO_CHAR(TRADE_DATE, 'YYYYMM') AS C01,
       COUNT(TAX_APP_NO)              AS N01,
       SUM(UNV_AMT)                   AS N02,
       SUM(BACK_AMT)                  AS N03
FROM APPLY_MAIN
WHERE SELLER_ID = #{sellerId}
  AND NOW_STATUS != '999'
  AND TO_CHAR(TRADE_DATE, 'YYYYMM') BETWEEN #{begYm} AND #{endYm}
GROUP BY TO_CHAR(TRADE_DATE, 'YYYYMM')
ORDER BY TO_CHAR(TRADE_DATE, 'YYYYMM')
```

### 2. 遞迴取子店清單（XauthCompanyMapper.selectRecCompany）

**觸發**：僅在登入者是「總店（PARENT_BAN IS NULL）」時執行

```sql
WITH DATA_LIST (LEVEL, COMP_BAN, COMP_NAME) AS (
  SELECT 1, COMP_BAN, COMP_NAME FROM XAUTH_COMPANY WHERE COMP_BAN = #{compBan}
  UNION ALL
  SELECT A.LEVEL+1, B.COMP_BAN, B.COMP_NAME
  FROM XAUTH_COMPANY B, DATA_LIST A WHERE A.COMP_BAN = B.PARENT_BAN
)
SELECT COMP_BAN, DECODE(LEVEL, 2, '-' || COMP_NAME, COMP_NAME) AS COMP_NAME
FROM DATA_LIST
ORDER BY LEVEL
```

### 3. 多店彙總統計 Sheet2（ApplyMainMapper.sel_rpt_001_02）

**觸發**：取得子店清單後才執行

```sql
SELECT A.COMP_BAN, A.COMP_NAME,
       NVL(COUNT(B.TAX_APP_NO), 0) AS N01,
       NVL(SUM(B.UNV_AMT),      0) AS N02,
       NVL(SUM(B.BACK_AMT),     0) AS N03
FROM XAUTH_COMPANY A
LEFT OUTER JOIN APPLY_MAIN B
  ON A.COMP_BAN = B.SELLER_ID
 AND TO_CHAR(B.TRADE_DATE, 'YYYYMM') BETWEEN #{begYm} AND #{endYm}
 AND B.NOW_STATUS != '999'
WHERE A.COMP_BAN IN (子店清單...)
GROUP BY A.PARENT_BAN, A.COMP_BAN, A.COMP_NAME
ORDER BY DECODE(A.PARENT_BAN, NULL, 0, '', 0, A.PARENT_BAN), A.COMP_BAN
```

---

## 關鍵差異對照表

| 差異點 | AM001 | AM002 |
|---|---|---|
| **功能定位** | 逐筆明細查詢 | 月份彙總報表（Excel） |
| **查詢粒度** | 每列一筆申請 | 按 YYYYMM GROUP BY |
| **NOW_STATUS 過濾** | **無**（含 999、NULL） | **有**（排除 999） |
| **護照遮罩** | 有（PASSPORT_NO_MASK） | 無 |
| **跨店查詢** | 無，固定 SELLER_ID | 有，總店可看所有子店（Sheet2） |
| **JOIN 其他表** | 無 | XAUTH_COMPANY（名稱 + 遞迴子店） |
| **日期條件格式** | `YYYY\MM\DD HH24:MI:SS`（秒） | `YYYYMM`（月） |
| **條件必填程度** | 全部可選 | sellerId + 日期範圍必填 |
| **輸出格式** | JSON 清單 + PDF BLOB | Excel（HSSFWorkbook） |

### 筆數差異根因（延伸自 2026-05-26 分析）

- AM001 沒有排除 `NOW_STATUS = '999'`（作廢單），AM002 有。
- Oracle `!= '999'` 不包含 `NOW_STATUS IS NULL`，兩邊都不納入 NULL。
- AM002 若選總店，Sheet2 含所有子店，範圍比 AM001 單店大。

---

## 已做事項

- 展開 MyBatis `<include>` 與動態 `<if>` 為可執行 SQL（含範例值）。
- 完成 AM001 vs AM002 差異對照表。
- Recap 回寫至 `vault/memory/recaps/`。

## 下一步

- [ ] 若要驗證 NOW_STATUS 影響的筆數差，執行：
  ```sql
  SELECT NOW_STATUS, COUNT(*) FROM PERMSMGR.APPLY_MAIN
  WHERE SELLER_ID = '...' AND TO_CHAR(TRADE_DATE,'YYYYMM') BETWEEN '202501' AND '202512'
  GROUP BY NOW_STATUS ORDER BY NOW_STATUS;
  ```

---

*依 [[pixiu-session-recap]] 與 [[recap-standard]] 產出。*
