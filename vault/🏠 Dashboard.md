---
type: dashboard
pinned: true
---

# 🏠 Pixiu Dashboard
> 這裡是母體 vault 的工作入口，整理近期 recap、進行中的工作、決策與常用索引。

---

## 📥 Inbox 與 AI 待辦
> 保留目前的 AI 待辦區塊，之後若有 workflow 寫入，也建議沿用這段穩定入口。
<!-- AI_INBOX_START -->
- [ ] 將 GitHub repo 要放在個人帳號。

- [ ] 若要真正 push，先建立獨立 Git repo 或把 `second-brain/` subtree 拆出去。 請給我建議

- [ ] 視需要補 `sample.env` 或 GitHub Release 說明。

- [ ] 若要跨平台支援 Linux/macOS，再補 `.sh` 版 deploy script。

<!-- AI_INBOX_END -->

---

## 📌 近期 Session Recaps

```dataview
TABLE WITHOUT ID
  file.link AS File,
  project AS 專案,
  date AS 日期,
  summary AS 主題,
  recap_mode AS 模式,
  狀態中文 AS 狀態,
  file.folder AS 位置
FROM "vault/memory/recaps"
FLATTEN choice(status = "verified-local", "已在本地驗證",
  choice(status = "follow-up", "待追蹤",
  choice(status = "paused", "暫停",
  choice(status = "draft", "草稿",
  choice(status = "active", "進行中",
  choice(status = "candidate", "候選",
  choice(status = "done", "完成",
  choice(status = "completed", "完成",
  choice(status = "accepted", "已採納", status))))))))) AS 狀態中文
WHERE file.ext = "md"
SORT date DESC, file.name DESC
LIMIT 10
```

> [!summary]- Recaps 依專案與月份存放
> ```dataview
> TABLE WITHOUT ID
>   file.link AS File,
>   project AS 專案,
>   date AS 日期,
>   summary AS 主題,
>   recap_mode AS 模式,
>   狀態中文 AS 狀態,
>   file.folder AS 位置
> FROM "vault/memory/recaps"
> FLATTEN choice(status = "verified-local", "已在本地驗證",
  choice(status = "follow-up", "待追蹤",
  choice(status = "paused", "暫停",
  choice(status = "draft", "草稿",
  choice(status = "active", "進行中",
  choice(status = "candidate", "候選",
  choice(status = "done", "完成",
  choice(status = "completed", "完成",
  choice(status = "accepted", "已採納", status))))))))) AS 狀態中文
> WHERE file.ext = "md"
> SORT file.folder ASC, date DESC, file.name DESC
> ```

---

## ⚡ 進行中的工作

```dataview
TABLE WITHOUT ID
  file.link AS File,
  project AS 專案,
  狀態中文 AS 狀態
FROM "vault"
FLATTEN choice(status = "verified-local", "已在本地驗證",
  choice(status = "follow-up", "待追蹤",
  choice(status = "paused", "暫停",
  choice(status = "draft", "草稿",
  choice(status = "active", "進行中",
  choice(status = "candidate", "候選",
  choice(status = "done", "完成",
  choice(status = "completed", "完成",
  choice(status = "accepted", "已採納", status))))))))) AS 狀態中文
WHERE file.ext = "md"
AND status
AND (
  status = "follow-up"
  OR status = "paused"
  OR status = "draft"
  OR status = "active"
  OR status = "candidate"
)
AND type != "dashboard"
AND type != "knowledge-index"
AND type != "project-index"
SORT date DESC, file.name DESC
```

---

## 🎯 最近決策

```dataview
TABLE WITHOUT ID
  file.link AS File,
  decision AS 決策,
  date AS 日期,
  狀態中文 AS 狀態
FROM "vault/memory/decisions"
FLATTEN choice(status = "verified-local", "已在本地驗證",
  choice(status = "follow-up", "待追蹤",
  choice(status = "paused", "暫停",
  choice(status = "draft", "草稿",
  choice(status = "active", "進行中",
  choice(status = "candidate", "候選",
  choice(status = "done", "完成",
  choice(status = "completed", "完成",
  choice(status = "accepted", "已採納", status))))))))) AS 狀態中文
WHERE file.ext = "md" AND !contains(file.folder, "2026-04")
SORT date DESC, file.name DESC
LIMIT 8
```

> [!summary]- 2026 年 4 月封存 Decisions
> ```dataview
> TABLE WITHOUT ID
>   file.link AS File,
>   decision AS 決策,
>   date AS 日期,
>   狀態中文 AS 狀態
> FROM "vault/memory/decisions/2026-04"
> FLATTEN choice(status = "verified-local", "已在本地驗證",
  choice(status = "follow-up", "待追蹤",
  choice(status = "paused", "暫停",
  choice(status = "draft", "草稿",
  choice(status = "active", "進行中",
  choice(status = "candidate", "候選",
  choice(status = "done", "完成",
  choice(status = "completed", "完成",
  choice(status = "accepted", "已採納", status))))))))) AS 狀態中文
> WHERE file.ext = "md"
> SORT date DESC, file.name DESC
> ```

---

## 🧭 常用入口

- [[memory/memory-summary|記憶摘要]]
- [[identity/founder-profile|Founder Profile]]
- [[identity/agent-persona|Agent Persona]]
- [[context/tech-stack|Tech Stack]]
- [[context/pclms-overview|PCLMS Overview]]
- [[sop/dev-workflow|開發 SOP]]

## 📚 專案 Recap 入口

- [[projects/PCLMS/index|PCLMS]]
- [[projects/PEPIS/index|PEPIS]]
- [[projects/Second_Brain/index|Second Brain]]
- [[projects/PixiuCore/index|PixiuCore]]
- [[projects/PISSO/index|PISSO]]
- [[projects/AUTO_RESEARCH/index|Auto Research]]
- [[projects/DOCX_TOOLING/index|DOCX Tooling]]
- [[projects/OPENSPEC/index|OpenSpec]]

## 🗂 其他區塊入口

- [[after-action/index|After-Action]]
- [[context/index|Context]]
- [[memory/agent-learning/README|Agent Learning]]

## 🛠 整理工程入口

- [[context/recap-organization-plan|Recap 整理計畫]]
- [[context/recap-normalization-backlog|Recap 正規化待辦]]
- [[context/decision-normalization-status|Decision 正規化狀態]]
- [[context/metadata-standard-after-action-context|After-Action / Context Metadata 標準]]
