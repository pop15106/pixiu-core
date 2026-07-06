---

type: after-action

date: 2026-05-15

project: PIXIUCORE

system: PIXIUCORE

repo: pixiu-core

topic: dashboard-dataview-encoding-guardrails

status: done

summary: 回顧本輪 vault 整理反覆踩到的 Dataview、欄位重複與中文編碼問題，整理成後續固定防呆規則。

tags: [after-action, pixiucore, obsidian, dataview, dashboard, encoding]

---



# Dashboard / Dataview / 編碼防呆



## 問題



本輪整理過程中，Obsidian Dashboard 與 vault metadata 正規化反覆踩到幾個坑：



- Dataview 查詢用了當前版本不支援的 `coalesce()`

- `TABLE` 預設自帶檔案欄位，手動再加 `file.link AS File` 造成重複

- callout 內 Dataview fence 格式不正確，Obsidian 把查詢當純文字顯示

- 批次寫回中文 frontmatter 時，一度出現 `?` / `??` 編碼污染

- 一次疊太多 Dashboard 顯示調整，導致反覆回改



## 造成反覆修正的原因



### 1. 先假設工具能力，再驗證



這輪一開始直接用了 `coalesce()` 與較新的 Dataview 寫法，但本地 Dataview 版本不支援，結果所有相關頁面一起壞掉。



### 2. Dashboard 顯示與資料層調整混在一起



同時處理 recap / decision metadata、Dataview query 與 Dashboard 欄位設計，讓問題來源不夠單純。



### 3. 中文批次寫回太敏感



涉及中文 frontmatter 與 markdown 時，只要寫入路徑或腳本處理稍微不透明，就可能把內容污染成 `?`。



## 這次有效做法



- 用 UTF-8 明確寫回腳本處理 markdown。

- Dataview 改成最保守相容策略：

  - 直接欄位

  - `TABLE WITHOUT ID`

  - 避免先用不確定版本支援的函式

- 封存區塊的 callout 內 Dataview query 明確用正確 `>` 結構。

- Dashboard 顯示回到最少必要欄位，先求穩定，再求美觀。



## 後續固定規則



1. 只要碰中文 markdown / frontmatter 批次改寫，一律優先走 UTF-8 明確寫回。

2. 只要碰 Dataview，就先用保守語法驗證跑得動，再增加美化或函式。

3. 只要手動指定 `file.link AS File`，就搭配 `TABLE WITHOUT ID`，避免重複欄位。

4. 只要改 Dashboard，就每次小改後立刻回 Obsidian 驗證，不要累積多個猜測再一起看結果。

5. session recap、decision、project analysis 與 context 要分層處理，不要在同一輪顯示調整裡混著大規模重構。



## 可重用結論



這類任務不是單純「寫 markdown」，而是同時碰：



- Obsidian 顯示層

- Dataview 查詢層

- vault metadata 結構層

- Windows / PowerShell 編碼層



因此後續應把它當成多層整合作業處理，而不是單一筆記編修。
