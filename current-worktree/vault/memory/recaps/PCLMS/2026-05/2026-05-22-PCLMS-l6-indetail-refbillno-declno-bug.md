---
type: session-recap
date: 2026-05-22
project: PCLMS
system: PCLMS_BK
repo: PCLMS_BK_new
topic: pclms-l6-indetail-refbillno-declno-bug
status: fixed
tags: [recap, PCLMS, PCLMS_BK, L6, 移倉, 按月彙報, indetail, refbillno, declno, bug-fix]
source_paths:
  - c:/Users/7010/Desktop/gravityTest/PCLMS_BK_new/JAVA/pclms_bp/src/main/java/com/tradevan/clms/message/process/service/ClmsL6ProcessServiceImpl.java
  - c:/Users/7010/Desktop/gravityTest/PCLMS_LIBS_new/src/main/java/com/tradevan/clms/common/domain/IndetailPo.java
  - c:/Users/7010/Desktop/gravityTest/PCLMS_LIBS_new/src/main/java/com/tradevan/clms/common/domain/ClmsL6T1Po.java
summary: L6 移倉復測，情境四 CASE D（按月彙報，目的儲位不存在，數量全部移，報單已申報）出現「進倉資料不存在」。根因為 getOldIndetailPoByClmsL6T1Po() 對按月彙報情境使用了錯誤的 indetail 欄位（DECLNO/ITEMNO），應為 REFBILLNO/ITEM。已修正為先試 REFBILLNO+ITEM，查無再 fallback DECLNO+ITEMNO。
---

# Session Recap：PCLMS L6 移倉「進倉資料不存在」根因修正

> 日期：2026-05-22
> 專案：PCLMS_BK
> AI：Claude Code (Sonnet 4.6)

## 觸發與背景

- 進行 L6 訊息復測，測試**情境四 PART1（按月彙報，目的儲位不存在）CASE D（數量全部移，報單已申報）**。
- 系統出現錯誤：「進倉資料不存在」。
- 實際查 DB，`indetail` 中以 `refbillno='IS20241001866'` 查確實有資料，資料存在。
- 測試參數：
  - BONDNO：`DD630`
  - REF_BILL_NO：`IS20241001866`
  - CONTROL_NO：`L6.DD630KRQM3806.sdw0295OBIDAJ83N002`
  - INPOST：`A3`（原儲位）
  - ITEM：1–8

## 根本原因

`ClmsL6ProcessServiceImpl.getOldIndetailPoByClmsL6T1Po()` 對 `indetail` 的查詢條件用了**錯誤欄位**：

| 查詢條件 | 程式實際使用（錯） | 按月彙報正確欄位 |
|---------|-----------------|----------------|
| 參考單號 | `DECLNO = 'IS20241001866'` | `REFBILLNO = 'IS20241001866'` |
| 項次 | `ITEMNO = 1` | `ITEM = 1` |

原因說明：
- **一般申報** L6 訊息：`CLMS_L6_T1.REF_BILL_NO` 為**報單號碼**，對應 `indetail.DECLNO`，`ITEM` 為**報單項次**，對應 `indetail.ITEMNO`。→ 原程式邏輯正確。
- **按月彙報** L6 訊息：`CLMS_L6_T1.REF_BILL_NO` 為**倉單號**（如 `IS20241001866`），對應 `indetail.REFBILLNO`；`ITEM` 為**參考項次（倉單項次）**，對應 `indetail.ITEM`。→ 原程式用一般申報欄位查，永遠查無資料。

實際產生的錯誤 SQL：
```sql
-- 錯誤（程式行為）
SELECT * FROM indetail
WHERE BONDNO  = 'DD630'
  AND DECLNO  = 'IS20241001866'   -- 倉單號不在 DECLNO
  AND ITEMNO  = 1                 -- 參考項次不在 ITEMNO
  AND INPOST  = 'A3'
-- → 0 rows → isEmpty=true → "進倉資料不存在"

-- 正確（應查）
SELECT * FROM indetail
WHERE BONDNO     = 'DD630'
  AND REFBILLNO  = 'IS20241001866'
  AND ITEM       = 1
  AND INPOST     = 'A3'
-- → 有資料
```

## 影響範圍

所有**按月彙報情境**的 L6 移倉案件，包含：
- PART1 CASE A/B/C/D（目的儲位不存在）
- PART2 CASE A/B（目的儲位已存在）

全部在第一關 `getOldIndetailPoByClmsL6T1Po()` 被擋住，記重試計數，逾 1 小時設 `I_CONFIRMED='E'`。

## 錯誤訊息產生位置

`ClmsL6ProcessServiceImpl.java` L165–168：

```java
final List<IndetailPo> oldIndetailPos = this.getOldIndetailPoByClmsL6T1Po(doXdaoSession, clmsL6T1Po);
if (CollectionUtils.isEmpty(oldIndetailPos)) {
    this.checkTime(dto, clmsL6T1Po);
    insertL6Log(doXdaoSession, clmsL6T1Po, "進倉資料不存在" + this.getL6PoLog(clmsL6T1Po));
}
```

## 修正內容

**修改檔案**：`ClmsL6ProcessServiceImpl.java` — `getOldIndetailPoByClmsL6T1Po()`

**策略**：先以按月彙報欄位（REFBILLNO + ITEM）查詢，有結果直接返回；查無再 fallback 一般申報欄位（DECLNO + ITEMNO），保留現有正常申報案件行為。

```java
// 修正後
private List<IndetailPo> getOldIndetailPoByClmsL6T1Po(...) {
    // 先以按月彙報欄位查詢（REFBILLNO + ITEM）
    DoSqlWhere<IndetailPo.COLUMNS> doSqlWhere = new DoSqlWhere<>();
    doSqlWhere.add(IndetailPo.COLUMNS.BONDNO,    clmsL6T1Po.getBondno());
    doSqlWhere.add(IndetailPo.COLUMNS.REFBILLNO, clmsL6T1Po.getRefBillNo());
    doSqlWhere.add(IndetailPo.COLUMNS.ITEM,      clmsL6T1Po.getItem());
    doSqlWhere.add(IndetailPo.COLUMNS.INPOST,    clmsL6T1Po.getOilPost());
    List<IndetailPo> result = doXdaoSession.selectPo(IndetailPo.class, doSqlWhere);
    if (!result.isEmpty()) return result;

    // fallback：一般申報欄位（DECLNO + ITEMNO）
    doSqlWhere = new DoSqlWhere<>();
    doSqlWhere.add(IndetailPo.COLUMNS.BONDNO,  clmsL6T1Po.getBondno());
    doSqlWhere.add(IndetailPo.COLUMNS.DECLNO,  clmsL6T1Po.getRefBillNo());
    doSqlWhere.add(IndetailPo.COLUMNS.ITEMNO,  clmsL6T1Po.getItem());
    doSqlWhere.add(IndetailPo.COLUMNS.INPOST,  clmsL6T1Po.getOilPost());
    return doXdaoSession.selectPo(IndetailPo.class, doSqlWhere);
}
```

## 次要問題（不阻斷，已記錄）

1. **Bug 2**：`getDecldetailPoByClmsL6T1Po()` 同樣以 `DECLNO = IS20241001866` 查 `decldetail`，按月彙報必然空。目前設計上是以此識別按月彙報路徑（`decldetailPos.isEmpty()` = true），不阻斷主流程，但會多寫一筆 `L6_FAIL` 到 RECVLOG，可能干擾監控。

2. **Bug 3**：`getDismantleInPostByoldIndetail()` 內部再次呼叫 `getOldIndetailPoByClmsL6T1Po()`。Bug 1 修正後此處自動受益，不需額外修改。

## 正確 Call Flow（修正後，CASE D）

```
processClmsL6T1Po()
  ├─ getOldIndetailPoByClmsL6T1Po()
  │     WHERE REFBILLNO='IS20241001866' AND ITEM=1 AND INPOST='A3'
  │     → 找到資料 ✓
  ├─ getDecldetailPoByClmsL6T1Po()
  │     WHERE DECLNO='IS20241001866' → 空（按月彙報識別用，不阻斷）
  ├─ balance >= qty → execInDetial()
  │     └─ PART1 目的儲位不存在
  │           decldetailPos.isEmpty()=true → getDismantleInPostByoldIndetail() ✓
  │           insert copyOld（新儲位）→ delete oldIndetail ✓
  │           insert MOD_LOG ✓ → IndetailGrntitem() ✓
  └─ insertL6Log("儲位修改成功") ✓
```

## 驗證步驟

- [ ] 用測試案 `CONTROL_NO='L6.DD630KRQM3806.sdw0295OBIDAJ83N002'` 重跑 L6 Process
- [ ] 確認 `CLMS_L6_LOG` 出現「儲位修改成功」
- [ ] 確認 `I_CONFIRMED='Y'`
- [ ] 驗證 CASE C（未申報）、PART2 CASE A/B 也正常
- [ ] 驗證既有一般申報 L6 案件（fallback 路徑）不受影響

## 下一步

- [ ] 重建並部署 PCLMS_BK 至測試環境
- [ ] 執行完整 L6 復測矩陣（情境一至四，所有 CASE）
- [ ] 若確認 Bug 2（RECVLOG 多餘 L6_FAIL）干擾監控，後續再追蹤是否調整

---

*依 [[pixiu-session-recap]] 產出。*
