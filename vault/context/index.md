---

type: knowledge-index

date: 2026-05-15

project: PIXIUCORE

system: PIXIUCORE

repo: pixiu-core

topic: context-index

status: active

summary: 建立 context 區總覽，方便整理 implementation plan、inventory 與草案型文件。

tags: [context, index, obsidian, dataview]

---



# Context Index



> 這頁集中整理 `vault/context/` 的規劃稿、盤點、inventory 與過渡文件。



## 入口



- [[metadata-standard-after-action-context|After-Action / Context Metadata 標準]]

- [[agent-learning-ingestion-plan|Agent Learning 撰寫流程]]

- [[decision-normalization-status|Decision 正規化狀態]]

- [[recap-organization-plan|Recap 整理計畫]]



## Context 總覽



```dataview

TABLE

  type AS Type,

  date AS Date,

  project AS Project,

  topic AS Topic,

  summary AS Summary,

  status AS Status

FROM "vault/context"

WHERE file.name != "index"

SORT date DESC, file.name ASC

```



## 依類型分組



```dataview

TABLE

  rows.file.link AS Notes

FROM "vault/context"

WHERE file.name != "index"

GROUP BY type

SORT type ASC

```



## 依專案分組



```dataview

TABLE

  rows.file.link AS Notes

FROM "vault/context"

WHERE file.name != "index"

GROUP BY project

SORT project ASC

```



## 使用建議



- 規劃稿用 `type: implementation-plan`

- 參考背景用 `type: reference-context`

- inventory / 盤點用 `type: inventory`

- 還沒定案的內容留在這裡，不要太早升格成 decision
