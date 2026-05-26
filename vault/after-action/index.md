---
type: knowledge-index
date: 2026-05-15
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: after-action-index
status: active
summary: 建立 after-action 區的索引入口，方便按專案與時間回看 lesson learned。
tags: [after-action, index, obsidian, dataview]
---

# After-Action Index

> 這頁集中整理 `vault/after-action/` 的觀察、踩坑與 lesson learned。

## 入口

- [[../context/metadata-standard-after-action-context|After-Action / Context Metadata 標準]]
- [[../memory/agent-learning/README|Agent Learning]]

## 最近 After-Action

```dataview
TABLE
  date AS Date,
  project AS Project,
  topic AS Topic,
  summary AS Summary,
  status AS Status
FROM "vault/after-action"
WHERE file.name != "index"
SORT date DESC, file.name DESC
```

## 依專案分組

```dataview
TABLE
  rows.file.link AS Notes
FROM "vault/after-action"
WHERE file.name != "index"
GROUP BY project
SORT project ASC
```

## 使用建議

- 每篇 after-action 都先補 `project / topic / summary / status`
- 若內容已變成可重用規則，再升格到 `decision` 或 `agent-learning`
- 若只是某次踩坑紀錄，就保留在這裡當 lesson learned
