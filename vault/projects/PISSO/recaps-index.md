---
type: project-index
date: 2026-05-15
status: draft
tags: [pisso, recap, index]
---

# PISSO Recaps Index

> 這頁把相關專案的 recap 投影出來，原始檔仍維持放在 `vault/memory/recaps`。

## 入口

- [[index]]
- [[../../context/recap-organization-plan|Recap 整理計畫]]
- [[../../context/recap-normalization-backlog|Recap 正規化待辦]]

## PISSO / PSAAB / TV_ISSO_API Recaps

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
  contains(lower(file.name), "pisso")
  OR contains(lower(string(tags)), "pisso")
  OR contains(lower(string(tags)), "psaab")
  OR contains(lower(string(tags)), "tv-isso-api")
  OR project = "PISSO"
  OR system = "PISSO" 
)
SORT file.name DESC
```

## 使用建議

- PISSO 相關 recap 常橫跨 PSAAB 與 TV_ISSO_API。
