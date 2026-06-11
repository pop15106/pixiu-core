---
type: session-recap
date: 2026-04-29
project: AUTO_RESEARCH
system: PIXIUCORE
repo: pixiu-auto-research
topic: sast-triage-rules
status: done
tags: [recap, session, pixiucore, auto-research, sast, triage]
summary: 定義 Auto Research 的 SAST triage 規則，整理篩選、判讀與後續處理原則。
---

# Session Recap：Pixiu Auto Research SAST triage 規則

## 🎯 任務目標與背景

使用者在完成 CSV 掃描摘要後，要求由 Codex 補上 SAST triage。目標是在不接 API、不做完整 deterministic evaluator 的前提下，先產生保守的 triage 規則，讓 candidate 不只列出 CSV 摘要，還能提供優先級、處置建議、優先複核項目與 dedupe 群組。

## ✅ 本次完成

1. 在 `src/core/dataset.mjs` 加入 SAST triage 規則。
2. 依 CSV 欄位 `結果的嚴重性`、`查詢之名稱`、`原始碼檔名`、`原始碼行數`、`目的物件` 產生 triage。
3. 新增輸出：優先級分布、處置分布、優先複核項目、Dedupe 群組 Top。
4. 保守規則：嚴重一律 P0；高或安全敏感中風險為 P1；低風險 P3；資訊 P4 降權但不刪除。
5. 已同步到 `<workspace-root>\pixiu-auto-research`。
6. 已用使用者 CSV 產出測試 candidate：`run-20260429-121707`，驗證結果包含 P0/P1/P3/P4 分布、Stored_XSS P0、CSRF P1、Dynamic_SQL_Queries dedupe 群組。
7. 已更新 `執行說明.md`，加入 triage 規則說明。

## 🔄 進行中

目前步驟：SAST triage MVP 已完成，等待使用者用 Codex 手動評分新 candidate，並視結果回填 scorecard / registry。

整體進度：1 / 1 Phase 完成。

卡點：目前 triage 仍是規則型保守分類，尚未比對 golden set，因此不是最終風險判定。

## 📐 當前規劃完整內容

目前 triage 規則：

| 優先級 | 條件 | 處置 |
|--------|------|------|
| P0 | 嚴重 | keep_high_priority |
| P1 | 高，或中風險且屬安全敏感 query | manual_review |
| P2 | 一般中風險 | group_review |
| P3 | 低風險 | dedupe_then_review |
| P4 | 資訊 | downrank_summary |

安全敏感 query：
- Dynamic_SQL_Queries
- SQL_Injection
- Stored_XSS
- Reflected_XSS
- CSRF
- Reliance_On_Untrusted_Inputs_In_Security_Decision

Dedupe key：

```text
查詢之名稱 | 原始碼檔名 | 目的物件
```

## 🎯 重要決策（含棄選方案）

| 決策點 | 選擇 | 棄選方案 | 原因 |
|--------|------|---------|------|
| triage 策略 | 保守規則型 triage | 直接 AI 判斷誤報 | 目前沒有 API 與 golden set，需避免主觀判斷 |
| 資訊級處理 | 降權但保留群組摘要 | 直接刪除 | 避免漏掉集中型風險或資料流線索 |
| 中風險敏感 query | P1 人工複核 | 全部當普通中風險 | CSRF、Dynamic SQL 等仍可能有實質風險 |

## ⚠️ 發現的問題 / 踩坑

- CSV 欄位可能有 UTF-8 BOM，輸出欄位時會看到第一欄前方帶不可見字元；目前不影響 triage，但後續可補 normalize。
- Dynamic_SQL_Queries 在 CSV 中嚴重性多為資訊，但數量集中，不能直接刪除，只能先降權並保留 dedupe 群組。

## 📌 下次 session 要做的事

優先執行：
- [ ] 將 `run-20260429-121707` 的 candidate 交給 Codex 評分。
- [ ] 依評分結果使用 `record-score` 回填。
- [ ] 若評分可接受，補 deterministic evaluator 的第一個規則：必要欄位存在與 triage count 檢查。

待確認：
- [ ] 是否要把 P1/P4 的分級規則調得更嚴或更鬆。
- [ ] 是否要把 `資訊` 級 Dynamic_SQL_Queries 升到 P2，而不是 P4。

## 💾 關鍵狀態

- 專案：`<workspace-root>\pixiu-auto-research`
- 已驗證 run：`run-20260429-121707`
- 主要修改檔案：`src/core/dataset.mjs`、`執行說明.md`
- 尚未 commit：未檢查，目標資料夾不是 git repo