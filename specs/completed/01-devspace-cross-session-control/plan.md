> **English summary:** Implement the workflow ledger first, then expose it through a narrowly patched DevSpace MCP registration and installer wiring.

# 實作計畫

## 技術決策

1. 以獨立 ESM module 實作 store/controller，讓狀態機可脫離 MCP 單元測試。
2. 每個事件包含完整 task snapshot 與 hash chain；snapshot 僅作 cache，ledger 是 source of truth。
3. OneClick 將 module 複製到自己的 state/bin，並用 process environment 告知 patched DevSpace server module path。
4. 對 DevSpace `server.js` 只增加 dynamic module registration；沿用現有 hash manifest 與 restore 防線。
5. 本地 Agent 透過既有 DevSpace CLI 啟動與續跑，不另造 provider runtime。

## Implementation order

1. 寫 ledger/state machine/policy resolver 的失敗測試。
2. 實作 workflow module，跑純 Node 測試。
3. 寫 OneClick patch/installer 的失敗測試。
4. 加入 MCP tools registration 與啟動環境接線。
5. 跑 portable 全測試、安裝 fixture 測試與安全邊界測試。
6. 由獨立 Agent 對照驗收條件複核。

## 風險

- DevSpace 1.0.4 server patch point drift：以版本鎖與 hash manifest 拒絕未知狀態。
- Windows 多程序同時 mutation：以 exclusive lock、stale lock 回收與 revision CAS 防護。
- CLI 輸出格式變動：run 只解析穩定 `agt_XXXXXXXX` ID；sync 優先讀既有 local-agent store。
- Deep Research/Pro capability 誤報：local Agent adapter 明確 block/degrade，保留未來 Responses adapter 插槽。
