---
type: after-action
date: 2026-05-27
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: cybersecurity-library-integration
status: done
summary: 將 Anthropic-Cybersecurity-Skills（754 個技能）以 git submodule 引入母體，升級 security-reviewer agent 為多技術棧架構，並完成 security-review skill 的 stack-agnostic 重構。
tags: [after-action, pixiucore, security, submodule, skill-integration, security-reviewer]
---

# Cybersecurity Library 整合 — After Action

## 背景

母體的 `security-reviewer` agent 與 `security-review` skill 原本只針對 TypeScript / Next.js / Supabase 架構，充斥著 `process.env`、`npm audit`、`bcrypt.compare()` 等框架硬綁定。當專案切換到 Java / Spring MVC 時，審查結果毫無參考價值。

本次整合目標：
1. 引入 [Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) — 754 個資安技能，含 MITRE ATT&CK / OWASP / NIST CSF 三種 mapping
2. 讓 `security-reviewer` 具備 tech-stack 自動偵測能力
3. 讓 `security-review` skill 成為真正 stack-agnostic 的通用清單

---

## 交付清單

### Layer 1：Git Submodule

| 項目 | 路徑 | 說明 |
|------|------|------|
| `.gitmodules` | 根目錄 | 指向 `https://github.com/mukul975/Anthropic-Cybersecurity-Skills.git` |
| 技能庫 | `skills/cybersecurity-library/` | 754 個技能，submodule 掛載 |

技能庫結構：
```
skills/cybersecurity-library/
├── skills/          ← 754 個個別技能目錄（各含 SKILL.md）
├── mappings/
│   ├── owasp/       ← OWASP Top 10 2025 mapping
│   ├── mitre-attack/ ← ATT&CK v14（218 個技術覆蓋）
│   └── nist-csf/
└── index.json
```

Subdomain 分布（前 10）：
| Subdomain | 技能數 |
|-----------|--------|
| cloud-security | 63 |
| threat-hunting | 56 |
| threat-intelligence | 54 |
| network-security | 43 |
| web-application-security | 42 |
| malware-analysis | 39 |
| digital-forensics | 37 |
| soc-operations | 33 |
| identity-access-management | 33 |
| container-security | 29 |

### Layer 2：5 個高頻域熱路徑 Skill

安裝路徑：`.agent/skills/<domain>/SKILL.md`

| Skill | Subdomain（庫內） | 技能數 |
|-------|-----------------|--------|
| `web-application-security` | web-application-security | 42 |
| `api-security` | api-security | 28 |
| `iam-and-access-control` | identity-access-management | 33 |
| `devsecops` | devsecops + container-security | 17+29 |
| `vulnerability-management` | vulnerability-management | 25 |

每個 skill 包含：通用安全原則 + 各技術棧對應表 + 快速掃描命令 + 深查 grep 指令。

### Layer 3：核心檔案升級

**`.agent/agents/security-reviewer.md`**
- 新增 Step 0：tech-stack 偵測（Java/Maven、Node.js、Python、Go）
- Step 1-4：所有 scan 命令依偵測到的 stack 切換
- Step 3：新增 AI/LLM 系統安全掃描（prompt injection、RAG 資料隔離、tool-calling output sanitization）
- 雙層深查表：熱路徑 `.agent/skills/` + 完整庫 `grep -rl "subdomain: <name>" skills/cybersecurity-library/skills/`

**`skills/security-review/SKILL.md`**
- 移除 TypeScript / Next.js 硬綁定
- 每個安全項目新增「技術棧對應表」（Java / Node.js / Python / Go）
- 保留原有結構，加「依實際 stack 套用」標注
- 新增「深查域技能」快速索引表

---

## 踩坑紀錄

### 1. Sandbox git 操作被 index.lock 阻擋

**問題**：Sandbox 無法執行 `git submodule add`，`.git/index.lock` 被鎖死、也無法刪除。

**原因**：Cowork sandbox 掛載的是 overlay filesystem，`.git/` 下的 lock 檔由宿主機 Claude Code process 持有，sandbox 無法 unlink。

**解法**：
- Sandbox 只寫 `.gitmodules` 文字設定檔
- 實際 `git submodule add` 交給使用者在本機 Git Bash 執行

### 2. 以為 cybersecurity-library 是 domain 目錄結構

**問題**：原始設計預設技能是按 domain 目錄分群（`skills/cybersecurity-library/web-application-security/`），寫錯了 5 個 domain skill 的 source 路徑與 security-reviewer 的深查表。

**實際結構**：754 個技能是**扁平的個別技能目錄**，依 `subdomain` frontmatter 欄位分類，不是目錄結構。

**解法**：
- 用 `grep -r "^subdomain:" skills/cybersecurity-library/skills/*/SKILL.md | sort | uniq -c` 還原真實分布
- 將所有路徑改為 `grep -rl "subdomain: <name>" skills/cybersecurity-library/skills/`
- 更新 security-reviewer 深查表加入 cloud-security（63）、threat-hunting（56）等庫內最大 domain

### 3. Submodule 初始化殘留狀態

**問題**：Sandbox 失敗的 git 操作在 `.git/modules/skills/cybersecurity-library/` 留下損壞的 config 文件，導致使用者第一次跑 `git submodule add` 失敗（`fatal: not a git repository`）。

**解法**：
```bash
rm -rf .git/modules/skills/cybersecurity-library
rm -rf skills/cybersecurity-library
git submodule add https://github.com/mukul975/Anthropic-Cybersecurity-Skills.git skills/cybersecurity-library
```

---

## 架構決定紀錄（ADR）

### ADR-002：Cybersecurity Library 引入方式 — Submodule vs. 直接複製

- **日期**：2026-05-27
- **決定**：Git Submodule（不直接複製 754 個技能進 git history）
- **原因**：
  - 754 個技能 ~12.54 MiB，直接 commit 進 repo 會污染 git history
  - Submodule 保留 upstream 更新能力（`git submodule update --remote`）
  - 不需要全部載入，只在需要時 grep 對應 subdomain
- **代價**：新成員需跑 `git submodule update --init --recursive` 才能拿到技能庫

### ADR-003：Security Skill 雙層設計 — 熱路徑 + 完整庫

- **日期**：2026-05-27
- **決定**：5 個高頻 domain 手寫 SKILL.md 進 `.agent/skills/`，作為「熱路徑」；完整 754 個技能以 grep 查詢方式「按需深查」
- **原因**：
  - 全量 754 個技能在 agent context 中一次載入成本過高（~22,600 tokens）
  - 80% 的日常審查只需要 web / api / iam / devsecops / vuln-mgmt 五個域
  - 熱路徑已包含各 stack 的操作指引，無需每次查閱完整庫
- **深查觸發條件**：遇到 cloud 架構、威脅獵捕、事件回應、滲透測試等非日常場景時，透過 grep 定向載入

---

## 後續待辦

- [ ] 新成員 onboarding：在 vault README 加 `git submodule update --init --recursive` 提示
- [ ] 考慮加入 `deferred: awesome-architecture` → `.agent/knowledge/architecture-maps.md`
- [ ] 考慮加入 `deferred: SkillOpt` → `skill-opt` agent + skill + session template
