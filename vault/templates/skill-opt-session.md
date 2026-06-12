---
type: skill-opt-session
date: {{date}}
skill: {{skill-name}}
mode: {{A|B|C|D}}
status: {{in-progress|completed|rejected}}
summary: {{一行摘要}}
tags: [skill-opt, {{skill-name}}]
---

# Skill Opt Session — {{skill-name}}

## 問題描述

> 在什麼情境下發現這個 skill 需要優化？

[描述觸發本次優化的具體事件]

## 問題類型

- [ ] 缺少必要步驟
- [ ] 步驟順序錯誤
- [ ] 技術棧範例不符
- [ ] 觸發率過低（漏觸發）
- [ ] 觸發率過高（誤觸發）
- [ ] 結構性問題（需要重組）
- [ ] 與其他 skill 重複（需合併）

## 選定 Mode

- [ ] Mode A — Fast Update（Conservative，≤ 3 處）
- [ ] Mode B — Slow Update（Normal/Aggressive）
- [ ] Mode C — Description Optimization
- [ ] Mode D — Merge

## Edit Budget

| 預算 | 上限 | 本次使用 |
|------|------|---------|
| Conservative | 3 處，每處 < 10 行 | — |
| Normal | 5 處，每處 < 20 行 | — |
| Aggressive | 結構重組，需完整 3-layer gate | — |

**本次選用**：[Conservative / Normal / Aggressive]
**使用量**：[X] / [上限]

## 變更內容

### 變更 1
**位置**：[行號或段落]
**原文**：
```
[原始內容]
```
**修改後**：
```
[新內容]
```
**理由**：[為什麼這樣改]

（依需求複製以上區塊）

## Validation Gate

### Test 1 — Regression（典型任務）
| 任務 | 修改前 | 修改後 | 結果 |
|------|--------|--------|------|
| [任務1] | ✓/✗ | ✓/✗ | Pass/Fail |
| [任務2] | ✓/✗ | ✓/✗ | Pass/Fail |
| [任務3] | ✓/✗ | ✓/✗ | Pass/Fail |

### Test 2 — Scope
修改後 skill 的適用範圍：[ ] 縮小了 [ ] 不變 [ ] 擴大了
說明：[補充]

### Test 3 — Precision（不應觸發的情境）
| 情境 | 應觸發？ | 修改後是否誤觸發？ |
|------|---------|-----------------|
| [情境1] | 否 | 否 / 是（問題！）|
| [情境2] | 否 | 否 / 是（問題！）|

## 最終結果

- [ ] **Pass** — 已套用 Edit，記錄到 `vault/memory/skill-opt-log.md`
- [ ] **Fail** — 已記錄到 `vault/memory/skill-opt-rejected.md`，等下次 Slow Update

## 下一步

- [ ] 觀察 1-3 個 session，確認優化有效
- [ ] 需要進行 Slow Update（結構性問題）
- [ ] 進行 Merge（重複問題）
- [ ] 完成，無需追蹤

---
*模板位置：vault/templates/skill-opt-session.md*
*使用方式：複製此模板到 vault/memory/ 或直接在對話中填寫*
