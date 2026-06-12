---
type: project-index
date: 2026-05-15
status: draft
tags: [second-brain, recap, index]
---

# Second Brain Recaps Index

> 這頁把相關專案的 recap 投影出來，原始檔依專案與月份存放在 `vault/memory/recaps/<專案或母體>/<YYYY-MM>/`。

## 入口

- [[index]]
- [[../../context/recap-organization-plan|Recap 整理計畫]]
- [[../../context/recap-normalization-backlog|Recap 正規化待辦]]

## Second Brain / n8n / Qdrant Recaps

```dataview
TABLE
  project AS Project,
  system AS System,
  repo AS Repo,
  topic AS Topic,
  summary AS Summary,
  status AS Status
FROM "vault/memory/recaps"
WHERE file.ext = "md"
AND (
  contains(lower(file.name), "second-brain")
  OR contains(lower(file.name), "n8n")
  OR contains(lower(string(tags)), "second-brain")
  OR contains(lower(string(tags)), "n8n")
  OR contains(lower(string(tags)), "qdrant")
  OR contains(lower(string(tags)), "nvidia")
  OR project = "SECOND_BRAIN"
  OR system = "SECOND_BRAIN"
  OR repo = "second-brain" 
)
SORT file.name DESC
```

## 使用建議

- 新寫的 second-brain recap 建議固定 `project: SECOND_BRAIN`。
- deploy、index、query、workflow 類主題可靠 `topic` 進一步分流。
