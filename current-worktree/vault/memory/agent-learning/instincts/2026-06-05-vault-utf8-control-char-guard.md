---
type: agent-instinct
date: 2026-06-05
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: vault-utf8-control-char-guard
status: active
summary: 整理 vault Markdown 時，先用 UTF-8 明確讀寫並掃描不可見控制字元，避免路徑、命令與 frontmatter 被污染後再進入 second-brain。
tags: [agent-learning, instinct, vault, utf-8, markdown, frontmatter, second-brain]
confidence: high
supporting_observations:
  - 2026-04-27-docx-powershell-encoding
  - 2026-05-15-dashboard-dataview-encoding-guardrails
  - 2026-06-05-vault-cleanup-audit
contradicting_observations: []
---

# Instinct - Vault UTF-8 與控制字元防呆

## Trigger

當任務涉及：

- 批次整理 vault Markdown
- 修改 frontmatter
- 從 PowerShell / Python / 文件產生流程帶入中文
- 要重建 second-brain 索引前的資料清潔

## First Move

1. 讀寫都明確使用 UTF-8。
2. 不用 PowerShell pipe / here-string 傳大段中文給 `python -`。
3. 批次寫回前先限縮白名單；寫回後掃描 `[\x00-\x08\x0B\x0C\x0E-\x1F]`。
4. 若發現 `vault`、`view`、`tools`、`rg` 等字被吃掉，先修原文，再讓 second-brain 重新索引。

## Rationale

不可見控制字元會讓 Obsidian 顯示看似正常但內容其實失真，第二腦索引也會把污染文字吃進去。資料品質要排在資料夾重排與 Dashboard 美化之前。

## Boundaries

- 單篇純英文小修不一定需要完整掃描。
- 若只讀不寫，可以先用 `rg` 或 PowerShell 唯讀掃描，不必產生新檔。

## Evidence Base

- `vault/after-action/2026-04-27-docx-powershell-encoding.md`
- `vault/after-action/2026-05-15-dashboard-dataview-encoding-guardrails.md`
- 本次 2026-06-05 掃描發現 4 份 Markdown、11 行控制字元污染。

## Promotion Rule

若後續 vault 維護仍出現控制字元或中文 frontmatter 污染，升格成 `vault/sop/vault-maintenance-checklist.md` 的必跑步驟。
