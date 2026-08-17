---
disable-model-invocation: true
name: to-questionnaire
description: 將無法由 repo 或使用者直接權威回答的 Decision 轉成可交給 SA、PM、外部單位或 domain expert 的問卷。輸出背景、Decision ID、選項、各答案影響與回收同步方式；預設只輸出內容，不寫檔。
---

# To Questionnaire

## 適用情境

- 業務規則只能由 SA、PM 或外部單位確認。
- 使用者沒有權限替 domain owner 拍板。
- Repo、文件與可用工具找不到 authoritative fact。

## 輸出格式

每份 questionnaire 必須包含：

1. 對象／角色。
2. 必要背景，避免要求對方自行重建 context。
3. 需要回答的 Decision ID。
4. 問題與選項；能用封閉選項時優先封閉選項。
5. 每個答案對 spec、scope、風險或 implementation 的影響。
6. 回覆期限欄位。
7. 回收後同步到 Decision Ledger 的欄位與步驟。

## 規則

- 不把 recommendation 當成 expert 已回答。
- 不暴露 secret、token、PII 或不必要內部資訊。
- 對外內容只帶回答問題需要的最小 context。
- 回覆收回後需標 evidence/source，再由 Decision Ledger workflow 更新狀態。
- 預設零寫入；只有使用者明確要求產檔才交給相應寫入流程。
