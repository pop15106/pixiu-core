---
type: after-action
date: 2026-05-27
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: awesome-architecture-skillopt-integration
status: done
summary: 將 awesome-architecture（21 個架構模板）整合進 architect agent，並依 arxiv:2605.23904 實作完整的 SkillOpt 系統（agent + skill + session template + log/rejected buffer）。
tags: [after-action, pixiucore, architecture, skillopt, agent-upgrade]
---

# Awesome-Architecture + SkillOpt 整合 — After Action

## 背景

本輪繼 Anthropic-Cybersecurity-Skills 整合後，執行兩項 deferred 任務：
1. **awesome-architecture**：原 `architect.md` 只有通用設計原則，缺少具體架構模板選型指引，也沒有 AI-native 架構模式
2. **SkillOpt**：母體有 skill 生命週期的缺口 — 有 `skill-stocktake`（評估）和 `skill-creator`（新建），但沒有「優化既有 skill」的機制

---

## 交付清單

### awesome-architecture

| 檔案 | 路徑 | 說明 |
|------|------|------|
| 架構知識庫 | `.agent/knowledge/architecture-maps.md` | 21 個架構模板 + 選型矩陣 + 9 章摘要 |
| Architect agent 升級 | `.agent/agents/architect.md` | 加 Step 0（載入知識庫）、AI-native 原則、進化的選型流程 |

**architecture-maps.md 結構**：
- Part A：16 個經典架構（Layered / Hexagonal / Clean / DDD / CQRS / Event Sourcing / EDA / Microservices / Service Mesh / Strangler Fig / Saga / Outbox / BFF / API GW / Sidecar / Pipe-and-Filter）
- Part B：5 個 AI-native（RAG / Agent Loop / Multi-Agent / LLM Router / SkillOpt）
- Part C：選型速查矩陣（場景 → 推薦架構）
- Part D：9 章架構教程摘要

**architect.md 主要升級點**：
- Step 0：設計前先 Read `.agent/knowledge/architecture-maps.md`
- 10 條架構原則（原 5 條 + 5 條 AI-native 特有）
- 模式速查表（後端 + AI-native 雙表）
- 可擴展性規劃依使用者規模分級（< 10K / 10K-100K / 100K-1M / 1M+）

---

### SkillOpt 系統

| 檔案 | 路徑 | 說明 |
|------|------|------|
| Skill Optimizer agent | `.agent/agents/skill-opt.md` | 執行 skill 演化的 agent |
| Skill Opt skill | `skills/skill-opt/SKILL.md` | skill 本身的使用指引 |
| Session template | `vault/templates/skill-opt-session.md` | 每次優化的記錄模板 |
| 執行 log | `vault/memory/skill-opt-log.md` | 優化歷史紀錄 |
| Rejected buffer | `vault/memory/skill-opt-rejected.md` | 未通過驗證的編輯暫存 |

**SkillOpt 核心機制（arxiv:2605.23904）**：

| 概念 | 說明 | 母體實作 |
|------|------|---------|
| Skill as External State | Skill 文件 = 可微調的外部參數 | SKILL.md 是可 Edit 的一等公民 |
| Edit Budget | 每次優化有修改上限（防止過擬合）| Conservative（3處）/ Normal（5處）/ Aggressive |
| Validation Gate | 修改前必須通過三層測試 | Regression / Scope / Precision |
| Rejected-Edit Buffer | 未通過的編輯不丟棄 | `vault/memory/skill-opt-rejected.md` |
| Fast Update | 執行後立即微調 | Mode A（Post-Session）|
| Slow Update / Meta Update | 跨 session 結構重組 | Mode B（Scheduled）|

**4 個 Mode**：
- **Mode A**：單次執行後的快速修正
- **Mode B**：週期性結構重組（slow update）
- **Mode C**：Description 觸發精度優化
- **Mode D**：合併重複 skill

---

## Skill Lifecycle 完整圖

```
新建 skill → skill-creator
    ↓
評估品質 → skill-stocktake（Quick Scan / Full Stocktake）
    ↓
優化迭代 → skill-opt（Mode A/B/C/D + Validation Gate）
    ↓
退場 → skill-stocktake 評為 Retire → description 加 [DEPRECATED] → 30 天後刪除
```

---

## 架構決定紀錄（ADR）

### ADR-004：SkillOpt Edit Budget 分級設計

- **日期**：2026-05-27
- **決定**：三級 edit budget（Conservative / Normal / Aggressive），預設 Conservative
- **原因**：
  - Skill 是 agent 行為的核心，過激修改可能破壞已穩定的能力
  - Conservative 強制「小步快跑」，每次只改 3 處，保留可回滾空間
  - Aggressive 只在有 rejected buffer 積累作為依據時使用
- **替代方案**：無限制編輯（被否決：一次改太多難以追因）

### ADR-005：Rejected-Edit Buffer 而非直接丟棄

- **日期**：2026-05-27
- **決定**：未通過 Validation Gate 的編輯存入 `vault/memory/skill-opt-rejected.md`，不丟棄
- **原因**：
  - 「現在不對」≠「永遠不對」。某個修改在 3 個 session 後可能變得合理
  - Rejected buffer 是 slow update 的核心數據來源
  - 類比深度學習的 momentum：被「否決」的梯度方向仍保留部分影響力

---

## 後續待辦

- [ ] 第一次跑 skill-stocktake 後，用 skill-opt 實際演化 2-3 個評為 Improve 的 skill
- [ ] 考慮設定 skill-cron 定期觸發 skill-opt Slow Update
- [ ] awesome-architecture 的架構知識庫可考慮連結到 awesome-architecture GitHub repo 作為完整參考
