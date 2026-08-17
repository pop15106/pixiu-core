---
name: diagnosing-bugs
description: 系統化 bug 診斷 primitive。當需要重現症狀、建立 red-capable feedback loop、最小化案例、提出可證偽 hypothesis、instrument、建立 regression test 並確認 root cause 時使用。Legacy Java 先由 legacy-java-flow-tracing 找 active code path，再進本流程。
---

# Diagnosing Bugs

## 與 Legacy Trace 的分工

```text
legacy-java-flow-tracing
→ 找 active code path、資料流、SQL／Procedure 與 runtime evidence

diagnosing-bugs
→ red feedback loop → minimize → hypothesis → instrument → regression → fix → verify
```

## 流程

### Phase 1｜Red-capable command

先建立能穩定抓到「使用者原始症狀」的命令、測試、SQL 查核或可重播步驟。沒有 red-capable loop 時，不宣稱 root cause。

### Phase 2｜重現與最小化

縮小到最少輸入、最短路徑、最小資料集。保留原始 repro 以避免只修到縮小案例。

### Phase 3｜Hypothesis

列出 3–5 個可證偽假設。每個假設寫：預期證據、反證、最小驗證方式。一次只改一個變數。

### Phase 4｜Instrumentation

只加能區分假設的最小 instrumentation。Debug tag 必須唯一；secret、token、PII 先 redact。

### Phase 5｜Regression first

能建立自動測試時，先寫能重現原始症狀的 regression test，再改 production code。若沒有可用 test seam，明確記錄架構限制與替代驗證。

### Phase 6｜Fix and verify

1. 做最小修正。
2. 跑 regression。
3. 重跑原始 repro。
4. 跑受影響範圍驗證。
5. 移除所有 temporary instrumentation。
6. 產 root cause、修正點、證據與剩餘風險。

## Legacy Java Evidence Ladder

依序優先：

1. SQL／查詢結果
2. Log／stack trace
3. Service method test
4. DAO／mapper test
5. Integration test
6. Request replay
7. 最小測試資料
8. 必要時人工驗證腳本

## 硬規則

- Repo、log、SQL、測試是最終 evidence；memory 只作線索。
- 沒重現就不猜 root cause。
- Debug instrumentation 完成前必須清掉。
- 修改 production code 仍受目前任務的寫入授權與最小變更規則約束。
