---
type: governance
date: 2026-07-03
project: PIXIUCORE
system: PIXIUCORE
topic: full-repo-audit
status: active
tags: [pixiucore, governance, audit, skills, agents, hooks, workflows]
summary: 母體全 repo 審查（skills／agents／hooks／workflows／設定／殘留檔）：4 路掃描＋指揮官抽驗，發現分級與行動排序。
---

# 母體全 Repo 審查 — 2026-07-03

## 1. 範圍與方法

- 對象：`vault/_full-snapshot/`（robocopy 快照：1102 目錄、2401 檔、15.7MB），涵蓋 `skills/ agents/ commands/ rules/ hooks/ scripts/ Tools/ mcp-configs/ plugins/ .agent/ .agents/ .codex/ .cursor/ .opencode/ Backup/ docs/` 與根目錄殘留檔。
- 排除：`vault/`（另有 quick-diagnosis）、`.git`、`node_modules`、`cybersecurity-library`（754 個第三方 skills，需另輪審查）、`scripts.7z`（未解壓）。
- 方法：三路 Sonnet subagent（B=.agent 區、C=hooks/scripts/設定、D=agents/commands/rules/殘留）＋指揮官自查 A 路（skills 對帳）＋頭條發現逐項抽驗。
- **抽驗更正**：D 路回報 agents=26、commands=55、fleet=27、docs 不存在，經實測全部有誤（實為 27／58／30／存在）。本報告數字以指揮官實測為準；未能實測的標「掃描回報」。此事印證 `model-dispatch-rules.md` 第 6 節「驗證不自驗」的必要性。

## 2. 總體結論

母體的**引用完整性出乎意料地好**（L0 點名的 10 個 skill、2 個 workflow 全部存在；無明文密鑰；除 debug 殘留外無寫死路徑），但有**三類結構性問題**：巢狀自我複製造成 ~313 個廢檔、同一內容散落 4-5 處造成同步債、以及「數量宣稱」在多份文件間互相矛盾。auto recap 噪音的產生者已定位在 repo 內（可修）；hook-state 827MB 的產生者確認**不在 repo 內**（需查使用者層）。

## 3. 🔴 必修

### 3.1 巢狀自我複製：4 處、約 313 個廢檔【已實測】

- `.agent/workflows/workflows/`（79 檔）、`.agent/skills/skills/`（222 檔）、`.agent/hooks/hooks/`（6 檔）、`.agent/knowledge/knowledge/`（6 檔）——目錄把自己整包複製進自己的子目錄。
- 影響：任何 glob／索引都會重複命中；未來同步腳本可能繼續滾雪球。
- 修法：確認內容與上層一致後整層刪除（**刪除＝硬閘門，需你核准**；建議先 `Move-Item` 到 repo 外暫存一週再刪）。
- 落點：使用者一次性操作；防再發要查產生它的同步腳本（推測在 `scripts/`，下輪確認）。

### 3.2 auto recap 噪音產生者定位【已實測】：`scripts/hooks/pixiu-auto-recap.js`

- 註冊於 `hooks/hooks.json:211-239`（Stop）與 `:283-295`（SessionEnd），且 profile 參數含 `minimal,standard,strict`——**三種 profile 全開**，等於永遠觸發。每 turn 的 Stop 都可能產一份 recap，topic 取原句，即 vault 內 139 份噪音的來源。
- 修法（擇一，需你核准後我產 patch 版供回貼）：(a) 從 `minimal` profile 拿掉 auto-recap，只留 `standard,strict`；(b) 改 `pixiu-auto-recap.js`：同 session 已有 recap 則跳過＋topic 改用摘要＋低活動 session（如 <5 個工具呼叫）不寫；(c) 移除 Stop 註冊、只留 SessionEnd。建議 (b)+(c) 並行。
- 落點：`hooks/hooks.json`＋`scripts/hooks/pixiu-auto-recap.js`（root 檔，走 updated/ 回貼機制）。

### 3.3 hook-state 827MB 產生者**不在 repo 內**【掃描回報＋部分實測】

- C 路窮盡搜索 `hook-state／thread-watcher／transcripts／SessionEnd` 等 pattern，repo 內唯一命中是 `.obsidian/workspace.json`（僅引用路徑字串）。repo 內三個 vault 寫入者（`session-end.js`、`pixiu-auto-recap.js`、`pixiu-guardrails.js`）目的地都不是 `hook-state/`。
- 檔案格式與 `%USERPROFILE%\.codex\sessions\` 的 Codex CLI 原生 session 格式吻合——產生者推測是**使用者層的 Codex 設定或外掛 watcher**。
- 下一步（你本機執行）：`Get-ChildItem $env:USERPROFILE\.codex; Get-Content $env:USERPROFILE\.codex\config.toml`，把輸出貼給任一 session 定位設定，再決定改輸出路徑或停用。

### 3.4 隱私殘留：`scripts/hooks/debug-input.json`【已實測，今日仍在更新】

- `pixiu-guardrails.js:30` 每次 hook 呼叫都把完整 stdin（含對話原文、cwd、transcript 路徑、使用者帳號）覆寫進此檔；快照中該檔時間戳為今日 08:24，9.6KB。
- 修法：`pixiu-guardrails.js` 移除或用環境變數閘住 debug 寫入；`.gitignore` 加 `scripts/hooks/debug-input.json`；刪除現存檔（硬閘門）。若此檔曾被 commit，需檢查 git 歷史是否要清（`git log --all -- scripts/hooks/debug-input.json`）。

### 3.5 數量宣稱多處互相矛盾【已實測核心組】

| 項目 | 實測 | README（05-27 盤點） | AGENTS.md | SKILLS_INDEX |
|---|---|---|---|---|
| agents/ | 27 | 27 ✅ | 25 ❌ | 25 ❌ |
| commands/ | 58 | 58 ✅ | 57 ❌ | 76 ❌ |
| 頂層 skills/ | 89 | 68 ❌ | 108 ❌ | 176+（總） |
| fleet.json | 30 | 30 ✅ | — | — |
| .agents/ 可攜 skills | 84（掃描回報） | 43 ❌ | — | — |

- 修法：宣稱數字只留一處（根 README），其他檔案一律寫「見根 README 盤點」；月維護清單加一步「跑盤點指令核對 README 表」。SKILLS_INDEX 已加警語（本次 updated/ 已含）；AGENTS.md 的 25/108/57 建議下次回貼時改為指向 README。

## 4. 🟡 建議

1. **同一內容散落 4-5 處**（掃描回報，抽驗屬實一組）：`chief-of-staff.md`、`code-reviewer.md` 等同時存在頂層 `agents/`、`.agent/agents/`、`.agent/skills/`、巢狀 dup 內；且 `.agent/skills/code-reviewer.md` 實為 agent 格式誤放 skills。修法：以頂層為準源，`.agent/` 由同步腳本產生，禁止手動雙邊改。
2. **`.agents/`（OpenAI 可攜版）與 `.agent/.agents/` 鏡像不同步**（掃描回報）：兩包內容數量不一致。修法：確認哪個是真源，另一個刪除或由腳本重建。
3. **`.cursor/rules/` 鏡像落後**（掃描回報）：`common-agents.md` 缺 rust-reviewer 列。修法：納入同步腳本或在檔頭標「鏡像自 rules/，勿手改」。
4. **`.agent/workflows/deploy.md`、`testing.md` 缺 YAML frontmatter**（掃描回報）：靠 frontmatter 路由的載入器讀不到。修法：補 `---` 區塊。
5. **`Backup/` fleet_sync 快照 175 檔**：屬歷史存證非垃圾，但無保留策略會無限累積。修法：保留最近 N 次（建議 3），舊的壓縮或刪除（你決定）。
6. **skills 內容過期抽查**：`claude-code-auto-mode-policy`、`opus-behavior-core` 兩個 SKILL.md 含舊模型（Opus 4.7 前）敘述【已實測】。修法：與 user_rules 版本註記同步更新。
7. **根目錄殘留**：`README.md.bak_20260419_223013`、`scripts.7z`（用途不明）、空 recap（回貼指令已含刪除）。

## 5. 🟢 乾淨確認（不用動）

- L0／loading-policy 點名的 10 個 skill 全存在於頂層 `skills/`，89/89 有 frontmatter【已實測】。
- `user_rules.md` 點名的 `.agent/workflows/impact-assessment.md`、`system-test.md` 存在且格式完整（掃描回報）。
- 無明文密鑰：mcp-configs 全為占位符；scripts／configs 掃 `sk-`、`ghp_`、`AKIA` 等 pattern 零命中（掃描回報）。
- 可攜性：除 debug 殘留外零寫死路徑；`fleet.json` 30 條全用環境變數；`pixiu-auto-recap.js` 甚至主動把 `C:\Users\<any>` 正規化為 `%USERPROFILE%`（掃描回報）。
- `.codex/config.toml`：`multi_agent=true, max_threads=6, max_depth=1`，三個子 agent 檔全為 `gpt-5.4` read-only（effort medium/high）——與調度守則「能力≠預設啟用」相容（掃描回報）。

## 6. 行動排序

| 順位 | 事項 | 誰做 | 前置 |
|---|---|---|---|
| 1 | 檢查 `%USERPROFILE%\.codex\`（3.3 指令）貼回輸出 | 你 | 無 |
| 2 | 核准後我產 patch：auto-recap 節流＋guardrails 去 debug＋.gitignore（3.2、3.4） | 我產、你回貼 | 你一句「做」 |
| 3 | 巢狀 dup 四目錄移出（3.1） | 你（我給指令） | 你核准 |
| 4 | AGENTS.md 數字改指向 README＋兩個過期 skill 更新（3.5、4.6） | 我產、你回貼 | 併入下次回貼 |
| 5 | Backup 保留策略、鏡像同步宣告（4.1-4.5） | 議定後排程 | 低急迫 |

## 7. 教訓回寫

- subagent 回報的「數字類」結論必須抽驗：本輪 4 個數字被推翻。已符合 `model-dispatch-rules.md` 第 6 節，維護時請沿用「頭條發現逐項實測」做法。
- 審畢後 `vault/_full-snapshot/` 可刪（由你執行）；留著會被未來的 vault 搜尋掃到，造成與 hook-state 同類的噪音。

## 本檔維護

一次性審查快照，不更新；下次審查開新檔。cybersecurity-library（754 skills）未審，需要時另開一輪。
