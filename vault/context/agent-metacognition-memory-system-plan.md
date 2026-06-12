---
type: implementation-plan
date: 2026-05-15
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: agent-metacognition-memory-system-plan
status: draft
summary: 整理 agent metacognition 與母體記憶升級的實作計劃，維持 draft 狀態供後續評估。
tags: [pixiucore, second-brain, agent-memory, metacognition, strategic-memory, self-improvement]
sources: C:\Users\7010\Desktop\進化agent\心得.txt | C:\Users\7010\Desktop\進化agent\來源資源.txt
related_decisions: vault/memory/decisions/2026-05-11-n8n第二大腦與VectorDatabase實作計劃.md | vault/memory/decisions/2026-05-12-second-brain-first-lookup-rule.md
---

# Agent Metacognition 與母體記憶升級實作計劃

## 目的

這份文件把 `C:\Users\7010\Desktop\進化agent` 裡的研究心得整理成 PixiuCore 可落地的母體設計稿。

核心結論是：Agent 的「自我學習」不應被理解成模型自己神祕變聰明，而是一套可工程化的記憶管理流程：把工作過程中的經驗抓下來，整理成可檢索、可驗證、可升級的知識，再逐步影響下一次任務的行為。

本文件先維持 `draft`，放在 `vault/context/`。它不是 accepted decision，也不直接修改 `user_rules.md`、`memory-summary.md` 或任何 hook 設定。

## 與既有 PixiuCore 決策的關係

既有 decision 已經定調：

- Markdown / Obsidian / Pixiu vault 是 source of truth。
- Qdrant / vector database 是可重建索引，不是第一層持久化。
- second-brain query 是 lead，不是最終證據。
- API key、token、credentials 不寫進 vault rules、decision 或 recap。
- 規劃稿先放 `vault/context/`，尚未定案前不升格成 decision。

因此，本計劃不新增一個獨立知識庫，而是在既有 vault 上加一層「agent 經驗如何沉澱」的流程。

建議定位：

```text
PixiuCore vault
  -> source of truth Markdown
  -> second-brain index / Qdrant 可重建
  -> agent-learning layer 負責把 session 經驗升級成 observation / instinct / skill / strategy
```

## 來源整理

### 已驗證事實

- Self-Refine 是單一 LLM 在同一任務內做 generate / feedback / refine 的迭代，不需要額外訓練或 RL。
- Reflexion 把 task feedback 轉成 verbal reflection，寫入 episodic memory，讓後續 trial 可以使用。
- HyperAgents 提出 self-referential agents，把 task agent 與 meta agent 放進同一個可編輯 program，讓 meta-level modification procedure 本身也可以被修改。
- Darwin Godel Machine 以 archive + empirical validation 的方式演化 coding agents，並強調 sandboxing 與 human oversight。
- Claude Code 官方文件確認了 `CLAUDE.md` 與 auto memory 是兩套跨 session 記憶機制，也確認 hooks 事件包含 `PreCompact`、`PostCompact`、`SessionEnd` 等生命週期點。
- EEF 的 metacognition and self-regulation toolkit 目前頁面標示平均影響為 `+8 months`，可作為人類學習中 metacognition 有效性的參考，但不能直接當作 AI agent 效果證據。

### 高價值推論

- Agent 自我學習的工程本質，可以抽象成 `capture -> consolidate -> distill -> promote -> verify`。
- 最有價值的記憶不是事實本身，而是「什麼情境下用什麼策略、為什麼有效、下次怎麼調整」。這可稱為 strategic memory。
- 大多數系統容易直接從 raw transcript 跳到 skill / rule，缺少中間的 atomic observation / instinct 層，導致知識難追蹤、難衰減、難升級。
- `implementer` 與 `verifier` 應分離。Agent 自評很容易把錯誤模式合理化成高信心規則。
- `capture` 與 `consolidate` 應分離。每次 session 都做深度整理會增加雜訊與成本，先便宜捕捉，累積後再整理更合理。

### 需要標註為推測或外部分析的內容

- Claude Code `Auto Dream` 的細節目前主要來自第三方分析與社群復刻，不宜寫成官方已證實機制。
- Claude Code 是否存在獨立 verification agent，目前公開文件未明確證實。
- ECC、Hermes、memory-mcp、claude-mem、dream-skill 都適合當設計樣板，但不應直接等同於穩定標準。
- `OpenClaw` 的 memory flush 設計若要採用，仍需另外讀實作或官方來源確認。

## 母體記憶分層模型

建議把 PixiuCore 的 agent-learning 記憶切成四層，避免所有內容都塞進 recap 或 rules。

| 層級 | 名稱 | 對應概念 | 建議落點 | 用途 |
|---|---|---|---|---|
| L1 | Raw / Evidence | episodic memory | session transcript、tool output、原始 txt、recap evidence | 保留發生了什麼 |
| L2 | Observation / Instinct | production rule | `vault/memory/agent-learning/observations/`、`vault/memory/agent-learning/instincts/` | 把可重用經驗切成原子規則 |
| L3 | Skill / Workflow | procedural knowledge | `skills/`、`vault/sop/`、workflow 文件 | 把多個規則組成可執行流程 |
| L4 | Strategic Rule / Decision | metacognitive knowledge | `user_rules.md`、`vault/memory/decisions/`、`vault/context/` | 影響未來 agent 如何判斷與學習 |

升級路徑：

```text
L1 raw evidence
  -> L2 observation / instinct
  -> L3 skill / workflow
  -> L4 decision / strategic rule
```

反向落地路徑：

```text
L4 strategic rule
  -> L3 workflow
  -> L2 trigger condition
  -> L1 execution record
```

## 建議資料夾

第一階段先建立草案資料夾，不把內容直接混進 accepted decision。

```text
vault/memory/agent-learning/
  observations/
  instincts/
  consolidation-runs/
  verifier-reports/
  promote-candidates/
```

用途：

- `observations/`：單次任務萃取出的結構化觀察。
- `instincts/`：反覆出現、可帶信心值的原子規則。
- `consolidation-runs/`：一次整理批次的輸入、輸出與摘要。
- `verifier-reports/`：獨立驗證者對 observation / instinct 的檢查結果。
- `promote-candidates/`：準備升級到 skill、decision 或 user_rules 的候選項。

這些資料夾不取代：

- `vault/memory/recaps/`
- `vault/memory/decisions/`
- `vault/context/`
- `vault/sop/`
- `vault/briefs/`

## Observation 最小格式

```markdown
---
type: agent-observation
date: 2026-05-15
status: candidate
scope: project
source_session:
source_paths: []
tags: [agent-learning]
confidence: 0.4
verified: false
---

# Observation - 簡短標題

## Context

這次任務的情境。

## Action

實際採用的方法。

## Result

結果與可觀察證據。

## Why It Happened

原因推論，必須標註推論程度。

## Recommendation

下次遇到類似情境時的建議。

## Evidence

- 本地檔案：
- 網站來源：
- command output：

## Verification

- verifier：manual / model / script
- result：pass / needs-review / reject
- notes：
```

## Instinct 最小格式

```markdown
---
type: agent-instinct
date: 2026-05-15
status: active
scope: project
trigger: "when ..."
confidence: 0.6
supporting_observations: []
contradicting_observations: []
tags: [agent-learning, instinct]
---

# Instinct - 簡短規則

## Trigger

什麼情境會觸發這條規則。

## Action

觸發後建議採取的行動。

## Rationale

為什麼這樣做。

## Boundaries

什麼情況不適用。

## Promotion Rule

需要哪些證據才能升級為 skill / decision / user rule。
```

## Phase 0：整理與對齊

目標：把目前研究材料變成 PixiuCore 可討論的設計稿。

交付物：

- 本文件。
- 已驗證事實 / 推論 / 待查證清單。
- 與既有 second-brain decision 的邊界說明。

驗收：

- 不修改 accepted decision。
- 不新增 secrets。
- 不把 Qdrant 當 source of truth。
- 文件可直接被 Obsidian 搜尋與引用。

## Phase 1：手動 Capture MVP

目標：先不用 hook，也不用自動 agent，讓人可以手動把一次任務的經驗寫成 observation。

建議步驟：

1. 建立 `vault/memory/agent-learning/` 相關資料夾。
2. 建立 observation template。
3. 從最近 1-2 次實際任務中手動產出 observation。
4. 每筆 observation 都附來源路徑或網站連結。
5. 人工檢查 observation 是否過度推論。

驗收：

- 至少 3 筆 observation。
- 每筆都有 `Context / Action / Result / Why It Happened / Recommendation / Evidence`。
- 每筆都有 `confidence`，且預設低於 `0.6`，避免一開始就過度自信。

## Phase 2：Deterministic Capture

目標：建立可靠觸發點，讓 capture 不靠 agent 自己想起來。

可選入口：

| 入口 | 優點 | 風險 | 建議 |
|---|---|---|---|
| 手動 `/recap` 或明確指令 | 最安全、最可控 | 需要人記得觸發 | 第一版採用 |
| Claude Code hooks | 官方有生命週期事件 | 僅適用 Claude Code runtime | 第二步驗證 |
| Codex session recap | 貼近目前工作方式 | 需要確認本機 Codex 可用事件與路徑 | 第二步驗證 |
| n8n 定期掃描 vault | 與 second-brain 架構一致 | 初期容易掃到雜訊 | 第三步 |

建議先做：

```text
手動任務完成
  -> 產 recap
  -> 從 recap 抽 0-3 筆 observation candidate
  -> 寫入 vault/memory/agent-learning/observations/
```

不建議一開始做：

```text
每次 session 自動深度 consolidate
```

原因：多數 session 沒有值得升級的洞見，過早自動化會製造雜訊。

## Phase 3：Verifier 分離

目標：不要讓同一個 agent 既產生 observation 又直接把它升級成規則。

第一版 verifier 可以是人工 checklist，不必馬上接第二個 LLM。

Verifier checklist：

- 是否有明確 evidence？
- 是否把推論寫成事實？
- 是否只適用某個 repo，卻寫成全域規則？
- 是否和既有 decision / user_rules 衝突？
- 是否包含 secret、token、本機敏感資訊？
- 是否應該留在 context draft，而不是升級到 decision？

驗收：

- Observation 要升級為 instinct 前，必須有 verifier result。
- `verified: false` 的 observation 不得升級。
- verifier report 必須能回指原 observation。

## Phase 4：Consolidate 與 Promote

目標：把多筆 observation 聚合成 instinct，再把成熟 instinct 升級成 skill、SOP、decision 或 user rule。

建議節奏：

- 每累積 10-20 筆 observations 做一次 consolidation。
- 或每週做一次人工整理。
- 不採用每 session 都 consolidate。

Promote 條件：

| 升級目標 | 條件 |
|---|---|
| observation -> instinct | 至少 2 筆相似 evidence，且 verifier 通過 |
| instinct -> skill / SOP | 已反覆出現，且能寫成具體流程 |
| instinct -> context plan | 有價值但還未定案 |
| instinct -> decision | 已被明確採用，且有影響範圍 |
| instinct -> user_rules.md | 高頻、跨專案、低爭議、需要每 session 生效 |

Decay 條件：

- 新 evidence 打臉舊規則。
- 適用範圍被發現太廣。
- 工具或 runtime 改版後規則失效。
- 使用者明確修正偏好。

## Phase 5：與 n8n / second-brain 整合

目標：把 agent-learning layer 納入既有 second-brain 管線，但仍以 Markdown 為源頭。

整合方式：

```text
agent-learning Markdown
  -> manifest / indexing queue
  -> chunk / embedding
  -> Qdrant index
  -> query-second-brain 回傳 lead
  -> AI 回讀原 Markdown 驗證
```

注意：

- Qdrant 只索引 observation / instinct / verifier report，不擁有真相。
- query 命中後必須回讀 vault source。
- verifier report 和 promote decision 應保留原始路徑。

## Phase 6：Self-modification 邊界

HyperAgents 的啟發是：meta agent 可以修改自己，讓「如何改進」這件事本身也進入演化範圍。

PixiuCore 不建議在早期開放完全自我修改。建議邊界：

- Phase 1-4：只允許提出候選 observation / instinct / skill。
- Phase 5：可自動建立 promote candidate，但不自動改 `user_rules.md`。
- Phase 6：若要允許自動修改 rules / skills，必須有人工 approval gate、diff review、rollback plan。

禁止事項：

- 不允許 agent 自動修改 `%PIXIU_CORE%\user_rules.md` 後立即生效。
- 不允許無 verifier 的 observation 升級成全域規則。
- 不允許把外部文章摘要直接寫成 accepted decision。
- 不允許把 secrets 或完整 transcripts 大量寫入 vault。

## 最小可行版本

最小版本只做五件事：

1. 建立 `agent-learning` 草案資料夾。
2. 建立 observation template。
3. 手動從 recap 或任務結果抽 observation。
4. 用人工 verifier checklist 檢查。
5. 每週或每 10-20 筆 observation 做一次 consolidation。

第一版不做：

- 自動 hook 寫入。
- 自動改 `user_rules.md`。
- 自動 promote。
- 完整 self-modifying agent。
- 直接依賴 Qdrant 查詢結果當結論。

## 待辦清單

- [ ] 確認是否建立 `vault/memory/agent-learning/` 目錄。
- [ ] 建立 `observation-template.md`。
- [ ] 建立 `instinct-template.md`。
- [ ] 從這次「進化agent」研究整理出第一筆 observation。
- [ ] 定義 verifier checklist 文件落點。
- [ ] 決定 consolidation 週期：每週一次或滿 10-20 筆。
- [ ] 決定是否讓 n8n Phase 2 索引 `agent-learning` 目錄。

## 參考來源

### Primary papers

- Self-Refine: https://arxiv.org/abs/2303.17651
- Reflexion: https://arxiv.org/abs/2303.11366
- Darwin Godel Machine: https://arxiv.org/abs/2505.22954
- HyperAgents: https://arxiv.org/abs/2603.19461
- Flavell 1979 DOI: https://doi.org/10.1037/0003-066X.34.10.906

### Docs / articles

- Claude Code Memory: https://code.claude.com/docs/en/memory
- Claude Code Hooks: https://code.claude.com/docs/en/hooks
- EEF Metacognition and Self-Regulation: https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit/metacognition-and-self-regulation
- Microsoft AI Agents - Metacognition: https://github.com/microsoft/ai-agents-for-beginners/blob/main/09-metacognition/README.md
- Galileo Self-Evaluation in AI Agents: https://galileo.ai/blog/self-evaluation-ai-agents-performance-reasoning-reflection
- Auto Dream analysis: https://claudefa.st/blog/guide/mechanics/auto-dream
- Auto Memory analysis: https://claudefa.st/blog/guide/mechanics/auto-memory

### Open source references

- everything-claude-code: https://github.com/affaan-m/everything-claude-code
- Hermes Agent: https://github.com/NousResearch/hermes-agent
- claude-meta: https://github.com/aviadr1/claude-meta
- memory-mcp: https://github.com/yuvalsuede/memory-mcp
- claude-mem: https://github.com/thedotmack/claude-mem
- Self-Refine implementation: https://github.com/madaan/self-refine
- HyperAgents implementation: https://github.com/facebookresearch/Hyperagents
- dream-skill: https://github.com/grandamenium/dream-skill

## 下一步建議

建議下一步先做 Phase 1，不碰 hook 與自動化：

```text
建立 agent-learning 目錄
  -> 建 observation / instinct template
  -> 把本次研究抽成 1-3 筆 observation
  -> 人工 verifier checklist
  -> 再決定是否進 Phase 2 deterministic capture
```

這樣能讓 PixiuCore 先得到一個乾淨、可回查、可人工控制的 agent-learning layer，再逐步接上 n8n / Qdrant / hooks。
