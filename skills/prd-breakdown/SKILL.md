---
disable-model-invocation: true
name: prd-breakdown
description: 將已確認 PRD 拆成可獨立驗證的 tracer-bullet／vertical-slice tickets。使用 blocker graph 與 Frontier 排序，保留 Decision ID 與 Acceptance Criteria trace；wide refactor 使用 Expand–Migrate–Contract，不把 DB/UI 水平切層偽裝成可交付 ticket。
---

# PRD Breakdown

## 前提

- PRD 的核心問題、Goal、Non-Goal、Constraints 已確認。
- P0/P1 Decision 已有結論或明確 defer。
- 專案已選定一個 execution source of truth。

## 核心方法

- **Tracer Bullet**：每張 ticket 交付一條從入口到可驗證結果的完整行為。
- **Vertical Slice**：以使用者或系統可觀察行為切分，不以 DB、service、UI layer 單獨切票。
- **Blocking Edge**：只記真實前置關係。
- **Frontier**：只包含 unblocked 且可開始的 ticket。
- **Expand–Migrate–Contract**：跨範圍 refactor 先擴充相容面，再批次遷移，最後移除舊面。

## Ticket Contract

每張 ticket 必須有：

- ID 與標題
- 交付的可觀察行為
- Scope
- Acceptance Criteria
- 對應 Decision ID
- blocker
- 驗證方式與 authoritative expected result
- fresh context 能完成所需的最小來源 pointer

## 驗證規則

- 純「改 DB」、「改 API」、「改 UI」不是完整 vertical slice，除非該項本身就是可獨立驗證的最終交付。
- blocker graph 不得有 cycle。
- 每個 ticket 必須能指出完成後如何證明。
- Wide refactor 可以用 Expand／Migrate batch／Contract ticket，不強迫每一步都假裝成使用者功能。

## Tracker Adapter Contract

所有 tracker adapter 使用同一個最小 contract：

- `readState()`：讀取目前 ticket 與 blocker 狀態，不改資料。
- `propose(items)`：把 breakdown 轉成待核准變更集，不直接送出。
- `applyApproved(items)`：只有使用者明確核准後才建立或更新正式 tracker。
- 每個 item 固定欄位：`id`、`title`、`observableBehavior`、`acceptanceCriteria`、`decisionIds`、`blockers`、`verification`、`status`。
- Adapter 不得自行新增 scope、改 Decision resolution 或生成 secret。

目前支援的治理形狀：

1. **Local tasks**：以 `tasks.md` 作唯一可編輯 execution source。
2. **ADO Work Item**：只有 caller 的既有 ADO CLI／認證前置條件可用，且 user 核准 `applyApproved` 後才可建立／更新 Work Item；本 Skill 不新增 PAT、套件或背景同步。

## Source of Truth

每個專案只選一種可編輯執行狀態：

- `tasks.md`
- 一票一檔本地 ticket
- GitHub Issue
- ADO Work Item
- 其他正式 tracker

本 Skill 只產 breakdown proposal；建立或更新正式 tracker 仍需使用者授權。
