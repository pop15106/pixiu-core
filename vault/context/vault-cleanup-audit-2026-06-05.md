---
type: context-note
date: 2026-06-05
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: vault-cleanup-audit-2026-06-05
status: done
summary: 盤點 PixiuCore vault 混亂來源，完成低風險資料品質修正，並新增 sandbox、Git safe.directory、UTF-8 控制字元三條防重踩 instinct。
tags: [pixiucore, vault, cleanup, audit, agent-learning, second-brain]
---

# Vault Cleanup Audit - 2026-06-05

> 2026-06-08 更新：本檔保留 2026-06-05 稽核現況；當時「不搬動 `vault/memory/recaps` 原件」的限制已由後續使用者授權取代。recap 原件現在採 `vault/memory/recaps/<專案或母體>/<YYYY-MM>/YYYY-MM-DD-專案-內容.md`。

## 範圍

本次依使用者授權，只做低風險整理：

- 修正少數 recap frontmatter 欄位。
- 修正已確認的不可見控制字元污染。
- 新增防重踩 agent-learning instinct。
- 不搬動 `vault/memory/recaps` 原件。
- 不修改 `user_rules.md`。
- 不大改 Dashboard Dataview。

## 盤點結果

### 檔案型態

`vault` 主要內容：

- Markdown：整理前 175 份，新增本次稽核與 instinct 後為 179 份。
- DOCX：2 份。
- log：1 份。
- py：1 份。

非 Markdown 雜訊仍集中在：

- `vault/memory/recaps/gen_docx_ppost_piece.py`
- `vault/memory/recaps/2026-04/*.docx`
- `vault/memory/auto-mode-audit.log`

### Recap 狀態

`vault/context/recap-normalization-backlog.md` 的最後狀態仍記錄在 2026-05-15，當時 recap 約 46 份且欄位已補齊。

本次實際掃描時，`vault/memory/recaps` 已有 78 份 Markdown recap，因此 2026-05-15 的「全數具備欄位」已不代表現況。

本次已修正：

- `vault/memory/recaps/2026-06-03-PEPIS-menu-endpoint-調查與log.md`
  - 補 `type/system/repo/topic/summary`
  - 將 `project` 對齊為 `PEPIS`
  - 將 `status` 對齊為 `done`
- `vault/memory/recaps/2026-04-20-母體雙向同步.md`
  - 將舊中文 frontmatter 欄位改為 canonical 英文欄位

### 控制字元污染

本次掃描發現 4 份 Markdown、11 行存在不可見控制字元，會讓路徑或命令失真。

已修正：

- `vault/context/pepis-login-homepage-refactor-recap.md`
- `vault/memory/recaps/2026-06-05-095001-pclms-decltype-t-balance-sa-review.md`
- `vault/memory/recaps/2026-04/2026-04-29-105958-Pixiu-Auto-Research-Manual-Codex-Scoring.md`
- `vault/memory/recaps/2026-05-04-142717-PixiuCore-README更新.md`

修正類型包含：

- `vault` / `view` / `tools` / `api` / `agent` 被控制字元吃掉。
- `npm run`、`rg`、`artifact-tool` 等命令或工具名稱被污染。
- SQL 變數 `v_rinqty`、`v_newbalance` 被污染。

## 防重踩整理

本次新增 3 份 instinct：

- `vault/memory/agent-learning/instincts/2026-06-05-sandbox-second-brain-boundary.md`
- `vault/memory/agent-learning/instincts/2026-06-05-git-safe-directory-boundary.md`
- `vault/memory/agent-learning/instincts/2026-06-05-vault-utf8-control-char-guard.md`

目的不是新增硬規則，而是把近期反覆出現的坑放到可檢索、可升格的位置。

## 仍未處理

本次刻意不處理：

- 搬移 `vault/memory/recaps` 原件。
- 清理或搬移 recaps 內的 DOCX / py 檔。
- 修改 Dashboard Dataview。
- 修改 `user_rules.md`。
- 修改 `skills/pixiu-session-recap/SKILL.md`。
- 統一所有 status 值。
- 修補 `projects/gravityTest` 中尚未建立的 Phase 02/03/05/08/09 連結。

## 後續建議

### Phase A：資料品質

- 針對所有新 recap 增加 frontmatter 檢查。
- 若要批次整理 status，先定一份狀態白名單。
- 重建 second-brain 前，先跑控制字元掃描。

### Phase B：索引與視角

- 保留 recap 原件集中在 `vault/memory/recaps`。
- 專案視角繼續用 `vault/projects/*/recaps-index.md` 投影。
- `projects/gravityTest` 的未完成 Phase 連結要嘛補檔，要嘛在索引明確標示「待建立，不是缺檔」。

### Phase C：升格規則

若 sandbox、Git safe.directory 或 UTF-8 控制字元再次重踩，將對應 instinct 升格為 SOP：

- `vault/sop/second-brain-runtime-checklist.md`
- `vault/sop/pixiucore-git-maintenance.md`
- `vault/sop/vault-maintenance-checklist.md`
