---
type: session-recap
date: 2026-05-25
project: PixiuCore
system: PixiuCore
repo: Playground
topic: second-brain-lookup-policy
status: done
tags: [recap, pixiucore, second-brain, workflow, agent-memory]
source_paths:
  - C:/Users/7010/Documents/Playground/AGENTS.md
  - C:/Users/7010/Documents/Playground/second-brain/scripts/query-second-brain-nvidia.ps1
summary: 已釐清第二大腦不是技術長連線，而是每題依脈絡判斷是否即時查詢；建議採「全程偏向查，但局部小改不查」的工作模式。
---

# Session Recap：第二大腦查詢策略與全程連著的邊界

> 日期：2026-05-25 17:34
> 專案：PixiuCore
> AI：Codex

## 觸發與背景

- 使用者在完成 PCLMS recovery SOP recap 後，追問目前 second-brain 的使用方式：
  - 是每個問題都查，還是只有 session 一開始查。
  - 如果中途問其他非 recovery 題目，是否會再查。
  - 是否能讓它「全程連著」。
  - 全程連著是否比較好。
- 這段討論是 agent 工作模式偏好，尤其關係到 PCLMS / PixiuCore / PEPIS 類題目是否要先用 second-brain 取得舊脈絡。

## 結論

- second-brain 目前不是技術上的長連線或 websocket，而是需要時執行查詢指令：
  - `powershell -ExecutionPolicy Bypass -File C:/Users/7010/Documents/Playground/second-brain/scripts/query-second-brain-nvidia.ps1 -Question "<question>"`
- 判斷不是「session 第一題才查」，也不是「每個小問題都硬查」，而是每個問題都依脈絡判斷。
- 建議採用的工作模式是「全程偏向查，但不要每個小動作都查」：
  - 新題目、跨 repo、root cause、SQL/資料流、recap、decision、過去調查：先查 second-brain。
  - 同一題內明確的小修、小段 SQL 改寫、翻譯、排版、剛剛文件局部調整：不查，直接處理。
  - 若不確定是否需要舊脈絡：偏向查，並明確說明 second-brain 只當 lead。
- 查到 second-brain 後仍不能直接定案，必須回 source of truth 驗證：
  - vault 實檔
  - repo 實體檔案
  - accepted decision
  - SQL / log / live endpoint
  - rollout evidence

## 證據與流程

- `AGENTS.md` 的 Second Brain Lookup Rules 已明確定義：
  - 非自包含任務，若需要背景、舊決策、project rules、old investigations、recaps、cross-project memory，要先查 second-brain。
  - self-contained tasks，例如簡單翻譯、格式調整、當前時間、明確單檔小改，可以不查。
  - second-brain 結果是 leads，不是 final answers。
- 這次實際對話中形成的補充規則：
  - 若使用者問「先查 second-brain」，一定先查。
  - 若使用者說「不用查，直接改」，可跳過，除非有安全或資料風險。
  - 若使用者說「這題只看 repo」，應直接回 repo 證據。
  - 若中途換成非 recovery 題目，但仍需要歷史脈絡，仍應再查。

## 已做變更

- 未修改 `AGENTS.md` 或 second-brain script。
- 已將本次偏好寫入 PixiuCore recap，方便未來 session 延續：
  - 全程偏向查。
  - 明確局部小改不查。
  - second-brain 只當 lead。
  - 需要回 repo/vault/log/SQL/live check 驗證。

## 驗證

- 已重新讀取：
  - `C:/Users/7010/Desktop/gravityTest/pixiu-core/vault/sop/recap-standard.md`
  - `C:/Users/7010/Desktop/gravityTest/pixiu-core/vault/templates/session-recap.md`
  - `C:/Users/7010/Documents/Playground/AGENTS.md`
- 已確認 AGENTS.md 內的 second-brain 規則與本 recap 結論一致。

## 下一步

- [ ] 若使用者希望這條規則從「recap 偏好」升級成硬規則，可另寫到 `vault/context/` 或正式修訂 `AGENTS.md`。
- [ ] 若未來某題 second-brain 查詢失敗，需分辨是遠端 embedding endpoint、local Qdrant/n8n，還是 sandbox/runtime 邊界問題。

## 備註

- 最適合目前使用者工作流的表述是：「第二大腦全程在旁邊，但不是每個按鍵都問它；需要歷史脈絡時先問，問到後再回 source of truth 驗證。」

---

*依 [[pixiu-session-recap]] 與 [[recap-standard]] 產出。*
