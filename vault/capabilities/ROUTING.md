---
type: capability-routing-index
generatedBy: scripts/router/build-routing-index.js
source: vault/capabilities/capability-manifest.json
alwaysApply: false
readAt: on-demand
---

# Capability 路由索引

> 由 `scripts/router/build-routing-index.js` 從 `vault/capabilities/capability-manifest.json` 產生，請勿手改；Manifest 變更後重新執行該腳本。
> 能執行指令的工具一律用 `node scripts/router/resolve-capabilities.js "<本次需求>"`。本檔只給無法執行指令的工具查表。

## 選取規則

1. 比對前把需求轉成小寫、全形轉半形、連續空白併成一個；`CR研究` 與 `CR 研究` 視為相同。
2. 需求含某能力的任一關鍵字或別名即命中。別名的英數開頭或結尾須獨立成詞，前後不能緊接其他英數字。
3. 觸發詞前 12 個字內（中間沒有句號、問號或驚嘆號）出現「不要、不用、別、取消、關閉、不開、不是要、先不要、暫時不要」時，該次出現不算命中；「不」緊接「開」或「建立」開頭的觸發詞也不算。
4. 先選標 ★ 且命中的能力，再選其餘命中的能力；兩組都依優先度由高到低，同優先度時命中觸發詞較多者優先。合計最多 3 個。
5. 依選取順序讀「載入檔案」，重複的只讀一次。標（本機）的檔案只存在工作機，讀不到就明說，不猜內容。
6. 沒有命中時只用 Bootstrap 與專案原始碼，不全量掃描母體。

## 能力表

依優先度由高到低排列；★ 表示命中即必選。

| 能力 | 優先度 | 關鍵字 | 別名 | 載入檔案 |
| --- | ---: | --- | --- | --- |
| `work-document-orchestration` | 60 | 需求、現在有個需求、有個需求、PM說、PM 說、PM剛、PM 剛、SA說、SA 說、SA剛、SA 剛、交代、交辦、追加調整、追加需求、需求變更、報修、客戶報修、客戶反映、客戶反應、異常、事故、出事、資料異常、資料怪怪的、手動修資料、人工修資料、人工 SQL、人工SQL、上版、併版、操作手冊、資安排除、弱點排除、自保文件、覆核單、留個紀錄 | — | `skills/work-document-orchestrator/SKILL.md`、`vault/governance/minimal-implementation-ladder.md` |
| `git-fallback` | 52 | 切 git、改用 git、git fallback、github 直接改、直接在 github 改、devspace 斷線、devspace 掛了、devspace 不可用 | — | `vault/bootstrap/GIT-FALLBACK-BOOTSTRAP.md`、`vault/governance/long-running-progress-policy.md` |
| ★ `analyze-pro-style` | 51 | pro 參考工作法、pro 參考分析、pro 式純文字分析 | Pro析、/prostyle、analyze-pro-style | `skills/analyze-pro-style/SKILL.md` |
| ★ `analyze-xhigh-style` | 51 | xhigh 參考工作法、xhigh 參考分析、xhigh 式純文字分析 | X析、/xstyle、analyze-xhigh-style | `skills/analyze-xhigh-style/SKILL.md` |
| `security-review` | 50 | 資安、安全、漏洞、弱點、secret、token、密碼、權限、owasp、紅隊 | — | `skills/security-review/SKILL.md`、`vault/governance/judgment-rubrics.md` |
| ★ `cr-deep-reasoning-no-mcp` | 49 | cr deep reasoning、cr 深度推理、cr-deep-reasoning-no-mcp、instant + cr、instant+cr、cr 非 mcp、非 mcp 推理、純 skill 深度推理、skill 版 cr | crd、/crd、cr深推、/crdeep、/icr、instantcr、/crx | `skills/cr-deep-reasoning-no-mcp/SKILL.md` |
| `typesafe-ai` | 48 | typesafe、type safe、jev、system one、system-one、choice、noul、typesafe score、typed judgment、decision primitive、structured decision、結構化判斷、語意判斷、決策原語、信心分數 | — | `skills/typesafe-ai/SKILL.md` |
| ★ `critical-reasoning` | 47 | 對抗搜尋、對抗式搜尋、對抗思考、對抗推理、懷疑每個論點、反證、反例、交叉驗證、批判搜尋、批判性搜尋、質疑論點、critical relay、adversarial search | 開cr、開 cr、建立正式cr、建立正式 cr、cr 完整自動接力、cr全流程、cr 全流程、cr研究、cr 研究、cr設計、cr 設計、cr開發、cr 開發、cr搜尋、cr 搜尋、cr research、cr design、cr development、cr lifecycle、critical relay lifecycle、cr 風險盤點、cr風險盤點、cr 風險審查、cr風險審查 | `skills/critical-relay/SKILL.md`、`skills/critical-relay-lifecycle/SKILL.md`、`vault/governance/cr-chat-dev-policy.md`、`.agent/workflows/cr-lifecycle.md`、`vault/governance/cr-risk-review.md` |
| ★ `execution-progress` | 46 | 完整自動接力、自動接力、github actions、長時間任務、長時間 command、輪詢、執行進度、可見進度、session id、run id、job id、workflow id、ci 等待、ci 執行中、build 等待、build 執行中、test 等待、測試執行中、release 等待、release 執行中、deploy 等待、deploy 執行中、部署等待、部署執行中 | — | `vault/governance/long-running-progress-policy.md` |
| `agent-routing` | 45 | agent team、多 agent、子代理、派工、平行處理、agent router、平衡模式、省錢模式、品質優先模式 | — | `vault/governance/agent-team-mode-policy.md`、`vault/governance/model-dispatch-rules.md`、`vault/governance/delegation-templates.md` |
| `runtime-control` | 45 | auto mode、自動模式、自動放行、跳過確認、focus mode、只看結果、隱藏步驟 | — | `skills/claude-code-auto-mode-policy/SKILL.md`、`user_rules.md` |
| `repair-review` | 42 | 報修覆核單、報修覆核、報修單、事故修復覆核、故障修復覆核、修復方案覆核、bug修復覆核、bug 修復覆核、異常修復覆核、問題修復覆核、事故覆核、維修覆核單 | — | `skills/repair-review-sheet/SKILL.md`、`skills/system-documentation/SKILL.md`、`vault/governance/minimal-implementation-ladder.md` |
| `recap-memory` | 40 | recap、摘要、現在到哪、做到哪、目前進度、進度、下一步、之前、上次、前面、剛剛、對話、紀錄、記憶、接續、繼續、昨天 | — | `skills/pixiu-session-recap/SKILL.md`、`vault/memory/SESSION-INDEX.md`（本機）、`vault/sop/recap-standard.md` |
| `requirement-confirmation` | 40 | 需求確認、確認需求、需求釐清、釐清需求、口頭需求、我理解的需求、需求理解、需求覆核、需求確認文件、需求確認書、SA需求確認、PM需求確認、SA/PM需求覆核、SA PM需求覆核、需求範圍確認、追加需求、需求追加、追加調整、需求補充、補充需求、需求變更、中途追加、剛剛又補充、另外還要調整 | — | `skills/requirement-confirmation/SKILL.md`、`skills/system-documentation/SKILL.md`、`vault/governance/minimal-implementation-ladder.md` |
| `change-review` | 35 | 變更內容整理、整理變更內容、此次變更、此次改動、改動程式範圍、變更範圍整理、併版前覆核、併版覆核、合併前覆核、merge 前覆核、merge前覆核、變更覆核、變更覆核文件、併版覆核文件、變更 diff、改動 diff、變更SA覆核、變更PM覆核、變更SA/PM覆核、併版SA覆核、併版PM覆核、change review | — | `skills/change-review-evidence/SKILL.md`、`skills/system-documentation/SKILL.md`、`vault/governance/minimal-implementation-ladder.md` |
| `second-brain` | 35 | 第二大腦、qdrant、n8n、embedding、nvidia、記憶庫 | — | `skills/second-brain-health-check/SKILL.md` |
| `identity-calibration` | 32 | 我的偏好、個人偏好、我的習慣、你應該知道我、根據你對我的了解、角色定位、人格校準、我是誰 | — | `vault/identity/founder-profile.md`（本機）、`vault/identity/agent-persona.md`（本機） |
| `legacy-java` | 30 | java、pclms、pepis、pisso、ptwcs、struts、servlet、spring、dao、sql、procedure、排程、報表、流程 | — | `skills/legacy-java-flow-tracing/SKILL.md`、`vault/context/tech-stack.md`（本機）、`vault/context/pclms-overview.md`（本機）、`vault/governance/minimal-implementation-ladder.md` |
| `documentation` | 28 | 文件、報告、說明書、readme、整理文件、簡報內容、操作手冊、操作流程、SOP、受測、受測文件、複測、測試文件、測試規格、功能規格、系統規格、需求規格、變更規格、需求文件、變更文件、既有系統、現有系統、系統模組、模組解說、模組說明、系統解說、功能說明、程式流程、交接文件、API規格、介接規格、DB解說、Schema解說、UI還原、畫面還原 | — | `skills/system-documentation/SKILL.md`、`vault/governance/minimal-implementation-ladder.md` |
| `architecture-analysis` | 25 | 架構、根因、root cause、影響、影響範圍、現行操作、功能影響、效能、瓶頸、方案比較、風險評估 | — | `vault/context/ai-mothership-loading-policy.md`、`.agent/workflows/impact-assessment.md`、`vault/governance/judgment-rubrics.md` |
| `code-review` | 25 | code review、審查程式、檢查程式、review、回歸風險、收尾、跑驗證、驗證、測試、確認能交付、/go | — | `skills/pixiu-verify-loop/SKILL.md`、`skills/verification-loop/SKILL.md`、`vault/governance/judgment-rubrics.md` |
| `code-implementation` | 20 | 實作、修正、修 bug、bug、開發、重構、修改程式、加功能 | — | `skills/tdd-workflow/SKILL.md`、`vault/governance/minimal-implementation-ladder.md` |
| `prompt-engineering` | 18 | prompt、提示詞、提示語、system prompt、優化 prompt、改寫 prompt、提示工程 | — | `rules/common/prompt-engineering.md` |
| `research` | 15 | 研究、repo、github、論文、文章、搜尋、查資料、近期、最新 | — | `skills/deep-research/SKILL.md` |
