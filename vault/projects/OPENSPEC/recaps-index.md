---

type: project-index

date: 2026-05-15

status: draft

tags: [openspec, recap, index]

---



# OpenSpec Recaps Index



> 這頁把相關專案的 recap 投影出來，原始檔依專案與月份存放在 `vault/memory/recaps/<專案或母體>/<YYYY-MM>/`。


## 入口



- [[index]]

- [[../../context/recap-organization-plan|Recap 整理計畫]]

- [[../../context/recap-normalization-backlog|Recap 正規化待辦]]



## OpenSpec / Spec Improve Recaps



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

  contains(lower(file.name), "openspec")

  OR contains(lower(file.name), "spec-improve")

  OR contains(lower(string(tags)), "openspec")

  OR contains(lower(string(tags)), "spec")

  OR project = "OPENSPEC"

)

SORT file.name DESC

```



## 使用建議



- OpenSpec 與 Spec Improve 相關 recap 可先集中在同一頁。
