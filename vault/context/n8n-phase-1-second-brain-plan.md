---
type: implementation-plan
date: 2026-05-11
project: SECOND_BRAIN
system: SECOND_BRAIN
repo: second-brain
topic: n8n-phase-1-second-brain-plan
status: draft
summary: 規劃 n8n 第二大腦 Phase 1 最小閉環，聚焦素材進入 vault 後的回饋流程。
tags: [pixiucore, n8n, second-brain, qwen, automation, daily-brief]
---

# n8n Phase 1 第二大腦最小閉環實作計劃

## 目標

Phase 1 先驗證一件事：素材進入 PixiuCore vault 後，AI 能不能穩定把洞見推回來。

本階段只建立最小回饋閉環，不做完整知識圖譜、不做 embedding、不做 vector DB，也不自架模型。

預期流程：

```text
手動素材 / Telegram / Webhook
  -> n8n 接收
  -> 寫成 Markdown
  -> 放進 PixiuCore vault/inbox
  -> 呼叫 Qwen API
  -> 產生 Daily Brief
  -> 寫回 PixiuCore vault/briefs
```

## 採用方向

- n8n 採本機 self-host。
- n8n 用 Docker Desktop 跑在 Windows 電腦上。
- AI 使用 Qwen API，不使用本機 Ollama / vLLM / Gemma 自建。
- n8n 透過 Docker volume mount 直接讀寫 PixiuCore vault。
- 第一階段只處理最近內容，不掃全 vault。

## 不做的事

- 不建立 knowledge graph nodes / edges。
- 不建立 vector DB。
- 不跑 embedding pipeline。
- 不做 2D / 3D 星系視覺化。
- 不重構既有 PixiuCore vault 結構。
- 不把 API key 寫進 vault 或 workflow 明文。
- 不先公開 n8n 到外網。

## 本機安裝架構

建議 n8n 專案放在：

```text
C:\Users\7010\Documents\n8n-local
```

PixiuCore vault 掛載到 container 內：

```text
C:\Users\7010\Desktop\gravityTest\pixiu-core\vault
  -> /pixiu-vault
```

n8n workflow 內讀寫檔案時，使用 container 內路徑：

```text
/pixiu-vault/inbox/...
/pixiu-vault/captures/...
/pixiu-vault/briefs/...
```

## Vault 新增資料夾

Phase 1 建議新增三個資料夾：

```text
vault/inbox/
vault/captures/
vault/briefs/
```

用途：

- `inbox/`：未處理素材、快速想法、臨時貼文。
- `captures/`：整理後的外部素材，例如文章、tweet、逐字稿。
- `briefs/`：Daily Brief / Weekly Synthesis 輸出。

這三個資料夾是第二大腦擴充層，不取代既有：

- `vault/memory/recaps/`
- `vault/memory/decisions/`
- `vault/context/`
- `vault/sop/`
- `vault/identity/`

## Capture Markdown 格式

n8n 寫入 `vault/inbox/` 時，使用固定 frontmatter。

```markdown
---
type: capture
date: 2026-05-11
source: telegram
status: inbox
tags: [capture]
---

# Quick Capture - 2026-05-11 0900

## Raw Content

原始內容放這裡
```

最小欄位：

- `type`：固定 `capture`。
- `date`：捕捉日期。
- `source`：來源，例如 `telegram`、`webhook`、`manual`。
- `status`：第一階段固定 `inbox`。
- `tags`：至少包含 `capture`。

## Workflow A：快速捕捉

目的：把手機或外部入口丟進來的內容轉成 Markdown，寫入 `vault/inbox/`。

第一版節點：

```text
Webhook Trigger 或 Telegram Trigger
  -> Code node：整理檔名、日期、frontmatter、Markdown body
  -> Write File node：寫入 /pixiu-vault/inbox/YYYY-MM-DD-HHMMSS-source.md
```

第一版先以 Webhook 為主，Telegram 可以第二步接。

Webhook 優點：

- 不需要先處理 Telegram bot 設定。
- 可先用 Postman、curl、瀏覽器或 n8n test event 測。
- 適合驗證寫檔權限與 Markdown 格式。

Telegram 後續再加入：

```text
Telegram Trigger
  -> Normalize message
  -> 共用同一段 Markdown formatter
  -> Write File
```

## Workflow B：Daily Brief

目的：每天固定時間讀最近素材，呼叫 Qwen API 產生簡報，寫回 `vault/briefs/`。

第一版節點：

```text
Schedule Trigger：每日 06:00 Asia/Taipei
  -> Read Files：讀 /pixiu-vault/inbox 最近 24 小時
  -> Read Files：讀 /pixiu-vault/captures 最近 7 天
  -> Code node：合併內容並限制長度
  -> HTTP Request：呼叫 Qwen API
  -> Code node：包成 Markdown
  -> Write File：寫入 /pixiu-vault/briefs/YYYY-MM-DD-daily-brief.md
```

第一版 Daily Brief 格式：

```markdown
---
type: daily-brief
date: YYYY-MM-DD
source: n8n-qwen
tags: [daily-brief, second-brain]
---

# Daily Brief - YYYY-MM-DD

## Connections

最近素材之間或近期素材與舊素材之間的 3 個關聯。

## Pattern

這週反覆出現的一個主題。

## Question

今天值得思考的一個問題。
```

## Qwen API 串接

n8n 使用 HTTP Request node 呼叫 Qwen OpenAI-compatible API。

API key 放在 n8n credentials 或環境變數，不寫進 vault。

概念請求：

```http
POST /compatible-mode/v1/chat/completions
Authorization: Bearer <QWEN_API_KEY>
Content-Type: application/json
```

概念 payload：

```json
{
  "model": "qwen3.6-plus",
  "messages": [
    {
      "role": "system",
      "content": "你是 PixiuCore 的第二大腦簡報助手，請用繁體中文輸出 Markdown。"
    },
    {
      "role": "user",
      "content": "根據以下最近素材產生 Daily Brief：..."
    }
  ]
}
```

模型選擇暫定：

- 預設：`qwen3.6-plus`
- 成本敏感：`qwen3.6-flash`
- 複雜 synthesis 再考慮更高階模型

實際 model name 需以申請 API 時的 Qwen / DashScope 後台可用清單為準。

## Docker Compose 草案

目標目錄：

```text
C:\Users\7010\Documents\n8n-local
```

`.env`：

```env
GENERIC_TIMEZONE=Asia/Taipei
N8N_ENCRYPTION_KEY=請換成一串很長的隨機字串
```

`compose.yaml`：

```yaml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n:stable
    restart: unless-stopped
    ports:
      - "127.0.0.1:5678:5678"
    environment:
      - GENERIC_TIMEZONE=${GENERIC_TIMEZONE}
      - TZ=${GENERIC_TIMEZONE}
      - N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
      - N8N_RUNNERS_ENABLED=true
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
    volumes:
      - n8n_data:/home/node/.n8n
      - "C:/Users/7010/Desktop/gravityTest/pixiu-core/vault:/pixiu-vault"

volumes:
  n8n_data:
```

啟動：

```powershell
cd C:\Users\7010\Documents\n8n-local
docker compose up -d
```

開啟：

```text
http://localhost:5678
```

停止：

```powershell
docker compose stop
```

看 log：

```powershell
docker compose logs -f n8n
```

## 安全原則

- 第一階段只綁 `127.0.0.1:5678`，不對外開放。
- Qwen API key 只放 n8n credentials 或環境變數。
- `N8N_ENCRYPTION_KEY` 必須備份，遺失會造成 credentials 無法解密。
- 不把 `.env` 放進 PixiuCore vault。
- 不把 n8n workflow export 內含 secret 的版本放進 git。

## 驗收標準

Phase 1 完成條件：

- n8n 可在本機 `http://localhost:5678` 開啟。
- n8n container 可寫入 `/pixiu-vault/inbox/`。
- Webhook 測試 payload 可生成一份 capture Markdown。
- Daily Brief workflow 可呼叫 Qwen API。
- `vault/briefs/YYYY-MM-DD-daily-brief.md` 能生成並被 Obsidian 看見。
- brief 至少包含 `Connections`、`Pattern`、`Question` 三段。

## 風險與處理

| 風險 | 說明 | 處理 |
|---|---|---|
| Docker Desktop 未安裝或 WSL2 未啟用 | n8n 無法啟動 | 先完成 Docker Desktop + WSL2 |
| n8n container 寫不到 vault | volume mount 路徑錯誤或權限問題 | 先用 Write File 測 `/pixiu-vault/test.md` |
| API key 外洩 | workflow 或 vault 誤存 secret | API key 只放 credentials / env |
| Daily Brief token 過大 | 讀入太多 Markdown | Phase 1 只讀最近 24 小時與 7 天 captures，並在 Code node 限長 |
| Brief 變成普通摘要 | prompt 不夠明確 | 固定要求 connections / pattern / question |
| n8n 外網 webhook 不通 | 本機未公開 | Phase 1 先不用外網 webhook，Telegram / tunnel 後置 |

## 待討論

- n8n 入口第一版要先用 Webhook 還是 Telegram？
- `vault/inbox/`、`vault/captures/`、`vault/briefs/` 是否現在就新增？
- Daily Brief 是每日自動跑，還是先手動按一次測？
- Qwen API 使用哪個帳號與哪個 region？
- 是否需要把 workflow export 存成不含 secret 的模板？

## 下一階段候選

Phase 2 可再補：

- Telegram bot quick capture。
- Weekly Synthesis。
- 從 `memory/decisions` 與 `memory/recaps` 抽舊內容做關聯。
- capture 狀態流轉：`inbox -> processed -> linked`。
- 初版 graph schema：node / edge / relation type。
