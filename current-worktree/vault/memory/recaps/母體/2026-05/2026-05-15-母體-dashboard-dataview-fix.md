---

type: session-recap

date: 2026-05-15

project: PIXIUCORE

system: PIXIUCORE

repo: pixiu-core

topic: pixiucore-dashboard-dataview-fix

status: done

tags: [recap, pixiucore, obsidian, dataview, dashboard]

source_paths:

  - C:/Users/7010/Desktop/gravityTest/pixiu-core/vault/🏠 Dashboard.md

  - C:/Users/7010/Desktop/gravityTest/pixiu-core/vault/after-action/index.md

  - C:/Users/7010/Desktop/gravityTest/pixiu-core/vault/context/index.md

summary: 修正 Obsidian Dashboard 的 Dataview 相容性與欄位重複問題，統一改成中文欄位與單一 File 顯示。

---



# PixiuCore Dashboard Dataview 修正



## 本次處理



- 修正 `🏠 Dashboard.md` 與相關索引頁使用 `coalesce()` 導致 Dataview 報錯的問題。

- 將 Dashboard 的主要區塊改為較保守的 Dataview 寫法，避免版本相容性問題。

- 修正封存 callout 內 Dataview fence 語法，讓 `2026 年 4 月封存 Recaps` 與 `2026 年 4 月封存 Decisions` 可以正常執行。

- 將 Dashboard 顯示欄位統一為中文。

- 將狀態值轉為中文顯示，例如 `draft -> 草稿`、`active -> 進行中`、`accepted -> 已採納`。

- 修正 Dataview `TABLE` 預設多帶一欄檔案連結的問題，統一改用 `TABLE WITHOUT ID`，只保留手動指定的 `File` 欄。



## 影響範圍



- `vault/🏠 Dashboard.md`

- `vault/after-action/index.md`

- `vault/context/index.md`

- 多個 `vault/projects/*/recaps-index.md`



## 目前顯示策略



- `近期 Session Recaps`：`File / 日期 / 主題 / 狀態`

- `進行中的工作`：`File / 專案 / 狀態`

- `最近決策`：`File / 決策 / 日期 / 狀態`



## 已確認的問題



- Dataview 舊版不支援 `coalesce()`。

- Dataview `TABLE` 會自動附帶一欄檔案欄位；若又手動寫 `file.link AS File`，就會出現重複欄。

- callout 內的 Dataview code fence 若縮排或 `>` 結構不對，Obsidian 會把它當純文字顯示，而不是執行查詢。



## 後續建議



- 若之後還要再微調易讀性，優先從欄位數量與欄寬下手，不要再增加重複資訊。

- 若要讓 Dashboard 更順眼，可考慮將 `File` 換成更短的顯示名稱，或對長檔名另做縮寫規則。

- Dashboard 顯示調整完成後，可再重跑 second-brain，同步最新的整理與索引頁內容。

## 後續分析文件落位規則

- 若之後要對 `gravityTest` 下的 repo 做深度與廣度分析，分析來源可以在 `gravityTest/<repo>`，但分析產物不要再散寫到共用 `context/`。
- 專案本身的分析文件，應固定落到 `vault/projects/<Project>/analysis/` 底下。
- `vault/projects/` 這一層可以另外建立總表或索引頁，只放入口、分析進度與狀態，不放細節內容。

### 建議結構

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

### routing 原則

- 專案深度分析：寫到 `projects/<Project>/analysis/`
- session 工作紀錄：寫到 `memory/recaps/`
- 跨專案整理、母體治理、規劃稿：寫到 `context/`
- 已接受的長期規則：寫到 `memory/decisions/`

### 後續建議

- 先建立 `vault/projects/index.md` 作為總表。
- 之後開始分析某個專案時，直接在對應 `projects/<Project>/analysis/` 建立文件。
- second-brain 後續也應吃這些正式分析文件，提升架構、API、資料流與表欄位搜尋品質。

