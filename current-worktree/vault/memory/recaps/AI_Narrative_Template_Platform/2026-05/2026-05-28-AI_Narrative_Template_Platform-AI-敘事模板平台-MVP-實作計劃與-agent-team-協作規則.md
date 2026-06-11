---
type: session-recap
date: 2026-05-28
project: AI Narrative Template Platform
system: PixiuCore
repo: C:\Users\7010\Documents\Playground
topic: AI 敘事模板平台 MVP 實作計劃與 agent-team 協作規則
status: completed
tags: [recap, ai-narrative-platform, implementation-plan, agent-team, superpowers]
source_paths:
  - C:\Users\7010\Desktop\文件_Word_Excel_PDF\AI_Narrative_Platform_MVP_Spec_v0.2.md
  - C:\Users\7010\Documents\Playground\AI_Narrative_Platform_Implementation_Plan_v0.1.md
summary: 依 AI Narrative Platform MVP 規格產出可拆票實作計劃，並補充未來何時主動建議開 agent team 的協作規則。
---

# Session Recap：AI 敘事模板平台 MVP 實作計劃與 agent-team 協作規則

> 日期：2026-05-28 18:21
> 專案：AI Narrative Template Platform
> AI：Codex

## 觸發與背景

- 使用者提供 `AI_Narrative_Platform_MVP_Spec_v0.2.md`，要求以資深全端系統架構師與技術顧問角度，依規格產出可讓工程師拆票開發的詳細實作計劃。
- 使用者明確要求輸出包含需求理解、系統架構、功能模組、資料庫、API、前端、後端、AI 功能、階段規劃、風險技術債，且使用繁體中文與 Markdown 表格。
- 使用者提到 `@superpowers`，本輪檢查可用工具後未發現專門 planning tool，因此採用「先釐清需求，再拆成可驗收實作單元」的方式執行。
- 後續使用者詢問為何未使用 agent，並希望未來改成由 Codex 判斷是否適合開 agent，若適合則主動詢問使用者意願。

## 結論

- 已在 Playground 產出實作計劃檔：`C:\Users\7010\Documents\Playground\AI_Narrative_Platform_Implementation_Plan_v0.1.md`。
- 計劃檔涵蓋 11 個指定章節，並補上可拆票 Epic/Ticket、資料表初稿、API 初稿、AI moderation/paywall/runtime 實作建議。
- 本輪沒有使用 sub-agent / agent team；原因是使用者未明確授權開 agent，且任務主要是單一規格文件的一致性整合。
- 已建立新的協作偏好：若任務明顯適合 agent team，Codex 應主動提出拆分方式並詢問是否開啟，而不是默默不用。

## 證據與流程

- PixiuCore startup：已讀取 vault README、user_rules、founder-profile、agent-persona、memory-summary。
- 原始規格初次讀取時出現亂碼，後續以 UTF-8 明確重讀，確認文件內容為 AI 敘事模板平台 MVP 規格。
- 主要規格重點：AI Narrative Template Platform、Narrative Engine、Scenario Template、World Template、Relationship Rules、Multi-character Interaction、Emotion Score、Semantic Paywall、PDF only export、Moderation Pipeline、Runtime Moderation、OpenRouter MVP、PostgreSQL、Next.js、TailwindCSS、FastAPI/NestJS 備選。
- 補充查證來源：Next.js App Router、FastAPI OAuth2/JWT、FastAPI BackgroundTasks、NestJS Auth/RBAC、PostgreSQL RLS、OpenRouter API、Stripe Checkout。
- 產檔後已快速檢查章節完整性與 UTF-8 顯示，確認包含 `一、需求理解` 到 `十一、建議工程拆票`。

## 已做變更

- 新增：`C:\Users\7010\Documents\Playground\AI_Narrative_Platform_Implementation_Plan_v0.1.md`
- 新增本 recap：`C:\Users\7010\Desktop\gravityTest\pixiu-core\vault\memory\recaps\2026-05-28-182116-ai-narrative-platform-implementation-plan-agent-policy.md`

## 驗證

- 使用 `Select-String` 檢查實作計劃檔章節，確認 11 個主要章節與技術參考來源都存在。
- 使用 `Get-Content -Encoding UTF8 -TotalCount 30` 檢查檔案開頭，確認繁體中文與表格正常顯示。
- 檔案大小約 38 KB，內容足以作為工程拆票初稿。

## 重要決策

| 日期 | 決策 | 選擇 | 原因 |
|---|---|---|---|
| 2026-05-28 | 後端主方案 | FastAPI，NestJS 作備選 | 規格有 AI Runtime、PDF、moderation、背景任務，Python 生態較適合 MVP 快速整合；若團隊偏 TypeScript 可轉 NestJS |
| 2026-05-28 | AI provider | MVP 以 OpenRouter provider adapter 封裝 | 規格指定 OpenRouter MVP，封裝 adapter 可避免後期自架推論或換 provider 時重構過大 |
| 2026-05-28 | 匯出策略 | 僅允許 PDF，並做 quota ledger 與多重浮水印 | 規格明確禁止 TXT/DOCX/Markdown 原文匯出，需從 API 與儲存層一起限制 |
| 2026-05-28 | Agent 使用規則 | 未來由 Codex 主動判斷是否建議 agent team，但需詢問使用者同意後才開 | 符合目前系統限制，也符合使用者希望不要默默不用 agent 的偏好 |

## 下一步

<!-- AI_INBOX_START -->
- [ ] 若使用者要進一步落地，將 `AI_Narrative_Platform_Implementation_Plan_v0.1.md` 拆成 GitHub Issues / Jira tickets。
- [ ] 若使用者確認技術棧，補一版更具體的 repo 結構、migration SQL、OpenAPI schema 與 sprint plan。
- [ ] 若使用者想強化 agent-team 規則，可協助更新 `AGENTS.md` 或 PixiuCore rules，加入「適合 agent team 時主動詢問」條款。
<!-- AI_INBOX_END -->

## 備註

- 本輪討論中，使用者釐清「小型、單文件、單線任務」的定義。未來可用以下準則判斷是否主動提議 agent team：若任務跨 2 個以上技術面向，或同時需要探索、設計、風險/測試，應主動詢問是否開 agent team。
- 小型任務例：單一 button、單一 validation、單一 controller 說明。大型/適合 agent 例：金流 webhook + 權益、AI 對話 + moderation + history、跨 repo flow tracing、大 diff review。

---

*依 [[pixiu-session-recap]] 與 [[recap-standard]] 產出。*
