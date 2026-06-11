---
type: decision
date: 2026-05-12
project: SECOND_BRAIN
system: SECOND_BRAIN
repo: second-brain
topic: second-brain-first-lookup-rule
status: accepted
decision: 第二大腦先查規則
choice: 除單純翻譯、格式整理、目前時間、明確單一檔案小修等自足任務外，遇到需要背景脈絡、歷史決策、專案規則、舊調查、recap 或跨專案記憶的問題，AI 必須先查第二大腦，再回讀命中的 vault 原文或 repo 原始碼驗證。
summary: 第二大腦先查規則：除單純翻譯、格式整理、目前時間、明確單一檔案小修等自足任務外，遇到需要背景脈絡、歷史決策、專案規則、舊調查、recap 或跨專案記憶的問題，AI 必須先查第二大腦，再回讀命中的 vault 原文或…
tags: [decision, second-brain, user-rules, codex, claude, gemini]
---

# Decision：第二大腦先查規則

## 決策

除單純翻譯、格式整理、目前時間、明確單一檔案小修等自足任務外，遇到需要背景脈絡、歷史決策、專案規則、舊調查、recap 或跨專案記憶的問題，AI 必須先查第二大腦，再回讀命中的 vault 原文或 repo 原始碼驗證。

## 實作落點

- 母體共同規則：`%PIXIU_CORE%\user_rules.md`
- Codex 全域入口：`C:\Users\7010\.codex\AGENTS.md`
- Playground 專案入口：`C:\Users\7010\Documents\Playground\AGENTS.md`
- Claude 入口：`C:\Users\7010\.claude\CLAUDE.md`、`C:\Users\7010\.claude\AGENTS.md`
- Gemini 入口：`C:\Users\7010\.gemini\GEMINI.md`

## 邊界

- 第二大腦查詢結果是線索與入口，不是最終結論。
- 不得只憑 score、摘要或單一命中片段回答。
- Source of truth 仍是 PixiuCore vault 與對應 repo；Qdrant 是可重建索引。
- API key 不寫入任何 rules / AGENTS / recap / decision 文件。

## 2026-05-15 執行注意：AI runtime sandbox 與 NVIDIA embedding endpoint

`query-second-brain-nvidia.ps1` 的查詢流程會先呼叫 `NVIDIA_EMBEDDING_ENDPOINT` 產生 query embedding，再拿向量查本機 Qdrant。因此 Docker Desktop 顯示 n8n / Qdrant 正常，不代表 AI 執行環境內一定能完成查詢；若 Gemini、Claude、Codex 或其他 agent runtime 的 sandbox / shell 權限無法連外到 `integrate.api.nvidia.com:443`，會在 embedding 階段出現 `Unable to connect to the remote server`。

遇到這種錯誤時，不要解讀成「第二大腦沒有資料」或「Qdrant 沒啟動」。應先分層檢查：

- `http://localhost:6333/collections` 是否能列出 Qdrant collections。
- `http://localhost:5678` 是否能開啟 n8n。
- `integrate.api.nvidia.com:443` 是否能從主機網路連線。
- 若本機服務正常、只有 NVIDIA endpoint 在 AI sandbox 失敗，應使用該 AI 工具的權限提升 / approval / trusted command 機制，以主機網路執行 second-brain 查詢腳本。

建議對 Gemini、Claude、Codex 都採同一個安全邊界：只針對以下窄範圍命令建立允許，而不是開放整個 PowerShell 或任意網路命令：

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\7010\Documents\Playground\second-brain\scripts\query-second-brain-nvidia.ps1
```

這個權限只解決查詢腳本的主機網路連線問題；查詢結果仍必須回讀 vault 原文或 repo source 驗證後才能下結論。
