# Pixiu Chat Bridge｜Native Chat Probe Handoff

日期：2026-09-23  
Repo：`pop15106/pixiu-core`  
模式：Git fallback / no Agent / no subagent

## 目標

驗證 Codex App 是否可在不使用 OpenAI API Key 的前提下，將訊息自動送到既有 ChatGPT Chat，並自動讀回回覆。

## 已確認

### Probe

```json
{"probeId":"pixiu-native-chat-20260919-01","received":true}
```

2026-09-19 的原生連線測試中：

- Chat 端收到指定 `probeId`。
- Chat 端依協議原樣回傳指定單行 JSON。
- Probe 過程沒有要求 Chat 使用工具、修改檔案或執行其他工作。

## 尚未完成驗證

目前不能只依 Chat 端的收到／回覆結果，宣告整條 Native Chat Bridge 已驗收完成。仍需補齊：

- Codex App 自動讀回 Chat 回覆。
- 證明沒有人工 copy/paste。
- 證明沒有使用 OpenAI API Key。
- 記錄實際 transport / session 身分。
- 一般文字 round trip。
- multi-turn round trip。
- context sharing / isolation。
- failure / timeout / stale response handling。

## 下一個驗收 Gate

下一個 native probe 必須由 Codex 端留下可重現結果：

```text
PROBE_ID       = <unique id>
SEND           = PASS
CHAT_RECEIVED  = PASS
READ_BACK      = PASS
API_KEY_USED   = false
MANUAL_COPY    = false
TRANSPORT      = <actual transport>
RESULT         = PASS
```

只有 `READ_BACK = PASS` 且 transport/auth 證據齊全，才可將「原生單輪 Round Trip」標為 VERIFIED。

## 接續實作範圍

Git-only 接力先完成可離線驗證的 Bridge 基礎：

1. Native probe request / response schema。
2. Probe ledger 與唯一 `probeId`。
3. Response correlation、timeout、stale response 防護。
4. 不含 API Key 的 transport evidence 欄位。
5. CLI / library 層測試。
6. GitHub Actions 可執行的 synthetic round-trip 測試。
7. Native App 真實 E2E 保留為最後實機 Gate，不以 synthetic 測試冒充。

## 完成定義

- Synthetic bridge：CI 綠燈。
- Native bridge：Codex App 真實 round-trip 有可重現證據後才宣告完成。
