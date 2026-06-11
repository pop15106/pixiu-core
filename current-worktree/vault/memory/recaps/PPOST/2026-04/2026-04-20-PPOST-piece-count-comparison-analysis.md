---
type: session-recap
date: 2026-04-20
project: PPOST
system: PPOST
repo: PPOST
topic: piece-count-comparison-analysis
status: done
tags: [recap, ppost, piece-count, logic-analysis]
summary: 分析 PPOST 出口進倉件數比對的兩個阻擋點，釐清 Query 與 SaveEXE 的差異。
---

# Recap: PPOST 出口進倉件數比對邏輯分析

## 發生現象
使用者回報截圖顯示：`申報件數：3448` 與 `郵包貨物清單件數：3448` 相同，系統卻報「件數比對不符」。

---

## 系統中存在兩個比對點

### 比對點 A — Query() 載入時（L455，警示性詢問）
```csharp
// frmOpExpGCIO.cs L455-457
else if (Int32.Parse(MasterDataRow["PIECE"].ToString()) != _hwbDt.Rows.Count)
{
    DialogResult result = MessageBox.Show(String.Format(
        "申報件數：{0}，郵包貨物清單件數：{1}，是否要人工確認進倉",
        MasterDataRow["PIECE"].ToString(), _hwbDt.Rows.Count), "", MessageBoxButtons.YesNo);
}
```
- 觸發時機：使用者輸入 HWB 查詢後，系統自動執行
- 行為：**詢問式（YesNo）**，使用者可選擇繼續

### 比對點 B — SaveEXE() 確認進倉時（L1456，硬擋）
```csharp
// frmOpExpGCIO.cs L1456-1459
_DeclNoHwbDt = da.ReadByDeclNo(MasterDataRow["DECLNO"].ToString(), _whArea);
if (Int32.Parse(MasterDataRow["PIECE"].ToString()) != _DeclNoHwbDt.Rows.Count)
{
    MessageBox.Show(String.Format(
        "申報件數：{0}，此報單明細件數：{1}，件數比對不符，請人工調整確認",
        MasterDataRow["PIECE"].ToString(), _DeclNoHwbDt.Rows.Count));
    return;  // 直接中斷，無法進倉
}
```
- 觸發時機：使用者按下「進倉確認」按鈕時
- 行為：**強制中斷（return）**，無法繞過

---

## 各欄位完整來源追蹤

### `MasterDataRow`（主資料列）
| 項目     | 說明                                                          |
| ------ | ----------------------------------------------------------- |
| 來源方法   | `Query()` L291：`da.ReadByHWB(editHWB.Text.Trim(), _whArea)` |
| 資料表    | `WORKEXPHWB`                                                |
| SQL 條件 | `WHERE HWB = @HWB AND WHAREA = @WHAREA`                     |
| 意義     | 使用者輸入的那筆 **分提單（HWB）記錄**                                     |

### `{0}` 申報件數 — `MasterDataRow["PIECE"]`
| 項目     | 說明                               |
| ------ | -------------------------------- |
| 資料表.欄位 | `WORKEXPHWB.PIECE`               |
| 意義     | 此 HWB 所屬報單的**申報總件數**（寫在 HWB 記錄上） |
| 注意     | 同一報單下所有 HWB 共用此值                 |

### `{1}（舊 BUG 版）` — `_hwbDt.Rows.Count`（顯示錯誤）
| 項目     | 說明                                                    |     |
| ------ | ----------------------------------------------------- | --- |
| 來源方法   | `combDgvHWBList()` L1693：`da.ReadByMWB(mwb, _whArea)` |     |
| 資料表    | `WORKEXPHWB`                                          |     |
| SQL 條件 | `WHERE MWB = @MWB AND WHAREA = @WHAREA`               |     |
| 意義     | **主提單（MWB）** 下的全部 HWB 筆數（**跨報單**）                     |     |
| 問題根因   | 一個 MWB 可對應多張報單，此筆數範圍過大，與比對邏輯不一致                       |     |

### `{1}（修正後）` — `_DeclNoHwbDt.Rows.Count`（正確）
| 項目     | 說明                                                                               |
| ------ | -------------------------------------------------------------------------------- |
| 來源方法   | `SaveEXE()` L1455：`da.ReadByDeclNo(MasterDataRow["DECLNO"].ToString(), _whArea)` |
| 資料表    | `WORKEXPHWB`                                                                     |
| SQL 條件 | `WHERE DECLNO = @DECLNO AND WHAREA = @WHAREA`                                    |
| 意義     | **同一報單（DECLNO）** 下的全部 HWB 筆數（**同報單範圍**）                                          |
| 正確原因   | 與比對邏輯使用相同的 DECLNO 範圍，數值一致                                                        |

---

## Bug 還原情境

```
[使用者情境]
  MWB 下共有 3448 筆 HWB（跨多張報單）
  其中某張報單（DECLNO=X）的申報件數 PIECE = 3448

[Bug 發生流程]
  比對邏輯：PIECE (3448) != _DeclNoHwbDt.Rows.Count (例如 2000) → 觸發錯誤 ✗
  訊息顯示：{0}=3448, {1}=_hwbDt.Rows.Count=3448（剛好等於 PIECE）
  → 使用者看到「申報件數：3448，郵包貨物清單件數：3448，件數比對不符」
  → 明明顯示相同，卻說不符，造成困惑
```

---

## 修正現況 (2026-04-20)
- ✅ 比對邏輯（L1456）：原本即使用 `_DeclNoHwbDt.Rows.Count`，無需修改
- ✅ 訊息顯示（L1458）：已將 `_hwbDt.Rows.Count` 修正為 `_DeclNoHwbDt.Rows.Count`
- ✅ 訊息文字已由「郵包貨物清單件數」改為「此報單明細件數」，語意更精確

## 待執行事項
- [x] 邏輯分析完成
- [x] 資料來源追蹤完成
- [x] Bug 還原情境確認
- [ ] 執行最終程式碼測試並確認無誤後結案


## 根因分析 (Root Cause)
- **檔案路徑**：`<workspace-root>\PPOST\post\TradeVan.POST.MnuGCIO\frmOpExpGCIO.cs`
- **關鍵程式碼** (Line 1456-1458)：
  ```csharp
  if (Int32.Parse(MasterDataRow["PIECE"].ToString()) != _DeclNoHwbDt.Rows.Count)
  {
      MessageBox.Show(String.Format("申報件數：{0}，此報單明細件數：{1}，件數比對不符...", 
          MasterDataRow["PIECE"].ToString(), 
          _DeclNoHwbDt.Rows.Count)); 
  }
  ```

## 資料來源驗證
1. **申報件數 (`MasterDataRow["PIECE"]`)**：
   - 來源於報單主檔（Master），代表該報單定義的總件數。
2. **此報單明細件數 (`_DeclNoHwbDt.Rows.Count`)**：
   - 由 `WORKEXPHWBDA.ReadByDeclNo()` 撈取。
   - 執行 SQL：`SELECT * FROM WORKEXPHWB WHERE DECLNO = @DECLNO AND WHAREA = @WHAREA`。
   - 代表資料庫明細檔中，實際掛在該報單號碼下的分分單筆數。

## 修正現況 (2026-04-20)
- 已確認 `frmOpExpGCIO.cs` 中的訊息顯示變數已修正為 `_DeclNoHwbDt.Rows.Count`（原為錯誤的 `_hwbDt.Rows.Count`）。
- 邏輯比對一致性已達成，訊息顯示數值將與比對基準同步。

## 待執行事項
- [x] 邏輯分析完成
- [x] 資料來源驗證完成
- [ ] 執行最終程式碼檢查並確認無誤後結案。
