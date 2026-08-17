---
type: governance
date: 2026-08-14
project: PIXIUCORE
system: PIXIUCORE
topic: source-of-truth-map
status: active
tags: [pixiucore, governance, source-of-truth, decisions, specs]
summary: 定義 PixiuCore 的唯一正式來源，避免 spec、ADR、Recap、Vault、Tracker 與發佈層形成可編輯副本。
---

# Source of Truth Map

## 核心規則

同一項正式資訊只能有一個可編輯來源。其他位置只保存 pointer、狀態或 generated view，不複製正文。

| 資訊類型 | 唯一正式來源 | 其他位置規則 |
|---|---|---|
| 使用者長期偏好 | Pixiu Vault | Repo 只放專案必要規則 |
| 母體治理 | `user_rules.md` 與 `vault/governance/` | Skill 與入口只放 pointer |
| Capability 路由 | `vault/capabilities/capability-manifest.json` | 入口不列完整能力清單 |
| Skill 依賴 | `vault/capabilities/skill-dependency-manifest.json` | Skill 只宣告名稱與用途 |
| Domain glossary | 目標 repo 的 `CONTEXT.md` | Vault 只記 pointer |
| Architecture decision | 目標 repo 的 `docs/adr/*.md` | Recap 不複製正文 |
| Feature requirement | `specs/active/<spec>/spec.md` | Issue 只放連結或入口 |
| Implementation plan | `specs/active/<spec>/plan.md` | Recap 不複製正文 |
| Execution checklist | 專案選定的 tracker 或 `tasks.md` | 不得同時維護兩套狀態 |
| Decision trace | `specs/active/<spec>/decisions.json` | Markdown summary 只能是 generated view |
| 驗證結果 | `report.md` 或正式 artifact | Recap 只記 pass/fail 與路徑 |
| Session continuity | Pixiu Recap | 只記 pointer、狀態、未解 ID 與下一步 |
| Codex 發佈副本 | `.agents/skills/` | 由 `skills/` 來源同步，不作人工真源 |

## 無 active spec 時

1. Repo 內暫存 Decision Ledger 使用 `.scratch/<topic>/decisions.json`。
2. 非 repo 環境只保留在目前 Session。
3. `grill-me` 不自動建檔。
4. 需要跨 Session 保存時，才走正式 recap、handoff 或轉入 spec。

## 轉入 spec

1. 建立 `specs/active/<spec>/`。
2. Decision Ledger 落位為 `decisions.json`。
3. `spec.md` 的 Acceptance Criteria 引用相關 Decision ID。
4. Recap 只保留 spec 路徑、未解 Decision ID 與下一個入口。

## 防 Shadow State

- 不在 PRD、spec、ADR 與 recap 重複保存完整問答紀錄。
- 不同 tracker 不得同時擁有可編輯執行狀態。
- 發佈層不得比來源層更新；由 linter 驗證。
