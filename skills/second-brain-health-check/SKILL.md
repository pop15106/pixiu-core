---
name: second-brain-health-check
description: Use when checking whether the second brain is usable, when query-second-brain-nvidia.ps1 fails, or when diagnosing Qdrant, n8n, NVIDIA embedding, sandbox, runtime, or connectivity boundaries.
---

# Second Brain Health Check

## Core Rule

Separate "query failed" from "second-brain has no data". The query path has three layers: remote embedding endpoint, local Qdrant, and local n8n/workflow runtime.

## Minimal Live Check

Run or report these checks in order:

1. Query script:
   ```powershell
   # 請依本機路徑調整，或設定環境變數 SECOND_BRAIN_PATH
   powershell -ExecutionPolicy Bypass -File "$env:SECOND_BRAIN_PATH\scripts\query-second-brain-nvidia.ps1" -Question "<question>"
   ```
2. Qdrant health:
   ```powershell
   Invoke-RestMethod http://localhost:6333/collections
   ```
3. n8n health:
   ```powershell
   Invoke-WebRequest http://localhost:5678
   ```

If the query script fails with `Unable to connect to the remote server` but Qdrant/n8n are healthy, suspect remote embedding or sandbox/runtime network boundary before suspecting missing data.

## Evidence Rules

- Treat second-brain results as leads only.
- For final conclusions, return to vault files, accepted decisions, repo files, logs, SQL, or rollout evidence.
- If the user asks "can you connect?", answer yes/no with the checked layer and failure point.
- Do not describe second-brain as always-on. It is an on-demand query workflow.

## Output Contract

```text
狀態：可用 / 部分可用 / 不可用
查詢腳本：
Qdrant：
n8n：
判斷：
下一步：
```
