---
type: context
date: 2026-06-09
project: PIXIUCORE
system: PIXIUCORE
topic: ai-mothership-loading-policy
status: active
tags: [pixiucore, ai-governance, token, loading-policy, agent-routing]
summary: 定義各 AI 連結 PixiuCore 母體時的低 token 分層載入、語意觸發、agent team 與跨裝置可攜規則。
---

# AI 母體連結低 Token 載入政策

## 目標

讓 Claude、Codex、Gemini 與其他接線 AI 都能使用 PixiuCore 母體，但不要每次 session 都全文載入 skills、workflows、hooks、agents 與完整記憶。母體必須保留治理力，同時降低 token 底噪、避免 agent team 成本倍增，並能在不同裝置、不同路徑下運作。

## 路徑解析

所有 AI 連結母體時，必須依序解析 core path：

1. `PIXIU_CORE`
2. `PIXIU_CORE_PATH`
3. `%USERPROFILE%\.pixiu-core`

文件、指令與模板不得寫死單一本機絕對路徑。可以在本機實測時引用實際路徑，但可攜設定必須使用上述環境變數。

## 常駐層

每次 session 只常駐以下內容：

1. `user_rules.md` 的 L0 硬閘門與不可違反條款。
2. `vault/README.md` 的 init 序列與 vault 邊界。
3. `vault/identity/founder-profile.md` 的使用者偏好摘要。
4. `vault/identity/agent-persona.md` 的角色定位摘要。
5. `vault/memory/memory-summary.md` 的索引型摘要，不把 recap 全文當常駐內容。
6. 本檔的分層載入與語意路由規則。

`user_rules.md` 是最高憲法；本政策只調整載入策略，不降低 L0 約束。

## L1-L6 路由摘要

L1-L6 不應整層全文常駐，應常駐這份路由摘要，命中後再讀對應文件、skill 或 workflow。

| 層級 | 常駐摘要 | 按需載入條件 |
|---|---|---|
| L1 安全層 | 敏感資料、權限、DB、網路、刪檔、資安一律保守 | auth、token、secret、SQL、DB schema、filesystem、network、security、漏洞、掃描 |
| L2 心智層 | 架構、根因、多方案需要更深推理 | 架構、root cause、影響範圍、方案比較、風險評估 |
| L3 流程層 | 多步驟、多檔案、Phase 工作先計畫與驗證 | plan、phase、實作、收尾、驗證、測試、重構 |
| L4 技能層 | skill 與戰術規則只按任務載入，不預設載入全部 skills | 使用者意圖或任務類型命中 skill description / routing table；寫程式、修 bug、重構前先套 `vault/governance/minimal-implementation-ladder.md` 摘要 |
| L5 經驗層 | second brain 與 recap 是線索，不是最終證據 | 需要舊決策、舊調查、跨專案記憶、踩坑紀錄 |
| L6 校準層 | 完成前驗證，重要決策後 recap | 完成、失敗、測試結果、recap、下一步、現在到哪了 |

## 語意觸發，不要求使用者精準下指令

AI 不得要求使用者一定說出精準 skill 名稱。觸發方式分三層：

1. 明確關鍵字：例如 `recap`、`auto mode`、`focus mode`、`/go`、`impact assessment`。
2. 語意意圖：例如「現在到哪了」觸發 recap，「幫我收尾」觸發驗證迴圈，「這樣會不會有風險」觸發影響評估。
3. 不確定時反問：若同一句可能對應多個流程，先問一個短問題，不自行載入大量資料。

常見語意路由：

| 使用者自然語句 | 建議載入 |
|---|---|
| 現在到哪了、整理今天做了什麼、下一步 | `skills/pixiu-session-recap/SKILL.md`、`vault/sop/recap-standard.md`、`vault/templates/session-recap.md` |
| 收尾、跑驗證、確認能不能交付 | `skills/pixiu-verify-loop/SKILL.md` 或 `skills/verification-loop/SKILL.md` |
| 影響範圍、隱藏風險、系統面分析 | `.agent/workflows/impact-assessment.md` |
| 實作、修 bug、重構、加依賴、加檔案、怕過度工程、想省 token | `vault/governance/minimal-implementation-ladder.md`（按需載入摘要；不得覆蓋 L0、安全、審批、驗證） |
| auto mode、自動放行、不要每次問 | `skills/claude-code-auto-mode-policy/SKILL.md` |
| focus mode、只看結果、隱藏步驟 | `user_rules.md` 的 Focus mode 閘門與相關 verify loop |
| agent team、多 agent、平行處理 | `skills/pixiu-agent-router/SKILL.md`，且必須先取得使用者同意 |
| legacy Java、Servlet、mapper、SQL flow | `skills/legacy-java-flow-tracing/SKILL.md` |
| 第二大腦失敗、Qdrant、NVIDIA 查詢問題 | `skills/second-brain-health-check/SKILL.md` |

## Skills / Workflows / Hooks 載入原則

1. 不在 session start 載入全部 skills、workflows、hooks、agents。
2. 先讀索引、description 或 routing table，再讀單一必要文件。
3. workflow 若只是本地腳本或 hook 執行，不把完整輸出塞回對話；只回報必要摘要與錯誤片段。
4. 測試、lint、git diff、log 輸出要裁切到能證明結論的最小片段。
5. second brain 查詢只作 lead layer；預設取 top 3，之後讀 vault 原文或 repo source 驗證。
6. 若任務可以用現有 repo source、CodeGraph 或精準檔案讀取回答，不啟動大型 research / deep-research skill。
7. 實作型任務先套最小化梯：能不做就不做，能重用就重用，能用標準庫／原生平台／既有依賴就不新增；但不得刪減安全、驗證、錯誤處理、審批與使用者明確指定內容。

## Agent Team 與子 Agent 任務包

Agent team 是倍增器，不是預設模式。

1. 每次需求先判斷是否建議啟用 agent team，但不得自動啟用。
2. 小型問答、單檔小修、單一路徑文件調整，保留在主 AI 本地處理。
3. 只有跨模組、跨技術棧、獨立可並行的探索/實作/審查任務，才提議 agent team。
4. 使用者明確同意後，才讀 `skills/pixiu-agent-router/SKILL.md` 與必要 agent 檔。
5. 子 agent 不重讀整包母體，只接收精簡任務包：任務目標、允許路徑、必要 L0 規則、相關檔案、驗證標準。
6. 子 agent 的任務包應包含 `minimal-implementation-ladder.md` 的短 checklist：先重用、少新增、保留安全與驗證。
7. 子 agent 不得回寫母體、刪檔、安裝套件或改動未授權路徑，除非主 AI 已取得使用者明確授權。

## 各 AI 入口規則

### Claude / Claude Code

- `CLAUDE.md` 只保留啟動協議與本政策連結。
- Claude 可使用 hooks/workflows，但應以 `ECC_HOOK_PROFILE=minimal|standard|strict` 控制成本。
- `/devfleet`、`/multi-plan`、`/orchestrate` 需使用者明確要求或同意。

### Codex

- `CODEX.md` 與 `.codex/AGENTS.md` 必須指向本政策。
- `.codex/config.toml` 可保留 multi-agent 能力，但 `max_threads` 不代表預設啟用；實際 dispatch 仍受 user approval gate 控制。
- Codex 子 agent 只能拿精簡任務包，不全量載入 vault。

### Gemini / 其他 CLI AI

- 若工具不支援 hooks 或 skills，自動退化為「短啟動 + 語意路由 + 手動讀檔」。
- 可使用 `GEMINI.md` 作為短版母體入口。
- 不要求 Gemini 載入 Claude 專屬 command 或 hook 全文。

## 跨裝置可攜檢查

母體更新後，至少檢查：

1. 入口文件是否使用 `PIXIU_CORE` / `PIXIU_CORE_PATH` / `%USERPROFILE%\.pixiu-core`，沒有寫死單一本機路徑作為必需路徑。
2. 新增文件是否在 repo 內，能被 git 追蹤。
3. AI 入口是否都能在缺少 Claude hooks 或 Codex multi-agent 時退化運作。
4. 新政策不依賴 Windows-only 指令；Windows 指令只能放在操作範例，不作為唯一啟動方式。
5. 母體 dirty worktree 中若有未追蹤檔，需提醒使用者 commit 或同步，否則不同裝置不會拿到最新規則。
