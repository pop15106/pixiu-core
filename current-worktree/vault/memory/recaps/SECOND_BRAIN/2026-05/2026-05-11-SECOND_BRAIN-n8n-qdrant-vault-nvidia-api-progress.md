---
type: recap
date: 2026-05-11
project: SECOND_BRAIN
system: SECOND_BRAIN
repo: second-brain
topic: n8n-qdrant-vault-nvidia-api-progress
status: completed
tags: [recap, second-brain, n8n, qdrant, vector-database, nvidia-api, pixiu-vault]
summary: 整理 second-brain Phase B 進度，涵蓋 n8n、Qdrant、vault 掛載與 NVIDIA API 接續規劃。
---

# n8n + Qdrant 第二大腦與 NVIDIA API 接續規劃 Recap

## 本次目標

- 將「方案 B：n8n + vector database 第二大腦」落地到本機。
- 讓目前 Pixiu vault 成為第一批資料來源。
- 產出給不熟 Docker / n8n 的使用者也能照做的 `.docx` 操作手冊。
- 討論下一步改用 NVIDIA 雲端 API 作為 embedding 來源。

## 已完成項目

| 項目 | 結果 |
|---|---|
| 實作目錄 | `C:\Users\7010\Documents\Playground\second-brain` |
| Docker Compose | 已建立 `n8n` 與 `Qdrant` 服務。 |
| n8n | 已啟動，網址為 `http://localhost:5678`。 |
| Qdrant | 已啟動，Dashboard 為 `http://localhost:6333/dashboard`。 |
| Pixiu vault 掛載 | 已將 `C:\Users\7010\Desktop\gravityTest\pixiu-core\vault` 以唯讀方式掛載到 n8n container 的 `/pixiu-vault`。 |
| Vault manifest | 已產生 `data/files/indexing-queue/pixiu-vault-manifest.jsonl`，共 74 個 Markdown 檔。 |
| Qdrant smoke test | 已建立測試 collection、寫入 3 筆測試向量並成功查回。 |
| 正式 collection | 已建立 `second_brain_chunks`，vector size 先用 `1536`。 |
| 操作手冊 | 已產出 `out/Pixiu第二大腦_n8n_Qdrant_操作手冊.docx`。 |
| 文件驗證 | artifact-tool renderer 失敗無 stderr；改用 Word COM 匯出 PDF，PDF 共 7 頁，並用 `pypdf` 確認關鍵內容存在。 |

## 已建立的主要檔案

| 檔案 | 用途 |
|---|---|
| `docker-compose.yml` | 啟動 n8n 與 Qdrant。 |
| `.env.example` | 環境變數範本，不含真實 API key。 |
| `.env` | 本機實際設定，包含 n8n encryption key 與 host path，不進版控。 |
| `scripts/setup-env.ps1` | 初始化 `.env`、資料夾與 Pixiu vault 掛載路徑。 |
| `scripts/start.ps1` | 啟動 Docker Compose。 |
| `scripts/stop.ps1` | 關閉 Docker Compose。 |
| `scripts/status.ps1` | 檢查服務與 Qdrant collections。 |
| `scripts/export-pixiu-vault-manifest.ps1` | 掃描 Pixiu vault Markdown 並產出 manifest。 |
| `scripts/qdrant-smoke-test.ps1` | 測試 Qdrant 建 collection、寫入與查詢。 |
| `scripts/create-qdrant-collection.ps1` | 建立正式 Qdrant collection。 |
| `workflows/README.md` | n8n workflow 藍圖。 |
| `README.md` | second-brain 專案操作說明。 |

## 驗證結果

| 驗證項 | 結果 |
|---|---|
| `docker compose ps` | `pixiu-second-brain-n8n` 與 `pixiu-second-brain-qdrant` 均為 `Up`。 |
| n8n HTTP | `http://localhost:5678` 回應 `200`。 |
| Qdrant API | `http://localhost:6333/collections` 回應 `status: ok`。 |
| n8n container 讀 vault | `docker exec` 確認 `/pixiu-vault` 可看到 `README.md`、`memory`、`context` 等目錄。 |
| n8n container 讀 manifest | `docker exec` 確認 `/files/indexing-queue/pixiu-vault-manifest.jsonl` 存在。 |
| Qdrant collections | 目前有 `second_brain_chunks` 與 `second_brain_smoke_test`。 |

## NVIDIA API 接續規劃

### 建議模型

| 項目 | 建議 |
|---|---|
| Embedding model | `nvidia/llama-3.2-nemoretriever-300m-embed-v2` |
| Endpoint | `POST https://integrate.api.nvidia.com/v1/embeddings` |
| 索引用 input type | `passage` |
| 查詢用 input type | `query` |
| 建議 Qdrant collection | `second_brain_chunks_nvidia` |
| 建議 vector size | `2048` |
| Distance | `Cosine` |

### 接線方式

```text
Pixiu vault / notes
  ↓
chunk
  ↓
NVIDIA embedding API
  ↓
Qdrant collection: second_brain_chunks_nvidia
  ↓
n8n 查詢 / RAG
```

### 安全原則

- 不把 NVIDIA API key 寫進 Markdown、README、DOCX 或 workflow 匯出檔。
- API key 只放在 `.env` 或 n8n credentials。
- 不直接刪除既有 `second_brain_chunks` collection。
- 先建立新 collection `second_brain_chunks_nvidia`，保留 rollback 空間。
- 初期 Pixiu vault 維持唯讀掛載，不允許 n8n 自動寫回母體。

## 尚待決策

| 決策項 | 狀態 |
|---|---|
| NVIDIA API key 放置方式 | 建議放 n8n credentials，或本機 `.env`；尚待確認。 |
| 是否採 `llama-3.2-nemoretriever-300m-embed-v2` | 初步建議採用；尚待使用者確認。 |
| Qdrant collection 是否改新名稱 | 建議新建 `second_brain_chunks_nvidia`；尚待實作。 |
| 是否先索引全部 74 個 vault Markdown | 建議先小批量 smoke test，再全量索引。 |
| 是否加入 reranker | 暫不做，先完成 embedding + Qdrant 查詢閉環。 |

## 下一步建議

1. 新增 NVIDIA API 相關 `.env.example` 欄位與 README 說明。
2. 建立 `second_brain_chunks_nvidia` collection，vector size `2048`。
3. 新增 NVIDIA embedding smoke test 腳本：
   - 測 API key 是否可用。
   - 驗證回傳 embedding 維度。
   - 寫入 Qdrant。
   - 查詢回傳來源 metadata。
4. 若 smoke test 通過，再建立 n8n workflow：
   - `Index Pixiu Vault`
   - `Query Second Brain`
5. 更新 DOCX 操作手冊，補上 NVIDIA API 設定與測試章節。

## 注意事項

- NVIDIA embedding API 需要區分 `passage` 與 `query`，用錯會明顯降低檢索品質。
- NVIDIA model 維度與現有 `second_brain_chunks` 的 `1536` 不同，因此不應混寫同一 collection。
- 目前基礎設施已可用，但正式 RAG workflow 尚未建立；下一步重點是 NVIDIA API smoke test。
## 2026-05-12 完成狀態

- `C:\Users\7010\Documents\Playground\second-brain` 已補齊 NVIDIA embedding API 接線，包含 `.env.example`、Docker Compose env、setup-env 預設值。
- 已新增 `scripts\nvidia-embedding-smoke-test.ps1`，用 `input_type=passage/query` 驗證 NVIDIA embedding API、寫入 Qdrant、再查回結果。
- 已新增 `scripts\index-pixiu-vault-nvidia.ps1`，可把 Pixiu vault manifest 切 chunk 後寫入 `second_brain_chunks_nvidia`。
- 已新增 `scripts\query-second-brain-nvidia.ps1`，可把使用者問題轉 query embedding 後查 Qdrant top-k 來源。
- 已建立 Qdrant collection `second_brain_chunks_nvidia`，vector size `2048`，distance `Cosine`。
- 已修正 `scripts\qdrant-smoke-test.ps1`，讓 smoke test 在 collection 已存在時可重跑。
- 已更新 `README.md`、`workflows\README.md`、操作手冊產生腳本與 PDF 檢查腳本。
- 已重新產出 `out\Pixiu第二大腦_n8n_Qdrant_操作手冊.docx` 與 `out\Pixiu第二大腦_n8n_Qdrant_操作手冊.pdf`。

## NVIDIA API 接線決策

- 預設 endpoint：`https://integrate.api.nvidia.com/v1/embeddings`。
- 預設 model：`nvidia/llama-nemotron-embed-1b-v2`。
- 預設 collection：`second_brain_chunks_nvidia`。
- 預設維度：`2048`。
- 索引文件時使用 `input_type: passage`；查詢問題時使用 `input_type: query`。
- 前一版 recap 記錄的 `nvidia/llama-3.2-nemoretriever-300m-embed-v2` 已在 NVIDIA Build 頁面標示 2026-05-18 後不再支援，因此不作為新預設。

## 驗證結果

- `docker compose --env-file .env ps`：`pixiu-second-brain-n8n` 與 `pixiu-second-brain-qdrant` 均為 `Up`。
- Qdrant `second_brain_chunks_nvidia`：collection 存在，vector size `2048`，points count 目前為 `0`。
- `scripts\qdrant-smoke-test.ps1`：可重跑並查回 3 筆測試資料。
- PowerShell parser：所有 `scripts\*.ps1` 解析 OK。
- Python compile：`build-operation-manual.py` 與 `inspect-manual-pdf.py` 解析 OK。
- PDF 檢查：8 頁，包含 `second_brain_chunks_nvidia`、`nvidia/llama-nemotron-embed-1b-v2`、`NVIDIA_API_KEY` 等必要字串。
- NVIDIA 遠端 embedding smoke test 尚未執行，原因是 `.env` 目前沒有填 `NVIDIA_API_KEY`；填入後即可執行 `scripts\nvidia-embedding-smoke-test.ps1`。
