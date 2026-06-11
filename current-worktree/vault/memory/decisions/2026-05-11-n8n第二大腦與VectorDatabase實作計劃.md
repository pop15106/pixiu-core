---
type: decision
date: 2026-05-11
project: SECOND_BRAIN
system: SECOND_BRAIN
repo: second-brain
topic: n8n第二大腦與VectorDatabase實作計劃
status: accepted
decision: n8n 第二大腦與 Vector Database 實作計劃
choice: 先建立「單純 n8n 第二大腦」作為第一層能力，確保資料能被穩定蒐集、整理、落地成 Markdown。 第二層再加入 vector database，讓 Pixiu / AI 工具可進行語意搜尋、RAG 問答與來源引用。 原始資料與 Markdown 筆記永遠是主要資料來源；vector database 只作為可重建的索引層。 初期不追求全自動複雜平台，先用本機 Docker Desktop + n8n + Qdrant 打通最小閉環。
summary: n8n 第二大腦與 Vector Database 實作計劃：先建立「單純 n8n 第二大腦」作為第一層能力，確保資料能被穩定蒐集、整理、落地成 Markdown。 第二層再加入 vector database，讓 Pixiu / AI 工具可進行語意搜尋、R…
tags: [decision, second-brain, n8n, vector-database, obsidian, pixiucore]
---

# n8n 第二大腦與 Vector Database 實作計劃

## 決策摘要

- 先建立「單純 n8n 第二大腦」作為第一層能力，確保資料能被穩定蒐集、整理、落地成 Markdown。
- 第二層再加入 vector database，讓 Pixiu / AI 工具可進行語意搜尋、RAG 問答與來源引用。
- 原始資料與 Markdown 筆記永遠是主要資料來源；vector database 只作為可重建的索引層。
- 初期不追求全自動複雜平台，先用本機 Docker Desktop + n8n + Qdrant 打通最小閉環。

## 核心原則

| 原則 | 說明 |
|---|---|
| 原文優先 | 原始資料、Markdown、Obsidian 筆記是第二大腦的真實資料來源。 |
| 索引可重建 | Vector database 不存唯一真相，只保存 chunk、embedding 與 metadata。 |
| 分階段落地 | 先讓 n8n-only 管線可用，再加入語意搜尋。 |
| 本機優先 | 優先使用本機資料夾、本機服務與可備份的資料結構。 |
| 來源可追溯 | AI 回答必須能回指原始筆記、網址或檔案路徑。 |
| 最小閉環 | 每個 Phase 都要有明確交付物與驗收標準。 |

## 整體架構

```text
資料來源
  ↓
n8n 蒐集 / 排程 / 清洗
  ↓
raw / inbox / processed / notes
  ↓
Markdown / Obsidian / Pixiu vault
  ↓
chunk / embedding
  ↓
vector database
  ↓
語意搜尋 / RAG / AI 回答與引用
```

## 兩條路線比較

| 路線 | 目標 | 優點 | 代價 | 適用時機 |
|---|---|---|---|---|
| 單純 n8n 第二大腦 | 自動蒐集、整理、輸出 Markdown | 入門低、可快速看到成果、資料可直接進 Obsidian | 語意搜尋較弱，主要依賴標籤、檔名與全文搜尋 | 第一階段 MVP |
| n8n + vector database | 語意搜尋、RAG、AI 問答 | 能用自然語言查資料，支援來源引用 | 多了 embedding、chunk、索引重建與維運成本 | 第二階段擴充 |

## 方案 A：單純 n8n 第二大腦

### Phase A0：環境與資料夾規劃

| 項目 | 內容 |
|---|---|
| 目標 | 建立可長期使用的本機資料落點。 |
| 建議工具 | Docker Desktop、n8n Web UI、Obsidian 或 Pixiu vault。 |
| 交付物 | n8n 可啟動，資料夾結構確定。 |
| 驗收標準 | 可開啟 `http://localhost:5678`，且 n8n 能寫入指定本機資料夾。 |

建議資料夾：

```text
SecondBrain/
  inbox/
  raw/
  processed/
  notes/
  logs/
  exports/
```

### Phase A1：資料蒐集

| 資料來源 | 初期用途 | n8n 節點方向 |
|---|---|---|
| RSS | 自動抓技術文章與公告 | RSS Trigger |
| 手動網址 | 使用者臨時丟文章或文件 | Webhook / Form |
| GitHub release | 追工具版本與專案更新 | HTTP Request |
| 本機 drop folder | 把文件丟進資料夾後自動處理 | Local file trigger 或定期掃描 |
| 網頁文章 | 收集研究材料 | HTTP Request |

交付物：

- 每種來源至少建立一個 n8n workflow。
- 原始內容先存入 `raw/`。
- 每筆資料都保留來源 URL 或檔案路徑。

### Phase A2：標準化與去重

每筆資料需轉成一致 metadata：

```yaml
title:
source:
url:
source_path:
collected_at:
tags:
checksum:
status: inbox
```

| 檢查項 | 作法 |
|---|---|
| URL 重複 | 用 URL 當第一層 dedupe key。 |
| 內容重複 | 對正文產生 checksum。 |
| 檔案重複 | 對檔名、大小、checksum 比對。 |
| 狀態追蹤 | `inbox`、`processed`、`archived`。 |

### Phase A3：轉成 Markdown 筆記

建議筆記格式：

```markdown
---
title:
source:
url:
collected_at:
tags:
status:
---

# 標題

## 摘要

- ...

## 重點

- ...

## 原始來源

- URL:
- Local path:

## 待整理

- [ ] ...
```

交付物：

- `notes/` 內自動產出 Markdown。
- 筆記可被 Obsidian 開啟與搜尋。
- 每篇筆記都能回到原始來源。

### Phase A4：每日與每週整理

| Digest | 內容 |
|---|---|
| 每日整理 | 今日新增資料、待分類資料、優先閱讀清單。 |
| 每週整理 | 本週主題、重複出現的關鍵字、值得沉澱的決策。 |
| 專案整理 | Pixiu、PCLMS、AI 工具、第二大腦等主題分流。 |

交付物：

- `daily-YYYY-MM-DD.md`
- `weekly-YYYY-WW.md`
- 可人工勾選的待辦項目。

### Phase A5：備份與維護

| 備份項目 | 備份方式 |
|---|---|
| n8n workflows | 定期 export JSON。 |
| Markdown 筆記 | Git 或檔案同步。 |
| raw 原始資料 | 本機備份或外接硬碟。 |
| credentials | 手動記錄設定方式，不把 token 寫入 vault。 |

限制：

- 此方案可形成穩定的自動化筆記庫。
- 此方案尚未提供高品質語意搜尋。
- AI 使用時仍需依賴檔案搜尋、標籤與人工指定上下文。

## 方案 B：n8n + Vector Database 第二大腦

### Phase B0：Vector DB 選型

| 選項 | 優點 | 代價 | 建議 |
|---|---|---|---|
| Qdrant | HTTP API 清楚，適合 Docker 與 n8n 串接 | 需常駐服務與 volume 管理 | 第一版推薦 |
| Chroma | 快速本機 MVP，Python 生態好 | 多程序與長期服務需注意 | 快速實驗可用 |
| Postgres + pgvector | SQL、metadata、交易一致性強 | 維運成本較高 | 進入正式資料系統時再考慮 |
| LanceDB | 本機 embedded、檔案式管理 | n8n 直接整合需額外包裝 | 進階本機方案 |

初期建議：

- 使用 Qdrant 作為第一版 vector database。
- 使用 Docker Desktop 管理服務。
- 保留 Chroma 作為快速實驗備案。

### Phase B1：服務啟動

| 服務 | 用途 |
|---|---|
| n8n | 資料蒐集、清洗、workflow 編排。 |
| Qdrant | 儲存 vector index 與 chunk metadata。 |
| 本機資料夾 | 保存 raw、Markdown、processed files。 |
| 可選 Postgres | 若 n8n workflow 與執行紀錄需要正式 DB。 |

交付物：

- 可開啟 n8n Web UI。
- Qdrant 可被本機 HTTP API 呼叫。
- n8n workflow 能成功寫入或查詢 Qdrant。

### Phase B2：沿用 n8n-only 管線

流程：

```text
收資料
  ↓
存 raw
  ↓
標準化 metadata
  ↓
產 Markdown
  ↓
進入 indexing queue
```

原因：

- 避免 vector database 變成唯一資料來源。
- 日後 embedding model 或 chunk strategy 改變時，可以從 Markdown 重建索引。

### Phase B3：Chunk 設計

每個 chunk 應包含：

| 欄位 | 說明 |
|---|---|
| chunk_id | 單一 chunk 唯一識別。 |
| document_id | 對應原始文件。 |
| source_path | Markdown 或 raw 檔案路徑。 |
| title | 文件標題。 |
| url | 原始網址，若有。 |
| tags | 主題標籤。 |
| chunk_index | 文件內段落順序。 |
| content_hash | chunk 內容 hash。 |
| created_at | 建立時間。 |
| indexed_at | 寫入索引時間。 |

建議策略：

- 先用段落切分。
- 每個 chunk 保持可讀，不切碎語意。
- 保留前後段落關聯欄位，方便 AI 回答時補上下文。

### Phase B4：Embedding 產生

| 選項 | 優點 | 代價 | 適用情境 |
|---|---|---|---|
| 本機 embedding model | 隱私高、可離線 | 設定較麻煩，硬體與模型品質需驗證 | 私密資料較多時 |
| 雲端 embedding API | 品質穩、導入快 | 會有費用與資料外送問題 | 初期驗證與非敏感資料 |

紀錄必要資訊：

```yaml
embedding_model:
embedding_dimension:
embedding_provider:
embedding_version:
chunk_strategy:
indexed_at:
```

### Phase B5：語意搜尋 workflow

流程：

```text
輸入問題
  ↓
問題轉 embedding
  ↓
查 vector database top-k
  ↓
取回 chunk 與 metadata
  ↓
回傳相關筆記與來源
```

交付物：

- n8n 有一個「問第二大腦」workflow。
- 輸入自然語言問題後，可取得 top-k 相關片段。
- 每個結果都附來源路徑與原始 URL。

### Phase B6：RAG 回答與引用

AI 回答格式建議：

```markdown
## 回答

- ...

## 引用資料

| 來源 | 相關片段 | 路徑 |
|---|---|---|
| ... | ... | ... |

## 信心與限制

- 信心程度：
- 需要人工確認：
```

驗收標準：

- AI 不得只回答結論，必須列出引用來源。
- 若資料不足，回答必須明確說「查無足夠資料」。
- 來源要能回到 Markdown 或原始 URL。

### Phase B7：索引重建與維護

| 維護情境 | 處理方式 |
|---|---|
| embedding model 更換 | 全量重建 vector index。 |
| chunk strategy 更換 | 重新切 chunk 並重建。 |
| Markdown 內容更新 | 比對 content_hash 後增量更新。 |
| 資料刪除 | 從 notes/raw 刪除後，同步刪除對應 chunks。 |

重建原則：

- 不手工修 vector database。
- 以 `raw/` 與 `notes/` 為來源重建。
- 每次重建記錄 model、版本與日期。

### Phase B8：品質驗收題庫

| 測試題 | 驗收重點 |
|---|---|
| 我最近收集了哪些 n8n 相關資料？ | 能找回近期 n8n 筆記。 |
| PixiuCore recap 規則是什麼？ | 能命中 Pixiu vault 內相關規則。 |
| 哪些資料跟本機 vector database 有關？ | 能跨來源找相近主題。 |
| 某個主題有哪些來源互相矛盾？ | 能列出不同來源與差異。 |
| 我上週整理過哪些第二大腦資料？ | 能從 digest 與 metadata 回答。 |

## 推薦落地順序

| 順序 | Phase | 目標 | 是否需要 Vector DB |
|---|---|---|---|
| 1 | A0-A1 | n8n 跑起來並能收資料 | 否 |
| 2 | A2-A3 | 產出標準 Markdown 筆記 | 否 |
| 3 | A4-A5 | 建立 digest 與備份策略 | 否 |
| 4 | B0-B2 | 選 Qdrant 並接上 n8n | 是 |
| 5 | B3-B5 | chunk、embedding、語意搜尋 | 是 |
| 6 | B6-B8 | RAG、引用來源、品質驗收 | 是 |

## 最小可行 MVP

第一個 MVP 只做以下閉環：

```text
n8n 抓 RSS 或手動網址
  ↓
產出 Markdown
  ↓
切 chunk
  ↓
產生 embedding
  ↓
寫入 Qdrant
  ↓
用一句問題查回相關 chunk
```

MVP 驗收條件：

- 至少有 5 篇資料進入 `notes/`。
- 至少有 5 篇資料成功建立 vector index。
- 能用自然語言查回 3 筆以上合理相關資料。
- 每個搜尋結果都能回到原始 Markdown 或 URL。

## 風險與控制

| 風險 | 影響 | 控制方式 |
|---|---|---|
| 一開始做太複雜 | 卡在工具安裝與架構細節 | 先完成 n8n-only，再加 vector DB。 |
| 只存 vector 不存原文 | 日後無法重建或查證 | 原文與 Markdown 必須優先保存。 |
| embedding model 更換 | 舊索引不可混用 | 記錄 model version，必要時全量重建。 |
| 外部 API 洩漏敏感資料 | 隱私與合規風險 | 私密資料優先本機 embedding。 |
| n8n credentials 遺失 | workflow 無法執行 | workflow 可匯出，credentials 另行安全備份。 |
| Docker volume 未備份 | 服務重建後資料遺失 | 明確指定 volume，定期備份。 |

## 待決策項目

| 項目 | 預設建議 | 待確認 |
|---|---|---|
| Vector DB | Qdrant | 是否接受 Docker 常駐服務 |
| 筆記落點 | Pixiu vault 或獨立 SecondBrain vault | 是否直接併入現有 Obsidian |
| Embedding | 先雲端或先本機 | 私密資料比例 |
| n8n 執行方式 | Docker Desktop | 是否改用 npm/npx 入門 |
| 備份策略 | Markdown + workflow export + volume backup | 是否納入 Git |

## 結論

- 第一階段先做「n8n 自動化筆記庫」，讓資料穩定進入 Markdown。
- 第二階段再加入 Qdrant，讓資料具備語意搜尋能力。
- 長期架構應維持「Markdown 是第二大腦，vector database 是搜尋神經系統」。

## 2026-05-11 實作落地

| 項目 | 結果 |
|---|---|
| 實作位置 | `C:\Users\7010\Documents\Playground\second-brain` |
| n8n | 已建立 Docker Compose service，網址為 `http://localhost:5678`。 |
| Qdrant | 已建立 Docker Compose service，Dashboard 為 `http://localhost:6333/dashboard`。 |
| Pixiu vault | 已以唯讀方式掛載到 n8n container 的 `/pixiu-vault`。 |
| Manifest | 已產生 `data/files/indexing-queue/pixiu-vault-manifest.jsonl`，列出 74 個 Markdown 檔。 |
| Qdrant smoke test | 已成功建立測試 collection、寫入 3 筆測試向量並查回結果。 |
| 正式 collection | 已建立 `second_brain_chunks`，vector size 為 `1536`。 |
| 操作文件 | 已產出 `out/Pixiu第二大腦_n8n_Qdrant_操作手冊.docx`。 |

### 尚待決策

| 項目 | 目前狀態 |
|---|---|
| Embedding 來源 | 尚未指定；需在本機模型與雲端 embedding API 之間擇一。 |
| n8n 正式 workflow | 已有 workflow 藍圖，待 embedding 來源確定後建立正式 workflow。 |
| 是否允許寫回 vault | 初期維持唯讀，避免自動流程污染母體資料。 |
