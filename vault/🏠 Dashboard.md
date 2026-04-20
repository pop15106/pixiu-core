---
type: dashboard
pinned: true
---

# 🏠 Pixiu 工作台

> AI × 人類的共用記憶中心。Claude 寫入，你在這裡查閱、編輯、延伸。

---

## 📥 Inbox — 給 AI 的任務清單

> 在這裡寫任務，Claude 讀到後會逐項執行。完成的項目 AI 會自動打勾。
> 觸發方式：在 Claude Code 說「**去看我的 inbox**」即可。

<!-- AI_INBOX_START -->
- [ ] 

<!-- AI_INBOX_END -->

---

## 📝 今日筆記

> 給自己的備忘、想法、AI 不需要執行的事。

<!-- 自由書寫區 -->

---

## 📋 最近 Session Recaps

```dataview
TABLE file.frontmatter.日期 AS 日期, file.frontmatter.主題 AS 主題, file.frontmatter.狀態 AS 狀態
FROM "vault/memory/recaps"
SORT file.frontmatter.日期 DESC
LIMIT 10
```

---

## ⚡ 進行中的工作

```dataview
TABLE file.frontmatter.主題 AS 主題, file.frontmatter.日期 AS 日期, file.frontmatter.負責AI AS 負責AI
FROM "vault/memory/recaps"
WHERE contains(file.frontmatter.狀態, "進行中")
SORT file.frontmatter.日期 DESC
```

---

## 🎯 最近決策

```dataview
TABLE file.frontmatter.決策 AS 決策, file.frontmatter.選擇 AS 選擇, file.frontmatter.原因 AS 原因
FROM "vault/memory/decisions"
SORT file.frontmatter.日期 DESC
LIMIT 8
```

---

## 🗂️ 快速導覽

- [[memory-summary|📊 記憶快照總覽]]
- [[vault/identity/founder-profile|👤 創辦人畫像]]
- [[vault/identity/agent-persona|🤖 Agent 人格設定]]
- [[vault/context/tech-stack|🔧 技術棧偏好]]
- [[vault/context/pclms-overview|📦 PCLMS 專案概覽]]
- [[vault/sop/dev-workflow|📐 開發 SOP]]
