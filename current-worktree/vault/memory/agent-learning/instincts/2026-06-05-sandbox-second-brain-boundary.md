---
type: agent-instinct
date: 2026-06-05
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: sandbox-second-brain-boundary
status: active
summary: second-brain 查詢失敗時，先判斷是否為 sandbox 外連、Docker pipe 或本機服務權限邊界，不要直接判定 vault、Qdrant 或腳本壞掉。
tags: [agent-learning, instinct, second-brain, sandbox, qdrant, nvidia-api, codex]
confidence: high
supporting_observations:
  - 2026-05-15-second-brain-sandbox-vs-antigravity-query
  - 2026-05-18-pclms-bk-l4-t1-procedure-pending-recap
contradicting_observations: []
---

# Instinct - second-brain / sandbox 邊界判斷

## Trigger

當任務需要先查 second-brain，但出現：

- `Invoke-RestMethod : Unable to connect to the remote server`
- Docker named pipe 權限錯誤
- Qdrant / NVIDIA API / sandbox 之間的失敗點不明

## First Move

1. 先判斷查詢路徑是否需要 NVIDIA embedding API。
2. 若在受限 agent runtime 失敗，優先重跑一次已核可的升權 shell。
3. 若升權後成功，將原因標為 sandbox / 權限邊界，不要誤判為 second-brain 資料壞掉。
4. 若只是找 recap、decision、context，可以先直接讀 vault Markdown，避免把所有查詢都綁到外連 API。

## Rationale

`query-second-brain-nvidia.ps1` 不是純本地全文搜尋，它會先連 NVIDIA embedding endpoint，再查 Qdrant。受限環境常會擋外連或 Docker pipe，因此錯誤訊息容易被誤解。

## Boundaries

- 若 `localhost:6333` 本身也無法回應，需另查 Qdrant service。
- 若升權後仍失敗，才回頭檢查 `.env`、NVIDIA API key、collection 與腳本。

## Evidence Base

- `vault/memory/recaps/2026-05-15-113517-second-brain-sandbox-vs-antigravity-query.md`
- `vault/memory/recaps/2026-05-18-142719-pclms-bk-l4-t1-procedure-pending-recap.md`

## Promotion Rule

若後續再次因 sandbox 導致 second-brain 誤判，升格成 `vault/sop/second-brain-runtime-checklist.md`。
