---
type: session-recap
date: 2026-05-12
project: SECOND_BRAIN
system: SECOND_BRAIN
repo: second-brain
topic: full-index-and-ops
status: done
tags: [recap, session, second-brain, qdrant, nvidia-api, encoding, n8n, pixiu-vault]
summary: 完成 second-brain 全量索引與操作面盤點，補齊 NVIDIA API、Qdrant 與 UTF-8 流程驗證。
---

# Session Recap：第二大腦全量索引、UTF-8 修正與使用方式確認

## 任務目標與背景

本次 session 接續第二大腦建置，使用者提供 NVIDIA API key 後，目標是驗證 hosted embedding API、把 PixiuCore 母體 vault 全量同步進 Qdrant，並釐清第二大腦與「直接讀 vault」的差異、日後怎麼透過 Antigravity / Codex extension 使用，以及是否仍需要 recap 與 n8n 定時同步。

重要安全原則：使用者提供的 NVIDIA API key 只寫入本機 `C:\Users\7010\Documents\Playground\second-brain\.env`，未寫入 vault、README、recap、workflow export 或任何可同步文件。

## 本次完成

1. NVIDIA API key 已接入本機 `.env`。
   - 寫入位置：`C:\Users\7010\Documents\Playground\second-brain\.env`
   - recap / summary 僅記錄「已設定 key」，不保存 key 內容。

2. NVIDIA hosted embedding API smoke test 成功。
   - 指令：`powershell -ExecutionPolicy Bypass -File .\scripts\nvidia-embedding-smoke-test.ps1`
   - 結果：成功產生 passage / query embedding，寫入並查回 Qdrant smoke-test point。

3. PixiuCore vault 已全量索引進 Qdrant。
   - collection：`second_brain_chunks_nvidia`
   - points count：`204`
   - vector size：`2048`
   - distance：`Cosine`
   - Qdrant 狀態：`green`

4. 查詢流程已可用。
   - 指令範例：`powershell -ExecutionPolicy Bypass -File .\scripts\query-second-brain-nvidia.ps1 -Question "請幫我看保證金的邏輯"`
   - 查詢能命中 PCLMS 相關 recap，例如 `PCLMS_AP庫存核銷手動調整根因清查`。
   - 已向使用者說明：score 是語意相似度，不是答案正確率或百分比；低分結果只能當線索。

5. 修正 Qdrant payload 中文亂碼 / 問號問題。
   - 源頭 Markdown 檢查正常，沒有 literal `?` 或 replacement char。
   - 問題根因是 Windows PowerShell 送 / 讀 JSON 時未明確使用 UTF-8。
   - 已修正 `scripts\_second-brain-common.ps1`，新增 / 調整 UTF-8 JSON request / response 處理。
   - 已更新並驗證：`index-pixiu-vault-nvidia.ps1`、`nvidia-embedding-smoke-test.ps1`、`query-second-brain-nvidia.ps1`。
   - 重新索引後，Qdrant payload 中文標題與 text 已可正常顯示。

6. 釐清第二大腦的資料來源與運作方式。
   - 主要資料來源是 PixiuCore 母體 vault：`C:\Users\7010\Desktop\gravityTest\pixiu-core\vault`
   - 第二大腦是旁路索引：只讀 vault、切 chunk、送 NVIDIA embedding、寫入 Qdrant。
   - Qdrant 是可重建索引，不是母體；source of truth 仍是 vault Markdown。
   - 目前不包含 repo 原始碼、資料庫、Word/PDF/PPTX，除非未來擴充 ingestion pipeline。

7. 釐清與「直接讀 vault」的差異。
   - 直接讀 vault：用 `rg` / 檔名 / 關鍵字搜尋，精準但需要猜關鍵字。
   - 第二大腦：用語意搜尋，能找意思相近的 recap / context / decision，適合作為追查入口。
   - 最佳使用方式：第二大腦找方向，再讀原文與 repo trace 驗證。

8. 釐清 recap 與 n8n 定時同步的分工。
   - recap 仍需要在重要工作節點由使用者觸發，由 AI 寫入母體 vault。
   - n8n / 排程負責把已存在的 vault Markdown 同步成 Qdrant 索引，不取代人類語意整理。
   - 建議節奏：完成工作 → `recap` → 寫入 vault → 排程同步索引 → 下次語意搜尋可找回。

9. 說明 Antigravity / Codex extension 使用方式。
   - 可透過本機 PowerShell 指令使用第二大腦：`query-second-brain-nvidia.ps1 -Question "..."`
   - 條件是 Antigravity 裡的 Codex extension 能讀取本機路徑、執行 shell、連到 `localhost:6333` 與 NVIDIA API。
   - 建議在 Antigravity workspace 的 `AGENTS.md` 補上第二大腦查詢規則。

10. 釐清 n8n 定時同步設定。
    - 目前索引腳本是 Windows PowerShell，n8n container 是 Linux / Docker 環境，不能直接跑 `.ps1`。
    - 短期推薦：用 Windows 工作排程器定時跑 `index-pixiu-vault-nvidia.ps1`。
    - 長期可選：把索引流程搬成 n8n-native workflow（Schedule Trigger → 讀 `/pixiu-vault` → 切 chunk → NVIDIA HTTP Request → Qdrant upsert）。

## 目前架構狀態

```text
PixiuCore vault Markdown
  -> export-pixiu-vault-manifest.ps1
  -> pixiu-vault-manifest.jsonl
  -> index-pixiu-vault-nvidia.ps1
  -> chunk text
  -> NVIDIA embedding API
  -> Qdrant second_brain_chunks_nvidia
  -> query-second-brain-nvidia.ps1
```

目前第二大腦已可回答「哪裡可能有線索」，但不能取代 repo tracing。業務題仍需讀命中的 recap / context，再進 PCLMS_AP / PCLMS_BK repo 串 UI、API、service、SQL、table mapping。

## 重要決策

| 決策點 | 選擇 | 棄選方案 | 原因 |
|---|---|---|---|
| API key 保存 | 只放 `.env` | 寫入 vault / recap / README | 避免 secret 外洩 |
| 母體接法 | 只讀 PixiuCore vault | 讓索引流程改寫母體 md | 保護 source of truth |
| 定時同步 | 先用 Windows 工作排程器 | 立即重做 n8n-native workflow | 目前 `.ps1` 已驗證，成本最低 |
| 查詢使用方式 | 第二大腦先找方向，再 repo trace | 直接把 top-k 當答案 | score 是相似度，不是正確率 |
| recap 角色 | 仍由人觸發、AI 整理 | 交給 n8n 自動替代 | recap 需要判斷結論、決策、踩坑與下一步 |

## 踩坑與修正

- Qdrant dashboard 出現 `?` 或 PowerShell 查詢出現 `ç¬¬...`，根因是 PowerShell JSON UTF-8 編碼處理；已改 helper 明確用 UTF-8 bytes 與 UTF-8 response reader。
- Qdrant payload 修正後需重跑索引覆蓋舊 payload；穩定 point id 可避免同一份文件重複長出多份 points。
- 全量索引會消耗 NVIDIA API 額度，之後建議由使用者確認排程頻率。

## 下次 session 要做的事

- [ ] 若要定時同步，建立 Windows Task Scheduler 任務跑 `index-pixiu-vault-nvidia.ps1`。
- [ ] 若要讓 Antigravity 直接使用，將第二大腦查詢規則寫入對應 workspace 的 `AGENTS.md`。
- [ ] 若常查 PCLMS 業務邏輯，可考慮新增 rerank / keyword hybrid search，但先不要急著擴大。
- [ ] 若 vault Markdown 數量持續增加，評估增量索引策略，避免每天全量重算 embedding。

## 關鍵狀態

- PixiuCore 母體：`C:\Users\7010\Desktop\gravityTest\pixiu-core`
- vault 來源：`C:\Users\7010\Desktop\gravityTest\pixiu-core\vault`
- second-brain workspace：`C:\Users\7010\Documents\Playground\second-brain`
- Qdrant collection：`second_brain_chunks_nvidia`
- Qdrant points count：`204`
- NVIDIA model：`nvidia/llama-nemotron-embed-1b-v2`
- 向量維度：`2048`
- API key：已在 `.env` 設定；不可寫入 vault / recap / README。