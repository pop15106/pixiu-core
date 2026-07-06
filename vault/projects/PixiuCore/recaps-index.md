---

type: project-index

date: 2026-05-15

status: draft

tags: [pixiucore, recap, index]

---



# PixiuCore Recaps Index



> 這頁把相關專案的 recap 投影出來，原始檔依專案與月份存放在 `vault/memory/recaps/<專案或母體>/<YYYY-MM>/`。


## 入口



- [[index]]

- [[../../context/recap-organization-plan|Recap 整理計畫]]

- [[../../context/recap-normalization-backlog|Recap 正規化待辦]]



## PixiuCore / 母體治理 Recaps



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

  contains(file.name, "PixiuCore")

  OR contains(lower(string(tags)), "pixiucore")

  OR project = "PIXIUCORE"

  OR project = "PixiuCore"

  OR system = "PIXIUCORE"

  OR repo = "pixiu-core"

)

SORT file.name DESC

```



## 使用建議



- 母體治理、README、vault 結構與同步相關 recap 會集中在這裡。

- 若內容已成固定規則，下一步應升格到 `memory/decisions`。
