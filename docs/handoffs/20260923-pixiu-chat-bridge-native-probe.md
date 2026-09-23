# Pixiu Chat Bridge｜Native Chat Probe Handoff

日期：2026-09-23  
Repo：`pop15106/pixiu-core`  
模式：Git fallback / no Agent / no subagent

## 目標

驗證 Codex App 是否可在不使用 OpenAI API Key 的前提下，將訊息自動送到既有 ChatGPT Chat，並自動讀回回覆。

## 2026-09-19 已確認的 Chat 端 Probe

```json
{"probeId":"pixiu-native-chat-20260919-01","received":true}
```

已確認：

- Chat 端收到指定 `probeId`。
- Chat 端依協議原樣回傳指定單行 JSON。
- Probe 過程沒有要求 Chat 使用工具、修改檔案或執行其他工作。

這只能證明「Chat 收到 + Chat 回覆」，不能單獨證明 Codex App 已自動 read-back。

## 2026-09-23 已完成實作

### Bridge protocol

檔案：

- `scripts/codex-bridge/pixiu-chat-bridge.js`
- `scripts/codex-bridge/pixiu-chat-probe.js`
- `scripts/codex-bridge/pixiu-chat-bridge.test.js`

已完成：

- Native probe request / response schema。
- 唯一 `probeId` + `nonce` correlation。
- TTL / stale response gate。
- API Key 使用路徑拒絕。
- 人工 copy/paste 路徑拒絕。
- Codex read-back evidence gate。
- transport / authMode evidence gate。
- ledger 寫入 `state/chat-bridge/probe-ledger.jsonl`。
- ledger 只保留白名單 evidence，不保存任意 Authorization／Cookie／Secret 欄位。
- `state/` 已由 repo `.gitignore` 排除。

### Protocol 與 Native 驗證分離

目前明確區分：

- `protocolVerified=true`：協議、correlation、TTL 與 evidence 規則通過。
- `nativeVerified=true`：除了 protocol gate，還必須由受信任 Codex App runtime adapter 提供 attestation。

CLI 或手填 JSON 無法直接把 `nativeVerified` 設成 true。

synthetic transport 即使 protocol PASS，也只會：

```text
protocolVerified = true
nativeVerified   = false
ledger event     = PROTOCOL_VERIFIED
```

不得冒充 `NATIVE_VERIFIED`。

### CLI

```bash
node scripts/codex-bridge/pixiu-chat-probe.js create
node scripts/codex-bridge/pixiu-chat-probe.js verify < verification-input.json
node scripts/codex-bridge/pixiu-chat-probe.js synthetic
```

`verify` CLI 只做 protocol evidence 驗證，不接受 native runtime attestation。

### CI

已新增：

`.github/workflows/pixiu-chat-bridge.yml`

內容會執行：

```bash
node --test scripts/codex-bridge/pixiu-chat-bridge.test.js
node scripts/codex-bridge/pixiu-chat-probe.js synthetic
```

GitHub connector 目前無法取得本次 push 型 Actions run／check-run，因此不能把「workflow 檔已存在」宣稱為「GitHub Actions 已綠燈」。

先前為了取得 PR 型 run 建立的 PR #10 已關閉，原因是後續 hardening 已直接進入 master，該驗證分支內容已過時。

## 驗證結果

2026-09-23 以與 master 相同的 Bridge／test 內容執行：

```text
Node.js: v22.16.0
node --test scripts/codex-bridge/pixiu-chat-bridge.test.js

tests: 12
pass: 12
fail: 0
```

另外執行 synthetic CLI：

```text
result           = PASS
protocolVerified = true
nativeVerified   = false
transport        = synthetic
authMode         = synthetic
```

這是預期結果。

## Git commits

本次主要 commits：

- `f5a72915a966376c7e0b2f3ae9250ea50bd6df7f` — checkpoint native probe 狀態。
- `32b79a036ae22dc2bcabe3eba4d6ca6d47abaada` — Chat Bridge probe protocol。
- `3461d226fd300a775b3bfd3e1ad6fd261f9bfa66` — 初版 tests。
- `4c6a44b873e0ab28cb3b906e72043f4ee7ecb432` — probe CLI。
- `3cfa7c20b20edcd89c7c8c6428fc3cc9cf2ca359` — GitHub Actions synthetic gate。
- `b4709677a777a4e514fef8c5efba589d5aaf5d8a` — protocol/native 驗證分層。
- `47815b6dfb9fd613eb6dffb4971394cbf547e3e4` — hardened tests。
- `01ab29346ce1f582acaf1c974b95fb874065505a` — CLI 禁止自行 native attestation。
- `e2a69f5c19ffe678f51a464f3f855d91e6fcbe8a` — 驗證層級文件。

## 尚未完成的唯一核心 Gate

Native App 真實 E2E 尚未驗收：

```text
PROBE_ID          = <unique id>
SEND              = PASS
CHAT_RECEIVED     = PASS
READ_BACK         = PASS
API_KEY_USED      = false
MANUAL_COPY       = false
TRANSPORT         = <實際 native transport>
RUNTIME_ATTESTED  = true
PROTOCOL_VERIFIED = true
NATIVE_VERIFIED   = true
```

目前 repo 沒有使用未公開的 Codex App IPC／內部 API，也沒有以 UI 自動化冒充 native transport。

在取得 Codex App 可用的正式 runtime transport / handoff 能力前：

**Native transport：【資料不足，無法確認】**

## 完成定義

- Bridge protocol / CLI / ledger / synthetic gate：已完成。
- 同版 Node tests：12/12 PASS。
- Synthetic round-trip：PASS，且正確維持 `nativeVerified=false`。
- GitHub Actions workflow：已建立；本次 run 狀態尚未能由現有 connector 驗證。
- Native Codex App round-trip：待真實 runtime adapter + read-back E2E。
