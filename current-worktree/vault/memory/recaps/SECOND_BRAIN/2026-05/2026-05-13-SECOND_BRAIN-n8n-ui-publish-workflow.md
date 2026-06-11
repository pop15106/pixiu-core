---
type: session-recap
date: 2026-05-13
project: SECOND_BRAIN
system: SECOND_BRAIN
repo: second-brain
topic: n8n-ui-publish-workflow
status: done
tags: [recap, session, second-brain, n8n, workflow, qdrant, nvidia-api]
summary: 整理 n8n UI 發佈 workflow 的實作方式，涵蓋 code node、Qdrant 與 NVIDIA embedding 接線。
---

# Session Recap：第二大腦 n8n UI Publish Workflow

## 任務目標

使用者確認目前 n8n 網頁已能正常執行 JS code，想把前面討論出的第二大腦 n8n 流程改成可在 n8n 網頁 UI 建立、測試、publish / activate 的 workflow。

## 本次完成

1. 新增 UI workflow 操作說明：`workflows/n8n-ui-publish.md`。
   - 建議在 n8n UI 建 `Manual Trigger -> Code node`。
   - Code node 設定為 JavaScript / Run Once for All Items。
   - 測試成功後再 publish / activate。

2. 新增 Code node 內容：`workflows/code/index-pixiu-vault-nvidia-qdrant.js`。
   - 掃描 n8n container 內 `/pixiu-vault`。
   - 遞迴讀取 Markdown。
   - 取 H1 或檔名當 title。
   - 產生 hash / stable UUID。
   - 切 chunk。
   - 呼叫 NVIDIA embedding API。
   - 自動建立 Qdrant collection。
   - upsert points 到 `second_brain_chunks_nvidia`。
   - payload 只存 container path，不存 Windows host path。

3. 調整 n8n container 環境變數。
   - `NODE_FUNCTION_ALLOW_BUILTIN=fs,path,crypto,http,https`
   - `SECOND_BRAIN_INDEX_FILE_LIMIT=20`
   - `SECOND_BRAIN_INDEX_CHUNK_LIMIT=20`
   - `SECOND_BRAIN_EMBED_BATCH_SIZE=4`
   - `SECOND_BRAIN_CHUNK_CHARS=1800`
   - `SECOND_BRAIN_CHUNK_OVERLAP=200`

4. 更新設定來源。
   - `.env.example` 補上 UI workflow 需要的 env。
   - `docker-compose.yml` 將 env 傳入 n8n container。
   - `setup-env.ps1` 補預設值，既有 `.env` 缺欄位時自動追加。
   - `README.md` 與 `workflows/README.md` 加入 UI workflow 入口。

## 驗證結果

- 已重啟 n8n / Qdrant container。
- `docker exec pixiu-second-brain-n8n printenv ...` 確認 env 已套用。
- Qdrant collections 可查到 `second_brain_chunks_nvidia`。
- `workflows/code/index-pixiu-vault-nvidia-qdrant.js` JS syntax OK。
- `scripts/validate-release.ps1` 通過。
- secret scan 未發現實際 NVIDIA key；只會掃到 validate 腳本自己的 `nvapi-` 偵測 regex。

## 重要邊界

- 此版是 UI 最小閉環，適合先在 n8n 網頁測試與 publish。
- 預設只索引 20 chunks，避免一開始就全量消耗 NVIDIA API 額度。
- 要全量索引時需把 `.env` 的 `SECOND_BRAIN_INDEX_FILE_LIMIT` 與 `SECOND_BRAIN_INDEX_CHUNK_LIMIT` 改成 `0`，再重啟 n8n。
- n8n 官方文件提到 Code node 預設限制 module import；self-host 需設定 `NODE_FUNCTION_ALLOW_BUILTIN` 才能 import built-in modules。

## 下次可做

- [ ] 在 n8n UI 實際建立 workflow 並貼入 Code node。
- [ ] Execute Workflow 看是否成功輸出 `status: ok`。
- [ ] 成功後 publish / activate。
- [ ] 若要排程，自 Manual Trigger 再加 Schedule Trigger。
