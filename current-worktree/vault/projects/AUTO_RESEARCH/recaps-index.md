---
type: project-index
date: 2026-05-15
status: draft
tags: [auto-research, recap, index]
---

# Auto Research Recaps Index

> 這頁把相關專案的 recap 投影出來，原始檔依專案與月份存放在 `vault/memory/recaps/<專案或母體>/<YYYY-MM>/`。

## 入口

- [[index]]
- [[../../context/recap-organization-plan|Recap 整理計畫]]
- [[../../context/recap-normalization-backlog|Recap 正規化待辦]]

## Auto Research Recaps

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
  contains(lower(file.name), "auto-research")
  OR contains(lower(string(tags)), "auto-research")
  OR contains(lower(string(tags)), "manual-scoring")
  OR contains(lower(string(tags)), "sast")
  OR project = "AUTO_RESEARCH" 
)
SORT file.name DESC
```

## 使用建議

- SAST、manual scoring 與 Auto Research MVP 類主題會集中在這裡。
