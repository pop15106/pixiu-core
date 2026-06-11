---
type: session-recap
date: 2026-05-15
project: SECOND_BRAIN
system: SECOND_BRAIN
repo: second-brain
topic: sandbox-vs-antigravity-query
status: verified-local
tags: [recap, second-brain, nvidia, qdrant, sandbox, antigravity, codex]
summary: 比較 second-brain、sandbox 與 antigravity extension 的查詢邊界，釐清實際可用能力。
---

# 2026-05-15 second-brain 查詢在 sandbox 與 antigravity extension 的差異

## 背景

使用者先要求盤點第二大腦目前有什麼內容，之後追問為什麼同一套查詢腳本在這個 Codex 對話裡會失敗，但在 antigravity 的 Codex extension 內直接執行時可以成功。

本次重點不是 second-brain 內容本身，而是釐清：

1. `query-second-brain-nvidia.ps1` 實際依賴什麼。
2. 失敗點是 second-brain、Qdrant、NVIDIA API，還是執行環境權限。
3. antigravity extension 與本對話工具執行環境的差異。

## 實際確認過的事

### 1. second-brain 本地結構確實存在

`C:\Users\7010\Documents\Playground\second-brain` 內已有：

- `scripts/`
- `data/`
- `workflows/`
- `out/`
- `docker-compose.yml`
- `README.md`

而 active PixiuCore vault 內也已有與 second-brain 相關的：

- `vault/context/n8n-phase-1-second-brain-plan.md`
- `vault/memory/decisions/2026-05-11-n8n第二大腦與VectorDatabase實作計劃.md`
- `vault/memory/decisions/2026-05-12-second-brain-first-lookup-rule.md`
- `vault/memory/recaps/2026-05-12-114315-second-brain-full-index-and-ops.md`
- `vault/memory/recaps/2026-05-12-123000-second-brain-github-one-click-deploy.md`
- `vault/memory/recaps/2026-05-13-000000-second-brain-n8n-ui-publish-workflow.md`

### 2. `query-second-brain-nvidia.ps1` 的真實流程

讀腳本後確認，查詢路徑是：

```text
Question
-> query-second-brain-nvidia.ps1
-> NVIDIA embedding endpoint
-> 取得 query embedding
-> POST 到 Qdrant points/query
-> 回傳 matched chunks
```

不是單純本地全文搜尋，也不是只讀 vault Markdown。

關鍵依賴：

- `NVIDIA_EMBEDDING_ENDPOINT=https://integrate.api.nvidia.com/v1/embeddings`
- `NVIDIA_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-1b-v2`
- `NVIDIA_EMBEDDING_COLLECTION=second_brain_chunks_nvidia`
- Qdrant 預設走 `http://localhost:6333`

### 3. 失敗實際發生在哪裡

在這個 Codex 對話裡直接跑：

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\7010\Documents\Playground\second-brain\scripts\query-second-brain-nvidia.ps1 -Question "第二大腦目前有什麼內容？"
```

第一次失敗訊息是：

- `Invoke-RestMethod : Unable to connect to the remote server`

根據 `_second-brain-common.ps1`，這個錯誤出現在呼叫 NVIDIA embedding endpoint 那一步，不是在查 Qdrant。

### 4. Qdrant 本身其實是活的

`status.ps1` 輸出顯示：

- `http://localhost:6333/collections` 可正常回應
- collections 內看得到：
  - `second_brain_chunks`
  - `second_brain_chunks_nvidia`
  - `second_brain_smoke_test`

代表 second-brain 的向量索引與 Qdrant service 本身不是壞掉。

### 5. Docker 狀態檢查是另一個獨立權限問題

同一次 `status.ps1` 也出現：

- `permission denied while trying to connect to the docker API at npipe:////./pipe/docker_engine`

這表示在目前這個受限工具環境裡，查 Docker named pipe 也會被擋。

這和 NVIDIA API 外連失敗是兩條不同的限制：

- 對外網路限制
- 本機 Docker pipe 權限限制

### 6. 非 sandbox 重跑後 second-brain query 成功

改用可升權執行後，同一支 `query-second-brain-nvidia.ps1` 成功回傳結果，代表：

- `.env` 設定可用
- `NVIDIA_API_KEY` 可用
- NVIDIA endpoint 可連
- Qdrant collection 可查

也就是說，問題不在腳本內容、不在 second-brain 資料、不在 collection 遺失，而是在「這個對話工具執行時的 sandbox / 權限邊界」。

## antigravity extension 為什麼能跑

使用者補充：在 antigravity 內用 extension 的 Codex 去「茶室」直接執行腳本查 second-brain，沒有被擋住。

依這次驗證，最合理的解釋是：

1. antigravity extension 內的 Codex 執行環境更接近使用者本機實權 shell。
2. 它可以正常對外呼叫 NVIDIA embedding API。
3. 它也可以正常碰本機的 `localhost:6333`，必要時也較可能能接觸 Docker / 本機服務。

所以差異點不是 `Playground` 這個 repo 路徑本身，而是「同一支腳本由哪個入口、用什麼權限與 sandbox 規則執行」。

## 本次結論

### 結論 1

`query-second-brain-nvidia.ps1` 不是純本地查詢，它一定會先依賴 NVIDIA embedding API，因此只要執行環境禁止外連，就會失敗。

### 結論 2

本對話裡的失敗主因是 runtime sandbox / 權限限制，不是 second-brain repo、Qdrant collection、或 `.env` 壞掉。

### 結論 3

antigravity 的 Codex extension 若能直接執行成功，代表它背後的 shell 權限比這裡鬆，或至少沒有擋住：

- `integrate.api.nvidia.com:443`
- `localhost:6333`
- 可能還包含 Docker pipe 存取

### 結論 4

之後判斷「哪個入口能不能查 second-brain」時，應先看它走的是哪一類：

- 純讀本地 vault Markdown：通常不需要外網，較不容易被擋。
- `query-second-brain-nvidia.ps1`：需要 NVIDIA API + Qdrant，受 sandbox 影響大。
- `status.ps1`：除 Qdrant 外，還可能因 Docker pipe 權限被擋。

## 建議後續操作

1. 若目標是穩定查 second-brain，優先在 antigravity extension 或本機 PowerShell 直接執行查詢腳本。
2. 若在受限 agent runtime 內工作，把 second-brain query 視為可能需要 approval / trusted shell 的步驟。
3. 若只是要找規劃、決策、recap 類內容，可先直接讀 vault Markdown，避免每次都依賴 embedding API。

## 參考檔案

- `C:\Users\7010\Documents\Playground\second-brain\scripts\query-second-brain-nvidia.ps1`
- `C:\Users\7010\Documents\Playground\second-brain\scripts\_second-brain-common.ps1`
- `C:\Users\7010\Documents\Playground\second-brain\scripts\status.ps1`
- `C:\Users\7010\Documents\Playground\second-brain\README.md`
- `C:\Users\7010\Desktop\gravityTest\pixiu-core\vault\memory\decisions\2026-05-12-second-brain-first-lookup-rule.md`
