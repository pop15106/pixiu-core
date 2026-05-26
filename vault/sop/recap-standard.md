# Pixiu Recap Standard - 跨 AI Session Recap 格式

> 本文件是 Claude、Gemini、Codex，以及未來任何寫入 PixiuCore 的 AI agent 共同遵守的 recap 契約。

## 適用範圍

- 當使用者說 `recap`、要求 session 摘要、詢問「現在到哪了」、或某個 phase/session 需要可交接紀錄時適用。
- 適用於所有專案與 repo。除非使用者另有指定，recap 一律寫入 active `%PIXIU_CORE%` vault。
- 若 AI 專屬 skill、prompt 或本地習慣與本文件衝突，以本 SOP 與 `vault/templates/session-recap.md` 為準。

## 語言規則

- 除 frontmatter key、狀態 enum、tag、路徑、repo 名稱、程式識別字、指令、SQL、錯誤碼、API 名稱、引用原文等必要技術文字外，recap 的標題、heading、summary、正文、註解與下一步必須使用繁體中文。
- `status` 維持英文 enum，避免破壞 Dataview 查詢。
- `topic`、檔名 slug、tag 可使用英文 kebab-case，確保跨工具穩定檢索。
- 若模板或舊 recap 使用英文 heading，仍必須在產出時轉成繁體中文 heading。

## 檔名規則

使用下列路徑：

```text
vault/memory/recaps/YYYY-MM-DD-HHMMSS-kebab-case-topic.md
```

規則：

- 使用本地時間。
- 檔名必須包含秒數 `HHMMSS`，避免同日檔名碰撞。
- 除非目前 vault 已改用月份資料夾，否則 recap 維持平放在 `vault/memory/recaps/`。
- timestamp 後方使用簡短 kebab-case slug。

## 必要 Frontmatter

每份 recap 必須以 Obsidian 相容 YAML 開頭：

```yaml
---
type: session-recap
date: YYYY-MM-DD
project: PROJECT_KEY
system: SYSTEM_KEY
repo: REPO_NAME
topic: kebab-case-topic
status: done | follow-up | paused | verified-local | data-fix-pending | procedure-pending
tags: [recap, project-key, topic-key]
source_paths:
  - C:/absolute/path/to/important/source
summary: 一句話摘要，說明本 recap 的核心結論或下一步。
---
```

欄位規則：

- `project`：Obsidian 中使用的專案 key，例如 `PCLMS_BK`、`PCLMS_AP`、`PTWCS`、`PEPIS`。
- `system`：業務或系統 key，例如 `PCLMS`、`PTWCS`、`PEPIS`。
- `repo`：只放短 repo 或 workspace 名稱，例如 `PCLMS_BK_new`、`PTWCS`；不要放完整 Windows 路徑。
- `topic`：穩定的 kebab-case topic slug。
- `status`：使用短英文狀態，維持 Dataview table 一致。
- `tags`：至少包含 `recap`、project/system key、topic key；必要時加入 repo 或 workflow tag。
- `source_paths`：repo tracing、程式調查、bugfix、SQL、文件、workflow recap 必填。完整路徑使用 forward slash。
- `summary`：必填。用一句繁體中文說明核心結論或下一步，方便在 Obsidian properties table 掃描。

## 正文結構

heading 可依任務微調，但必須保留下列資訊角色，且 heading 預設使用繁體中文：

1. 觸發與背景：為什麼發生這次 session。
2. 結論：根因、決策或目前狀態。
3. 證據與流程：關鍵檔案、呼叫鏈、SQL/table mapping、指令或產物。
4. 已做變更：改了哪些檔案，以及變更意圖。
5. 驗證：跑了哪些指令、是否通過。
6. 下一步：只列真實 follow-up 或仍開放的風險。

需要交接的 session 可加入 `AI_INBOX` block：

```markdown
<!-- AI_INBOX_START -->
- [ ] 具體下一步任務
<!-- AI_INBOX_END -->
```

## 跨 AI 要求

- Claude、Gemini、Codex 必須使用同一組 frontmatter keys。
- 除非正式修訂標準，否則不要新增模型專屬 frontmatter，例如 `負責AI` 或 `ai_model`。
- 若需要標示 authoring agent，放在正文或 footer，不要放在 frontmatter。
- 完成前要與最近同月份 recap 的 Properties 形狀比對，補齊缺漏欄位。
- 寫入後必須確認檔案存在，並檢查前 30 行，確認 frontmatter 完整且 summary 為繁體中文。
- 發現產出的 recap 正文大段英文時，必須立即修正為繁體中文，不得把英文模板視為例外。

## Template

標準模板位置：

```text
vault/templates/session-recap.md
```

當本 SOP 變更時，必須同步更新該模板。
