# Pixiu Chat Bridge｜Native Chat Probe Handoff

日期：2026-09-23  
Repo：`pop15106/pixiu-core`  
模式：Git fallback / CR 完整自動接力 / no Agent / no subagent

## 目標

驗證 Codex App 是否可在不使用 OpenAI API Key、也不靠人工 copy/paste 的前提下，
將訊息自動送到既有 ChatGPT Chat，並由 Codex 自動讀回答覆。

本輪工作依 `Pixiu-Chat-Bridge-Audit-20260923` 收斂「驗證骨架與防誤判」。
**本輪 hardening 可以完成，但 Native Chat E2E 本身仍未完成。**

## 2026-09-19 Chat 端 Probe

```json
{"probeId":"pixiu-native-chat-20260919-01","received":true}
```

已確認：

- Chat 收到指定 `probeId`。
- Chat 依協議回傳指定 JSON。

未由這次 probe 單獨證明：

- Codex 是否自動 read-back。
- 是否完全沒有人工 copy/paste。
- 實際 transport / auth session。
- 是否未使用 API Key。

因此不能用 2026-09-19 的結果宣告 Native round-trip VERIFIED。

# 2026-09-23 CR Hardening

## 已修正

### 1. GitHub Actions

原 workflow 曾把換行寫成字面 `\n`，舊 Run `35834864462` 為 failure。

已重建為有效 YAML，Node 22 執行：

```bash
node --test scripts/codex-bridge/pixiu-chat-bridge.test.js
node scripts/codex-bridge/pixiu-chat-probe.js synthetic
node scripts/critical-relay/critical-relay.js check docs/validation/20260923-pixiu-chat-bridge-cr-state.json
```

目前已取得真正的成功證據：

- Run `35837910802`：Bridge tests + synthetic probe success。
- Run `35838613880`：Bridge tests + synthetic probe + **Critical Relay completion gate** 全數 success。

## 2. Native 假成功

已移除「呼叫者只傳 `nativeAttested=true` 就能得到 `nativeVerified=true`」的語意。

目前：

```text
nativeVerified = false
```

只要真正受信任的 native adapter 尚不存在，就維持 fail-closed。
CLI、mock、JSON evidence、legacy `nativeAttested` 都不能把它升級成 true。

## 3. Evidence 嚴格型別

必要 evidence：

- `transport`
- `authMode`
- `apiKeyUsed`
- `manualCopy`
- `readBack`

現在：

- boolean 欄位必須是真正 boolean。
- 缺欄位會 FAIL。
- 字串 `"true"` / `"false"` 不會被當成安全值。
- `evidence=null` 會得到結構化 FAIL，不會 TypeError。
- transport / authMode 使用 allowlist 與配對檢查。
- 過長 transport / authMode 不會原樣存入 ledger。
- `sessionFingerprint` 只接受 SHA-256 格式。

## 4. Timeout 與終態

已加入：

- 送出前 expiry 檢查。
- send / read / evidence 共用 deadline。
- read 永不回覆時會 timeout。
- cancel 為 best-effort，自己也有等待上限。
- send / read throw 會記錄 `FAILED`。
- timeout 會記錄 `FAILED`。
- live verify 使用可信系統時鐘。
- `respondedAt` 不能早於 request，也不能晚於 expiresAt。

## 5. Replay / Idempotency

每個 probe 會建立隔離 state。

相同 `probeId` 再執行時：

- 不會再次 send。
- 回傳 `PROBE_REPLAY`。
- 需要重試時必須建立新的 probeId。

若 send timeout 導致 outcome unknown，也不自動重送。

## 6. Ledger / Secret 防護

Ledger：

`state/chat-bridge/probe-ledger.jsonl`

另有 per-probe state：

`state/chat-bridge/probes/`

兩者均位於 `state/`，repo 已忽略。

現在：

- evidence 只保存白名單欄位。
- 無效 fingerprint 不原樣保存。
- 過長／未知 transport 不原樣保存。
- adapter error 中常見 Authorization、API key、token、cookie、secret、password 會遮罩。
- 回歸測試使用 canary marker 驗證原始敏感字串不落 ledger。

## 7. CLI fail-closed

`verify` 與 `synthetic` 都會依結果回傳正確 exit code。

未知 CLI command：

```text
exit code = 2
```

Synthetic success 必須同時符合：

```text
result           = PASS
protocolVerified = true
nativeVerified   = false
```

# Regression

目前 GitHub Actions 已跑：

```text
tests 27
pass  27
fail  0
```

涵蓋：

- probeId / nonce correlation
- fake native success
- missing / wrong-type evidence
- unknown transport / authMode
- fingerprint 格式
- expiresAt / respondedAt 時間順序
- pre-send expired
- hanging read
- hanging cancel
- send/read failure terminal
- replay
- ledger canary
- trusted live clock
- synthetic/native 邊界
- CLI exit code

# Critical Relay

Canonical state：

`docs/validation/20260923-pixiu-chat-bridge-cr-state.json`

目前 state 已留下：

- claims / assumptions
- evidence / counterEvidence
- challenges
- unknowns
- tests
- completion criteria
- remaining risk
- phaseHistory：包含 `VERIFY → RECHALLENGE`

Workflow 已把：

```bash
node scripts/critical-relay/critical-relay.js check docs/validation/20260923-pixiu-chat-bridge-cr-state.json
```

列為必要 gate。

Run `35838613880` 已證明該 gate 成功。

# Native Transport 能力邊界

2026-09-23 重新查 OpenAI 官方公開文件。

已確認：

1. Codex `app-server` 可建立／續接 Codex thread、啟動 turn、接收事件與核准。
2. 新版桌面 App 可在 ChatGPT / Codex 間切換。
3. Codex history 與 ChatGPT history 仍是分開的 view。

尚未從官方公開文件找到：

> 「程式化指定一個既有 ChatGPT Chat，送入訊息，並由 Codex App 自動讀回答覆」

的正式介面。

因此目前明確不做：

- 未公開 IPC。
- 內部未公開 API。
- UI automation 冒充 native API。
- 把 Codex app-server 的 Codex thread 當成既有 ChatGPT Chat。

官方參考：

- https://developers.openai.com/zh-Hant/blog/codex-as-a-platform
- https://help.openai.com/en/articles/20001275/

# Native 最終 Gate

Native App 真實 E2E 仍需：

```text
PROBE_ID          = <unique id>
SEND              = PASS
CHAT_RECEIVED     = PASS
READ_BACK         = PASS
API_KEY_USED      = false
MANUAL_COPY       = false
TRANSPORT         = <實際 native transport>
RUNTIME_RECEIPT   = <可核對證據>
PROTOCOL_VERIFIED = true
NATIVE_VERIFIED   = true
```

在取得正式 transport 前：

**Native transport：【資料不足，無法確認】**

# 完成狀態

## 本輪 CR Hardening

- Bridge protocol hardening：完成。
- Evidence fail-closed：完成。
- Timeout / FAILED terminal：完成。
- Replay：完成。
- Log 防護：完成。
- CLI exit code：完成。
- GitHub Actions：已驗證成功。
- Critical Relay completion gate：已驗證成功。
- Agent / subagent：未使用。

## Native Chat Bridge

- Synthetic / protocol verification：完成。
- 真實 Codex App → existing ChatGPT Chat → Codex read-back：**未完成**。
- 原因：目前官方公開介面不足以建立可驗證的 existing-Chat native transport。

後續只有在 OpenAI 公開可用的正式 transport 後，才新增 native adapter 與真實 E2E。


# CR 最終完成驗證

Canonical state 已於 2026-09-23 升級為：

```text
phase  = COMPLETE
status = completed
```

最終 state self-check：

- Commit：`c63235870592bc1b926455b0c5bf3428fc31d691`
- GitHub Actions Run：`35838925634`（Run 40）
- Protocol / regression tests：success
- Synthetic probe：success
- Critical Relay completion gate：success
- Run conclusion：success

因此本輪 **Pixiu Chat Bridge CR hardening 任務**可視為完成。

此完成狀態不改變 Native 功能邊界：

```text
protocolVerified = 可驗證
nativeVerified   = false
Native E2E       = 未完成
```

Native E2E 仍等待官方可驗證的 existing-Chat programmatic transport。
