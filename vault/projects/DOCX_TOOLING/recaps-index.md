---
type: project-index
date: 2026-05-15
status: draft
tags: [docx, recap, index]
---

# DOCX Tooling Recaps Index

> 這頁把相關專案的 recap 投影出來，原始檔仍維持放在 `vault/memory/recaps`。

## 入口

- [[index]]
- [[../../context/recap-organization-plan|Recap 整理計畫]]
- [[../../context/recap-normalization-backlog|Recap 正規化待辦]]

## DOCX / Validation Recaps

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
  contains(lower(file.name), "docx")
  OR contains(lower(file.name), "cca-f")
  OR contains(lower(string(tags)), "docx")
  OR contains(lower(string(tags)), "validation")
  OR project = "DOCX_TOOLING" 
)
SORT file.name DESC
```

## 使用建議

- DOCX 生成、驗證與版型調整的 recap 會落在這裡。
