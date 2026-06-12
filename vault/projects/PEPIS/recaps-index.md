---

type: project-index

date: 2026-05-15

status: draft

tags: [pepis, recap, index]

---



# PEPIS Recaps Index



> 這頁把相關專案的 recap 投影出來，原始檔依專案與月份存放在 `vault/memory/recaps/<專案或母體>/<YYYY-MM>/`。



## 入口



- [[index]]

- [[../../context/recap-organization-plan|Recap 整理計畫]]

- [[../../context/recap-normalization-backlog|Recap 正規化待辦]]



## PEPIS / CCPS Recaps



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

  contains(lower(file.name), "pepis")

  OR contains(lower(string(tags)), "pepis")

  OR contains(lower(string(tags)), "ccps")

  OR project = "PEPIS"

  OR project = "pepis_ap"

  OR repo = "pepis_ap"

  OR system = "PEPIS" 

)

SORT file.name DESC

```



## 使用建議



- 這裡會集中 login、eDDA、payment service apply 等 PEPIS 主題 recap。

- 若之後拆出子系統，可再另外建立對應的 project note。
