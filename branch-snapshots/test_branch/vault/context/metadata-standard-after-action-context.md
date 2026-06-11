---
type: implementation-plan
date: 2026-05-15
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: metadata-standard-after-action-context
status: draft
summary: 定義 after-action 與 context 區的共同 metadata 骨架與各自專屬欄位，讓 Obsidian 與 second-brain 可穩定檢索。
tags: [pixiucore, vault, metadata, after-action, context, standardization]
---

# After-Action 與 Context Metadata 標準草案

## 目標

這份草案定義 `vault/after-action/` 與 `vault/context/` 的最小一致化規則。目的不是把不同筆記硬壓成同一種文件，而是讓：

- Obsidian properties 可一致顯示
- second-brain 可穩定吃到可篩選的 metadata
- 後續 Dataview / Qdrant / project views 能用共同欄位過濾

## 共同核心欄位

這兩區都建議至少具備：

- `type`
- `date`
- `project`
- `system`
- `repo`
- `topic`
- `status`
- `summary`
- `tags`

## After-Action 標準

### 建議 type

- `after-action`

### 建議 status

- `done`
- `needs-follow-up`
- `archived`

### 可選專屬欄位

- `incident`
- `lesson`
- `action_items`
- `evidence_paths`

### 最小範例

```yaml
---
type: after-action
date: 2026-05-15
project: DOCX_TOOLING
system: PIXIUCORE
repo: Playground
topic: docx-powershell-encoding
status: done
summary: 記錄 PowerShell 管線造成中文 DOCX 編碼污染的根因與後續標準修法。
tags: [docx, encoding, powershell, after-action]
---
```

## Context 標準

### 建議 type

- `implementation-plan`
- `context-note`
- `reference-context`
- `inventory`

### 建議 status

- `draft`
- `active`
- `reference`
- `done`
- `paused`

### 可選專屬欄位

- `sources`
- `related_decisions`
- `related_notes`
- `owner`
- `scope`
- `next_step`
- `readAt`
- `applyTo`

### 最小範例

```yaml
---
type: implementation-plan
date: 2026-05-15
project: SECOND_BRAIN
system: SECOND_BRAIN
repo: second-brain
topic: n8n-phase-1-second-brain-plan
status: draft
summary: Phase 1 先建立 n8n 第二大腦最小閉環，不在本階段引入完整 knowledge graph 或外部向量平台。
tags: [n8n, second-brain, implementation-plan]
related_decisions: vault/memory/decisions/2026-05-11-n8n第二大腦與VectorDatabase實作計劃.md
---
```

## 分流原則

- `after-action`：聚焦踩坑、修正、lesson learned，不承載長期規劃。
- `context`：聚焦草案、inventory、背景脈絡、參考筆記，不直接等同 accepted decision。
- `recap`：保留事件流。
- `decision`：保留已採納規則。

## 同步提醒

由於 second-brain 目前掃描整個 `vault/**/*.md`，所以 `after-action` 與 `context` 的 frontmatter 一致化後，也應重產 manifest 並重建索引，避免舊 metadata 與新 metadata 混在同一批向量裡。
