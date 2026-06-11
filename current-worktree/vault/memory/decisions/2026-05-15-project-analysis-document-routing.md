---

type: decision

date: 2026-05-15

project: PIXIUCORE

system: PIXIUCORE

repo: pixiu-core

topic: project-analysis-document-routing

status: accepted

decision: 專案分析文件落位規則

choice: 專案分析文件固定寫到 `vault/projects/<Project>/analysis/`，`vault/projects/` 只保留總表與入口頁。

alternative: 持續將專案分析混放在 `vault/context/` 或依當次工作隨機落位。

reason: 專案深度分析會長期累積，若與跨專案規劃、母體治理文件混放，會讓檢索、維護與 second-brain 命中品質一起下降。

summary: 後續針對 gravityTest 下 repo 做架構、API、資料流、表與參數分析時，正式分析文件固定落在 `projects/<Project>/analysis/`。

tags: [decision, pixiucore, projects, analysis, routing]

---



# 專案分析文件落位規則



## 決策



後續若針對 `gravityTest` 下的 repo 進行深度或廣度分析，分析來源可以在 `gravityTest/<repo>`，但正式分析產物固定落在：



`vault/projects/<Project>/analysis/`



`vault/projects/` 這一層只保留：



- 專案總表

- 專案入口頁

- 分析進度索引



不在這一層放細節分析內容。



## 適用範圍



- 架構分析

- API 分析

- 資料流分析

- 表與欄位分析

- 參數與請求路徑分析

- 外部整合分析



## 建議結構



```text

vault/

  projects/

    index.md

    PCLMS/

      index.md

      recaps-index.md

      analysis/

        architecture/

        api/

        data-flow/

        tables/

        params/

        integrations/

```



## routing 原則



- 專案深度分析：寫到 `projects/<Project>/analysis/`

- session 工作紀錄：寫到 `memory/recaps/`

- 跨專案整理、母體治理、規劃稿：寫到 `context/`

- 已接受的長期規則：寫到 `memory/decisions/`



## 補充



- 既有的 recap 保留為分析過程記錄，不取代正式分析文件。

- second-brain 後續應索引這些正式分析文件，以提升架構、API、資料流與資料表相關查詢品質。

