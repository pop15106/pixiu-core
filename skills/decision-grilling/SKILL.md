---
name: decision-grilling
description: Pixiu 原生需求決策釐清 primitive。當需求模糊、存在高影響決策、spec/PRD/goal workflow 有 unresolved blocker，或需要把未知事項分成可查 Fact 與真正 User Decision 時使用。先查事實，再依 Decision Ledger Frontier 一次問一個最高優先問題；未完成 Shared Understanding Gate 前不進 implementation。
---

# Decision Grilling

## 目的

把模糊需求轉成可追蹤 Decision Ledger。這是 reusable primitive，不是自動寫 spec、派 agent 或實作的入口。

## 必讀來源

- `vault/governance/decision-ledger-standard.md`
- `vault/governance/source-of-truth-map.md`
- `vault/schemas/decision-ledger.schema.json`

## Resolver

未知事項先分類：

- `FACT`：Repo、文件、環境可查。先查，不問使用者。
- `USER_DECISION`：使用者有權拍板。提出一題與明確建議。
- `EXPERIENTIAL`：需 prototype 或實際操作才能判斷。先提出驗證方案並取得必要授權。
- `EXTERNAL_EXPERT`：權威答案在 SA、PM 或外部單位。交給 `to-questionnaire`。
- `MANUAL_ACTION`：需人在 dashboard、憑證或實體環境操作。產人工步驟。

## 核心流程

1. 讀目前需求與已指定正式來源。
2. 建立或更新 Decision Ledger；有 active spec 時正式位置是 `specs/active/<spec>/decisions.json`。
3. 無 active spec 時，`grill-me` 保持 Session-only；其他 workflow 只有在已獲寫入授權時才可使用 `.scratch/<topic>/decisions.json`。
4. 先解 `FACT`，記錄 evidence 與 source path。
5. 依 standard 計算 Frontier。
6. 預設只選 Frontier 第一題。
7. 問題必須含 Decision ID、為何現在要問、建議答案與理由。
8. 使用者回答後更新 resolution/rationale/approval，再重算 Frontier。
9. 新事實或新答案推翻既有決策時 reopen；保留 history，不覆蓋舊結論。
10. Frontier 清空後執行 Shared Understanding Gate。
11. Gate 通過後只回報可進下一階段；實際寫入、派工、implementation、commit、push 仍需各自符合 Pixiu 授權規則。

## 單題規則

預設一次只問一個主問題。只有使用者明示 `--batch`，才能同輪提出同一 Frontier 中彼此沒有 dependency 的多題。

## 問題格式

```markdown
❓ **D-003｜第一版租戶模型**

目前要決定第一版使用單租戶或多租戶。這會影響資料隔離、權限模型與測試範圍。

➡️ **建議：** 第一版採單租戶。先完成核心流程，再以 ADR 保留多租戶擴充條件。

請選擇：
1. 單租戶
2. 多租戶
3. 需要先看 prototype 或資料模型
```

## 硬規則

- 不問已在 repo、spec、ADR、CONTEXT 或目前對話明確回答的內容。
- 不代替使用者回答 `USER_DECISION`。
- 推薦答案不等於使用者批准。
- 沒有使用者授權時不寫正式來源、不派 agent、不進 implementation。
- Frontier 為空不代表自動進下一階段。
- 不用「看情況」當推薦；推薦需附理由與 trade-off。

## 完成條件

- Frontier 為空。
- P0/P1 已 resolved、deferred 或 out-of-scope。
- FACT 有 evidence。
- conflict 已處理。
- 沒有孤立 blocker。
- 使用者明確確認 shared understanding。
