---
type: implementation-plan
date: 2026-05-15
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: recap-organization-plan
status: draft
summary: 定義 recap 區的整理原則、欄位規格與低風險分階段執行方式。
tags: [pixiucore, vault, recap, organization, memory, projects]
---

# Recap 整理規劃草案

## 目的

在不搬動既有 recap 原件、不破壞母體時間軸與 second-brain 穩定性的前提下，先把 `vault/memory/recaps` 的整理規則定清楚，讓後續可以同時支援：

- 全域時間軸
- 專案視角
- 系統視角
- repo 視角

## 目前現況

截至 2026-05-15，`vault/memory/recaps` 盤點結果：

- Markdown recap 檔約 46 份
- 另混入少數非 recap 產物：
  - `gen_docx_ppost_piece.py`
  - `2026-04/` 下的 `.docx`
- 結構混用：
  - 新版：`type: session-recap`
  - 中間版：`type: recap`
  - 特例：`type: monthly-summary`
  - 舊版：部分檔案沒有可用 frontmatter，或直接以正文開始
- 欄位不一致：
  - 有些用 `date`
  - 有些用 `created`
  - 有些沒有 `project`
  - 有些 `status` 是英文狀態
  - 有些 `status` 是整句描述
- 命名不一致：
  - 有的檔名含秒時間戳
  - 有的只有日期
  - 有的含大寫專案名
  - 有的用小寫 slug

## 目前混雜的主題群

從檔名與 tags 看，目前 recap 至少混了這幾群：

1. PCLMS
   - `PCLMS`
   - `PCLMS_AP`
   - `PCLMS_BK`
   - 月報、庫存核銷、JMS、本機 DB 測試

2. PEPIS / CCPS
   - eDDA
   - ACH 授權
   - login / captcha / UI
   - payment service apply

3. Second Brain / n8n / Qdrant
   - n8n
   - NVIDIA API
   - Qdrant
   - deploy
   - query / sandbox

4. PixiuCore 母體
   - README
   - path sync
   - agent team
   - workflow / policy

5. 文件與工具鏈
   - DOCX
   - make-docx
   - CCA-F

6. Auto Research / Spec / OpenSpec
   - Auto Research
   - SAST triage
   - Manual scoring
   - OpenSpec

7. 其他架構分析
   - PISSO

## 亂的根因

`vault/memory/recaps` 目前同時扮演了四個角色：

1. session 時間軸
2. 專案工作紀錄
3. 專案知識沉澱
4. 部分決策前置備忘

這四個角色沒有分層，才會導致不同專案看起來全部擠在一起。

## 整理原則

第一原則：`vault/memory/recaps` 保留為 recap 原件唯一位置。

第二原則：專案視角改用索引頁或投影片，不直接把 recap 原件拆去各專案。

第三原則：高價值 recap 再升格成正式 project note 或 decision，不讓 recap 本身承擔長期知識庫角色。

## 建議的 recap frontmatter 標準

後續新 recap 建議逐步統一成：

```yaml
---
type: session-recap
date: 2026-05-15
project: PCLMS_BK
system: PCLMS
repo: PCLMS_BK_new
topic: local-orapass-l8-db-test
status: done
tags: [recap, pclms, pclms-bk, db-test]
source_paths:
  - C:/Users/7010/Desktop/gravityTest/PCLMS_BK_new
related_notes: []
related_decisions: []
related_recaps: []
summary: 一句話摘要
---
```

## 建議的 project 代碼

為了避免 `project` / `repo` 混用，先固定常見代碼：

- `PCLMS`
- `PCLMS_AP`
- `PCLMS_BK`
- `PCLMS_FD`
- `PEPIS`
- `PISSO`
- `PIXIUCORE`
- `SECOND_BRAIN`
- `AUTO_RESEARCH`
- `DOCX_TOOLING`
- `OPENSPEC`

補充規則：

- `project`：整理視角
- `system`：上層系統
- `repo`：實際 repo 名稱

例如：

- `project: PCLMS_BK`
- `system: PCLMS`
- `repo: PCLMS_BK_new`

## 建議的專案投影頁

不搬原件，先在 `vault/projects/` 補專案索引頁：

- `vault/projects/PCLMS/recaps-index.md`
- `vault/projects/PEPIS/recaps-index.md`
- `vault/projects/Second_Brain/recaps-index.md`
- `vault/projects/PixiuCore/recaps-index.md`

這些頁面只負責查 `vault/memory/recaps`，不存原件。

## 優先處理順序

### Phase 1：只盤點

- 已完成
- 不搬檔
- 不改 n8n

### Phase 2：建立規格與索引頁

- 定 frontmatter 欄位
- 定 project 代碼
- 建立主要專案的 `recaps-index.md`

### Phase 3：補新 recap

- 先要求新 recap 遵守新格式
- 舊 recap 先不全面重寫

### Phase 4：補常用舊 recap

- 只補最常查的 recap
- 優先補 `project / system / repo / topic / summary`

### Phase 5：升格正式知識

- 將高價值 recap 提煉為 `vault/projects/<專案>/` 正式筆記
- 將穩定規則提煉為 `vault/memory/decisions/`

## 高風險事項

目前不建議直接做的事：

- 搬動 `vault/memory/recaps` 原件
- 將所有 recap 依專案改資料夾
- 直接重命名全部舊 recap
- 改動 `Dashboard` 的既有 Dataview 查詢後又沒有回歸驗證
- 把 `memory/recaps` 與 `projects/` 混成雙原件結構

## 後續建議

最小風險做法是：

1. 保留 `memory/recaps` 當唯一原件區
2. 先建立專案索引頁
3. 從新 recap 開始採新 frontmatter
4. 逐步補舊 recap，而不是一次重構

這樣可以先把「看起來很亂」轉成「原件集中，但視角分流」。

## 2026-05-15 補充：Frontmatter 編碼安全規則

本輪整理發現，先前批次補 `summary` 時曾把中文寫成 `?`，原因不是 Obsidian 顯示錯，而是 frontmatter 在寫回時已被編碼污染。

後續整理 recap 時，請固定遵守：

- 批次改 frontmatter 時，優先使用明確指定 UTF-8 的寫法。
- 不要用會隱性改編碼的批次流程直接覆蓋整份檔案。
- 若只修 frontmatter，正文應視為受保護區，避免順手重排或重寫。
- 批次寫回後，至少抽查 1 到 2 份檔案的 `summary:`、`tags:` 是否出現 `?` 或 `??`。
- 若發現污染，先回復該批 frontmatter，再處理資料內容，不要直接在 Obsidian 內逐篇手修。

這個規則的目的是讓 recap 正規化保持可批次化，同時避免再次破壞既有筆記內容。
