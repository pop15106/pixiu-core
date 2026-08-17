---
disable-model-invocation: true
name: grill-with-docs
description: 使用者主動啟動的文件型決策訪談。先用 decision-grilling 收斂決策，再用 domain-modeling 產 CONTEXT.md 或 ADR patch proposal；proposal-only，不直接修改正式文件。
---

# Grill With Docs

## 流程

1. 顯式載入 `decision-grilling`。
2. 釐清 Decision Ledger，先查 FACT，再問 USER_DECISION。
3. Shared Understanding Gate 通過後載入 `domain-modeling`。
4. 產 glossary patch proposal 與 ADR patch proposal；兩者分開顯示。
5. 使用者核准後，才交給具有正式寫入權限的 workflow 套用。

## ADR 提案條件

三項全部成立才提出：

1. 決策難以逆轉。
2. 未來讀者沒有背景時會感到意外。
3. 存在真實 trade-off。

## 硬規則

- 不直接修改 `CONTEXT.md`、ADR、spec 或 Vault。
- 不在訪談期間邊問邊寫正式來源。
- External expert 缺口轉 `to-questionnaire`。
- glossary 與 ADR 不混成同一 patch。
- 未核准前 workspace 正式來源保持不變。
