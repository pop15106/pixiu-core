---
name: domain-modeling
description: Pixiu proposal-only domain vocabulary primitive。當需求、spec、ADR 或程式中出現模糊詞、同義詞衝突、boundary 不清或需要建立 CONTEXT.md glossary 時使用。先用具體 scenario 與 code evidence 壓測定義，只產 patch proposal，不直接修改正式來源。
---

# Domain Modeling

## 目的

建立一致的 domain vocabulary，而不把暫時理解直接寫進正式文件。

## 流程

1. 收集需求、既有 `CONTEXT.md`、相關 code、spec 與 ADR 中的核心名詞。
2. 找出同名異義、異名同義、邊界模糊與缺少 non-example 的詞。
3. 以具體 scenario 驗證定義，並用 code path 檢查說法是否符合現況。
4. 產生 `CONTEXT.md` patch proposal；顯示新增、修改、刪除內容與理由。
5. 只有下列三項同時成立才提出 ADR proposal：難以逆轉、未來讀者會感到意外、存在真實 trade-off。
6. 等使用者核准後，交回具有寫入權限的 workflow 套用。

## CONTEXT.md 內容邊界

只放：

- Canonical term
- Definition
- Boundaries
- Examples / non-examples

不放 implementation plan、task progress、臨時筆記、API payload、版本紀錄或 Session 摘要。

## 硬規則

- proposal-only；不直接寫 `CONTEXT.md` 或 ADR。
- 不能用猜測補 domain rule。
- Repo code、正式 spec、ADR 與權威文件優先於記憶摘要。
- 若定義需要外部權威回答，轉 `to-questionnaire`。
