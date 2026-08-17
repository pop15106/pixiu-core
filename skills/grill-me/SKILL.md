---
disable-model-invocation: true
name: grill-me
description: 使用者主動啟動的 Pixiu 決策訪談入口。用於「grill me／逼問我／把需求問清楚」等明示請求；依賴 decision-grilling，預設一次一題，維持 stateless、零檔案寫入、零派工、零 implementation。
---

# Grill Me

## 定位

`grill-me` 是 user-invoked stateless wrapper。核心演算法由 `decision-grilling` 提供。

## 使用方式

```text
/grill-me <主題>
/grill-me --focus <主題>
/grill-me --batch <主題>
```

預設等同 `--focus`。

## 流程

1. 顯式載入 `decision-grilling`。
2. Decision Ledger 僅存在目前 Session。
3. 先查可直接取得的 Fact。
4. 預設一次只問 Frontier 第一題。
5. `--batch` 才能提出同一 Frontier 的互不依賴多題。
6. Frontier 清空後執行 Shared Understanding Gate。
7. 結束時只回報結論、未解 Decision ID 與可選下一步。

## 零副作用合約

- 不建立檔案。
- 不修改 workspace。
- 不更新 `CONTEXT.md`、ADR、spec、Vault 或 recap。
- 不派 sub-agent 或 Agent Team。
- 不進 implementation。
- 不自動產 spec。
- 不 commit、不 push。

只有使用者明確要求保存、handoff 或轉 spec，才交給對應 workflow；該 workflow 仍需遵守自己的寫入授權規則。
