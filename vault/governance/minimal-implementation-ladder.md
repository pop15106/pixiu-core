---
type: governance
date: 2026-07-06
project: PIXIUCORE
system: PIXIUCORE
topic: minimal-implementation-ladder
status: active
tags: [pixiucore, governance, minimal-change, token, coding]
summary: 實作前最小化梯：吸收 Ponytail 類反過度工程精神，但不覆蓋 PixiuCore 既有安全、審批、驗證與文件流程。
---

# Minimal Implementation Ladder — 實作前最小化梯

> 本檔是 L4 戰術規則：降低不必要程式碼、依賴、檔案與 token 成本。它只在實作、修 bug、重構、文件產物設計或 agent task packet 需要決定「做多大」時載入；不要在 session start 全文常駐。

## 位階與邊界

1. 本檔不得覆蓋 `user_rules.md` 的 L0 硬閘門、使用者本次指令、審批流程、Focus/Auto mode 閘門、recap 寫入規則與安全底線。
2. 省 token、少寫 code、少開 agent 都是副作用；核心目標是只做任務需要的最小正確變更。
3. 不得為了縮短 diff 刪除 trust boundary validation、錯誤處理、資料防護、權限檢查、accessibility、審計紀錄或使用者明確要求的行為。
4. 適用於所有接線 AI：Claude、Codex、Gemini、Hermes、OpenCode、Cursor 類工具都讀同一份母體路由；沒有 hook 或 skill 能力時，改成手動 checklist。

## 實作前最小化梯

在寫新程式碼、加檔案、加套件、開 agent team 或擴大 scope 前，依序停在第一個可成立的階梯：

1. **不需要做**：需求是否可用說明、設定、既有 UI、既有指令或既有流程解決？若可，先回報不用新增實作。
2. **repo 已經有**：是否已有 helper、service、component、mapper、workflow、script、template 或同型 pattern？優先重用與最小調整。
3. **標準庫可解**：語言標準庫或平台內建能力是否已覆蓋？優先使用，不新增依賴。
4. **原生平台可解**：瀏覽器、作業系統、框架既有能力是否已足夠？優先採原生能力，不手刻通用元件。
5. **既有依賴可解**：專案已安裝且正在使用的依賴是否可安全解決？可用既有依賴，不新增套件。
6. **更小共用點**：能否在真正的 shared function / mapper / schema boundary 修一次，而不是在每個 caller 補一段？
7. **最小正確實作**：以上都不成立時，才新增最小可驗證實作；檔案、抽象、設定、測試都只加達成驗收需要的範圍。

## 不可簡化的項目

- 使用者明確指定的輸出、格式、行為或流程。
- 安全、授權、輸入驗證、SQL 參數化、XSS 防護、CSRF、防資料遺失與 rollback。
- 外部系統錯誤處理、交易邊界、idempotency、審計 log、敏感資料遮罩。
- Legacy 系統的既有相容性、部署邊界、已知人工操作 SOP。
- 需要 source-backed evidence 的結論：第二大腦、recap、README 摘要都只是線索，不是最終證據。

## 操作規則

1. 小任務不開 agent team；跨模組、跨技術棧、獨立可並行時才提議，且仍需使用者同意。
2. 不因最小化而跳過 TDD / compile / main-path run / read-back；驗證範圍按 `judgment-rubrics.md` 第 5 節。
3. 若最小方案與安全、可維護性或使用者需求衝突，先列 2-3 個方案與代價，停下等使用者選。
4. 若已有大型既有變更，避免把本次最小化規則套到不相關 dirty files；只處理本任務白名單範圍。
5. 對子 agent 派工時，只把本檔摘要成 checklist 放入 task packet，不要求子 agent 重讀整個母體。

## 回報格式

需要說明時用短格式即可：

```text
最小化檢查：
- 重用：使用既有 <檔案/函式/流程>
- 未新增：套件 / agent team / 額外設定
- 保留：安全檢查 / 驗證 / 使用者指定輸出
```

不需要每次完整列七階梯；只有當選擇會影響 scope、依賴、agent team 或安全邊界時才展開。
