---
type: session-recap
date: 2026-05-12
project: SECOND_BRAIN
system: SECOND_BRAIN
repo: second-brain
topic: nvidia-api-complete
status: done
tags: [recap, session, second-brain, n8n, qdrant, nvidia-api, pixiu-vault]
summary: 完成 second-brain 串接 NVIDIA embedding API，確認 n8n、Qdrant 與 vault 索引流程可用。
---

# Session Recap：第二大腦 n8n + Qdrant + NVIDIA API 接線完成

## 任務目標與背景

本次 session 的目標是接續前一輪「Pixiu 第二大腦」工作，把 `C:\Users\7010\Documents\Playground\second-brain` 從已具備 n8n + Qdrant 基礎設施的狀態，補齊到可接 NVIDIA embedding API、可重跑索引、可查詢 Pixiu vault 內容的程度，並整理清楚使用者後續要如何放入 NVIDIA API key。

背景來自前一輪 recap 與使用者要求：「繼續把第二大腦做完，然後說明要怎麼接上 nvidia 的 api」。本次一開始先確認 PixiuCore 母體為 `C:\Users\7010\Desktop\gravityTest\pixiu-core`，並讀取 Pixiu startup rules 指定的 vault / identity / memory 檔案，避免把 recap 或規劃寫到錯的 source of truth。

影響範圍：

- Playground 實作資料夾：`C:\Users\7010\Documents\Playground\second-brain`
- PixiuCore 母體 recap：`C:\Users\7010\Desktop\gravityTest\pixiu-core\vault\memory\recaps`
- n8n / Qdrant 本機容器：`pixiu-second-brain-n8n`、`pixiu-second-brain-qdrant`
- Qdrant collections：`second_brain_chunks`、`second_brain_smoke_test`、`second_brain_chunks_nvidia`

## 本次完成

1. 確認 PixiuCore 母體與既有狀態。
   - `PIXIU_CORE` 與 `PIXIU_CORE_PATH` 都指向 `C:\Users\7010\Desktop\gravityTest\pixiu-core`。
   - `second-brain` 已存在 Docker Compose、n8n SQLite、Qdrant 資料、vault manifest、手冊 DOCX/PDF。
   - 已讀取前一輪 `2026-05-11-181044-n8n-qdrant-vault-nvidia-api-progress.md` recap，確認當時狀態為 NVIDIA API 尚待接線。

2. 補齊 NVIDIA embedding API 設定。
   - 更新 `.env.example`，新增：
     - `NVIDIA_API_KEY`
     - `NVIDIA_EMBEDDING_ENDPOINT`
     - `NVIDIA_EMBEDDING_MODEL`
     - `NVIDIA_EMBEDDING_DIMENSIONS`
     - `NVIDIA_EMBEDDING_COLLECTION`
   - 更新 `docker-compose.yml`，將上述 NVIDIA 設定傳入 n8n container，讓 n8n workflow 可用環境變數接 API。
   - 更新 `scripts/setup-env.ps1`，讓既有 `.env` 也會補上 NVIDIA 預設值，不破壞現有 n8n encryption key。

3. 新增共用 PowerShell helper。
   - 新增 `scripts/_second-brain-common.ps1`。
   - 提供 `.env` 讀取、設定取值、NVIDIA API key 檢查、Qdrant collection 建立、NVIDIA embedding 呼叫、SHA256、穩定 GUID、文字 chunk 切分等共用函式。

4. 新增 NVIDIA smoke test。
   - 新增 `scripts/nvidia-embedding-smoke-test.ps1`。
   - 流程：
     1. 讀取 `.env`。
     2. 呼叫 NVIDIA embedding API，索引文字使用 `input_type=passage`。
     3. 寫入 Qdrant `second_brain_chunks_nvidia`。
     4. 再用問題文字呼叫 NVIDIA embedding API，查詢使用 `input_type=query`。
     5. 查回 Qdrant top-k 結果。
   - 因目前 `.env` 的 `NVIDIA_API_KEY` 仍為空，所以遠端 API smoke test 尚未實際執行。

5. 新增 Pixiu vault 正式索引腳本。
   - 新增 `scripts/index-pixiu-vault-nvidia.ps1`。
   - 可讀取 `data/files/indexing-queue/pixiu-vault-manifest.jsonl`，將 Pixiu vault Markdown 切 chunk，呼叫 NVIDIA embedding，再 upsert 到 Qdrant。
   - 新增 `-DryRun` 模式，可在沒有 API key 時先驗證 manifest 讀取與 chunk 切分，不打 NVIDIA API，也不寫 Qdrant。
   - 已驗證 `-Limit 3 -DryRun` 成功：3 份文件切出 9 個 chunks，第一個來源為 `after-action/2026-04-27-docx-book-style-toc-validation.md`。

6. 新增第二大腦查詢腳本。
   - 新增 `scripts/query-second-brain-nvidia.ps1`。
   - 可把使用者問題轉為 NVIDIA query embedding，再查詢 `second_brain_chunks_nvidia`，回傳 score、title、relative_path、source_path、chunk_index 與文字片段。

7. 建立 NVIDIA 專用 Qdrant collection。
   - 已建立 `second_brain_chunks_nvidia`。
   - vector size：`2048`
   - distance：`Cosine`
   - collection 狀態：`green`
   - points count：目前 `0`，等待填入 NVIDIA API key 後正式索引。

8. 修正既有 Qdrant smoke test 可重跑性。
   - `scripts/qdrant-smoke-test.ps1` 原本在 `second_brain_smoke_test` 已存在時會失敗。
   - 已改為先檢查 collection，存在則直接 upsert 測試 points。
   - 已驗證可重跑並查回 3 筆測試資料。

9. 更新文件與手冊。
   - 更新 `README.md`，補上 NVIDIA API 接線方式、預設 model、endpoint、collection、指令。
   - 更新 `workflows/README.md`，補上 n8n HTTP Request 節點建議設定與索引 / 查詢 payload 範例。
   - 更新 `scripts/build-operation-manual.py`，讓操作手冊包含 NVIDIA API 章節與指令。
   - 更新 `scripts/inspect-manual-pdf.py`，檢查 PDF 必須包含 NVIDIA model、collection、API key 欄位。
   - 已重產 `out/Pixiu第二大腦_n8n_Qdrant_操作手冊.docx`。
   - 已用 Word COM 重匯出 `out/Pixiu第二大腦_n8n_Qdrant_操作手冊.pdf`。

10. 回寫前一輪 NVIDIA progress recap。
    - 將 `2026-05-11-181044-n8n-qdrant-vault-nvidia-api-progress.md` 的 `status` 從 `in-progress` 改為 `completed`。
    - 追加 2026-05-12 完成狀態、NVIDIA API 接線決策與驗證結果。

## 進行中

目前核心 Phase 已完成，唯一尚未完成的是「實際呼叫 NVIDIA 遠端 embedding API」。

Phase 狀態：

| Phase | 名稱 | 狀態 |
|---|---|---|
| Phase 1 | PixiuCore 母體與既有狀態確認 | 完成 |
| Phase 2 | NVIDIA API 設定與腳本補齊 | 完成 |
| Phase 3 | Qdrant collection 與本機驗證 | 完成 |
| Phase 4 | 文件、手冊、recap 回寫 | 完成 |
| Phase 5 | 實際 NVIDIA 遠端 API smoke test | 完成 |

卡點：

- `.env` 已設定 `NVIDIA_API_KEY`；不可把 key 寫入 vault 或文件。
- 因沒有 key，本次沒有實際送出 `https://integrate.api.nvidia.com/v1/embeddings` request。
- 風險低，因為本機 Qdrant、collection、PowerShell 語法、chunk dry run、DOCX/PDF 都已驗證。

## 當前規劃完整內容

### 架構設計

```text
Pixiu vault Markdown
  -> export-pixiu-vault-manifest.ps1
  -> data/files/indexing-queue/pixiu-vault-manifest.jsonl
  -> index-pixiu-vault-nvidia.ps1
  -> chunk text
  -> NVIDIA embedding API
       endpoint: https://integrate.api.nvidia.com/v1/embeddings
       model: nvidia/llama-nemotron-embed-1b-v2
       input_type for indexing: passage
  -> Qdrant collection: second_brain_chunks_nvidia
       vector size: 2048
       distance: Cosine
  -> query-second-brain-nvidia.ps1
       input_type for query: query
  -> top-k source chunks with citations
```

### 關鍵設定

`.env.example` / `.env` 需要包含：

```env
NVIDIA_API_KEY=
NVIDIA_EMBEDDING_ENDPOINT=https://integrate.api.nvidia.com/v1/embeddings
NVIDIA_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-1b-v2
NVIDIA_EMBEDDING_DIMENSIONS=2048
NVIDIA_EMBEDDING_COLLECTION=second_brain_chunks_nvidia
```

n8n container 透過 `docker-compose.yml` 取得同樣設定：

```yaml
- NVIDIA_API_KEY=${NVIDIA_API_KEY:-}
- NVIDIA_EMBEDDING_ENDPOINT=${NVIDIA_EMBEDDING_ENDPOINT:-https://integrate.api.nvidia.com/v1/embeddings}
- NVIDIA_EMBEDDING_MODEL=${NVIDIA_EMBEDDING_MODEL:-nvidia/llama-nemotron-embed-1b-v2}
- NVIDIA_EMBEDDING_DIMENSIONS=${NVIDIA_EMBEDDING_DIMENSIONS:-2048}
- NVIDIA_EMBEDDING_COLLECTION=${NVIDIA_EMBEDDING_COLLECTION:-second_brain_chunks_nvidia}
```

### NVIDIA embedding request payload

索引時：

```json
{
  "model": "nvidia/llama-nemotron-embed-1b-v2",
  "input": ["chunk text"],
  "input_type": "passage",
  "encoding_format": "float",
  "truncate": "END",
  "modality": "text",
  "dimensions": 2048
}
```

查詢時：

```json
{
  "model": "nvidia/llama-nemotron-embed-1b-v2",
  "input": ["使用者問題"],
  "input_type": "query",
  "encoding_format": "float",
  "truncate": "END",
  "modality": "text",
  "dimensions": 2048
}
```

### 使用者後續接 API 指令

先填 `.env`：

```env
NVIDIA_API_KEY=你的 NVIDIA API key
```

然後執行：

```powershell
cd C:\Users\7010\Documents\Playground\second-brain
powershell -ExecutionPolicy Bypass -File .\scripts\nvidia-embedding-smoke-test.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\index-pixiu-vault-nvidia.ps1 -Limit 5
powershell -ExecutionPolicy Bypass -File .\scripts\query-second-brain-nvidia.ps1 -Question "PixiuCore recap 要寫到哪裡？"
```

若只是先確認 chunk 管線，不打 API：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\index-pixiu-vault-nvidia.ps1 -Limit 5 -DryRun
```

## 重要決策

| 決策點 | 選擇 | 棄選方案 | 原因 |
|---|---|---|---|
| NVIDIA 預設 embedding model | `nvidia/llama-nemotron-embed-1b-v2` | `nvidia/llama-3.2-nemoretriever-300m-embed-v2` | 舊 model 在 NVIDIA Build 頁面標示 2026-05-18 後不再支援，不適合作為新預設。 |
| Qdrant collection | 新建 `second_brain_chunks_nvidia` | 沿用 `second_brain_chunks` | 舊 collection 是 1536 維；NVIDIA 新預設為 2048 維，混用會造成維度與語意空間不一致。 |
| vault 掛載模式 | n8n 內 `/pixiu-vault` 維持唯讀 | 讓 n8n 直接寫回 Pixiu vault | 避免自動 workflow 污染母體資料，索引層可重建，vault 保持 source of truth。 |
| API key 保存方式 | `.env` 或 n8n credentials | README、workflow export、vault 文件內明文 | 避免 secret 外洩；`.env` 已被 `.gitignore` 排除。 |
| 驗證策略 | 先 Qdrant 與 `-DryRun`，等 key 後再打 NVIDIA | 沒 key 時硬跑遠端 API | 目前 key 空白，先把可驗證的本機管線驗完，降低後續接 key 的不確定性。 |

## 下次 session 要做的事

優先執行：

- [ ] 將 NVIDIA API key 放進 `C:\Users\7010\Documents\Playground\second-brain\.env` 的 `NVIDIA_API_KEY=`。
- [ ] 執行 `powershell -ExecutionPolicy Bypass -File .\scripts\nvidia-embedding-smoke-test.ps1`，確認 hosted API、Qdrant upsert、query 都成功。
- [ ] 執行 `powershell -ExecutionPolicy Bypass -File .\scripts\index-pixiu-vault-nvidia.ps1 -Limit 5`，先索引 5 個 vault Markdown 做小批量驗證。
- [ ] 執行 `powershell -ExecutionPolicy Bypass -File .\scripts\query-second-brain-nvidia.ps1 -Question "PixiuCore recap 要寫到哪裡？"`，確認查詢結果能回 source path。
- [ ] 小批量成功後，再執行 `powershell -ExecutionPolicy Bypass -File .\scripts\index-pixiu-vault-nvidia.ps1` 索引整個 Pixiu vault manifest。

可並行：

- [ ] 在 n8n UI 依 `workflows/README.md` 建立 `Index Pixiu Vault` workflow。
- [ ] 在 n8n UI 建立 `Query Second Brain` webhook / form workflow。
- [ ] 評估是否加入 reranker，但不要在 embedding + Qdrant 查詢穩定前提前擴大範圍。

待使用者決策：

- [ ] NVIDIA API key 要使用 hosted NVIDIA endpoint，或日後改接本機 / 自架 NIM endpoint。
- [ ] n8n 查詢 workflow 的入口要先做 Webhook、Form Trigger，還是接 Telegram。
- [ ] 查詢結果是否要寫回 `vault/briefs/` 或 `vault/inbox/`，目前建議先不要自動寫回 vault。

## 發現的問題 / 踩坑

- PowerShell parser 發現 `index-pixiu-vault-nvidia.ps1` 初版字串 `$i:` 會被視為非法變數參考，已改為 `$($i)`。
- `qdrant-smoke-test.ps1` 初版在 collection 已存在時會報錯，已改成 idempotent。
- Word COM 在 sandbox 內啟動失敗，改以升權方式匯出 PDF 成功。
- 一開始系統 shell 找不到 `python`，後續改用 Codex bundled Python：`C:\Users\7010\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`。
- `git status` 顯示 Playground workspace 有大量既有 untracked files，這次沒有 commit，也沒有清理 unrelated files。
- NVIDIA 遠端 API smoke test 已成功；全量索引尚未執行。

## 關鍵狀態

- 專案資料夾：`C:\Users\7010\Documents\Playground\second-brain`
- PixiuCore 母體：`C:\Users\7010\Desktop\gravityTest\pixiu-core`
- 目前 branch：Playground repo 顯示為 `master`
- Docker containers：
  - `pixiu-second-brain-n8n`：Up
  - `pixiu-second-brain-qdrant`：Up
- Qdrant：
  - `second_brain_chunks`：既有 1536 維 collection
  - `second_brain_smoke_test`：測試 collection，可重跑 smoke test
  - `second_brain_chunks_nvidia`：2048 維 collection，狀態 green，points count 14
- 主要新增 / 修改檔案：
  - `second-brain/.env.example`
  - `second-brain/docker-compose.yml`
  - `second-brain/README.md`
  - `second-brain/workflows/README.md`
  - `second-brain/scripts/_second-brain-common.ps1`
  - `second-brain/scripts/nvidia-embedding-smoke-test.ps1`
  - `second-brain/scripts/index-pixiu-vault-nvidia.ps1`
  - `second-brain/scripts/query-second-brain-nvidia.ps1`
  - `second-brain/scripts/qdrant-smoke-test.ps1`
  - `second-brain/scripts/setup-env.ps1`
  - `second-brain/scripts/build-operation-manual.py`
  - `second-brain/scripts/inspect-manual-pdf.py`
  - `second-brain/out/Pixiu第二大腦_n8n_Qdrant_操作手冊.docx`
  - `second-brain/out/Pixiu第二大腦_n8n_Qdrant_操作手冊.pdf`
  - `pixiu-core/vault/memory/recaps/2026-05-11-181044-n8n-qdrant-vault-nvidia-api-progress.md`

## 補充筆記

NVIDIA 官方查證結果已納入本次實作決策：舊的 `nvidia/llama-3.2-nemoretriever-300m-embed-v2` 不再作為預設，新的腳本與文件改用 `nvidia/llama-nemotron-embed-1b-v2`。如果未來 NVIDIA model 或維度變更，應建立新的 Qdrant collection，不要把不同 embedding 空間混入同一個 collection。
## 2026-05-12 NVIDIA API key 驗證更新

- `.env` 已設定 `NVIDIA_API_KEY`；key 未寫入 vault、README、workflow export 或 recap 內容。
- `scripts\nvidia-embedding-smoke-test.ps1` 已成功呼叫 NVIDIA hosted embedding API，並寫入 / 查回 Qdrant smoke-test point。
- `scripts\index-pixiu-vault-nvidia.ps1 -Limit 5` 已成功索引前 5 份 Pixiu vault Markdown，共 13 個 chunks。
- `second_brain_chunks_nvidia` 目前 points count 為 14（13 個 vault chunks + 1 個 smoke-test point）。
- `scripts\query-second-brain-nvidia.ps1 -Question "PixiuCore recap 要寫到哪裡？"` 已成功執行；目前查詢仍未命中 recap 規則，原因是只索引前 5 份文件，尚未全量索引 `memory/recaps`。
- 下一步若要完整 RAG，可執行全量 `scripts\index-pixiu-vault-nvidia.ps1`；此步會消耗更多 NVIDIA API 額度，建議由使用者確認後再跑。
