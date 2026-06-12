---

type: project-index

date: 2026-05-15

status: draft

tags: [pclms, recap, index]

---



# PCLMS Recaps Index



> 這頁把相關專案的 recap 投影出來，原始檔依專案與月份存放在 `vault/memory/recaps/<專案或母體>/<YYYY-MM>/`。



## 入口



- [[index]]

- [[../../context/recap-organization-plan|Recap 整理計畫]]

- [[../../context/recap-normalization-backlog|Recap 正規化待辦]]



## PCLMS 相關 Recaps



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

  contains(file.name, "PCLMS")

  OR contains(string(tags), "pclms")

  OR project = "PCLMS"

  OR project = "PCLMS_AP"

  OR project = "PCLMS_BK"

  OR project = "PCLMS_FD"

  OR repo = "PCLMS_AP"

  OR repo = "PCLMS_BK_new"

  OR repo = "PCLMS_FD"

  OR system = "PCLMS" 

)

SORT file.name DESC

```



## 使用建議



- 先用 `project / system / repo / topic / summary` 看 recap 分布。

- 若某主題已重複出現多次，再提煉成正式 project note。

