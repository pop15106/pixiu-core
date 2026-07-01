---
name: skill-opt
description: Optimize, improve, or evolve a SKILL.md document based on execution feedback. Use when a skill repeatedly underperforms, when you want to tighten trigger precision, when merging duplicate skills, or when running a skill evolution cycle. MANDATORY TRIGGERS: "optimize skill", "improve skill", "skill underperforms", "skill evolution", "skill-opt", "refine skill", "skill not triggering". Do NOT use for creating brand new skills from scratch (use skill-creator instead).
origin: ECC
source: arxiv:2605.23904
version: "1.0"
---

# Skill Optimization（SkillOpt）

> **理論基礎**：SkillOpt (arxiv:2605.23904) — 把 SKILL.md 文件視為「可訓練的外部狀態」，用類似深度學習的 edit budget + validation gate 機制漸進優化。

## 快速判斷：選哪個 Mode？

```
skill 本次執行結果不對 → Mode A（Fast Update）
跨多個 session 都有問題 → Mode B（Slow Update）
skill 觸發頻率不對 → Mode C（Description Optimization）
多個 skill 重複功能 → Mode D（Merge）
```

---

## Mode A：Post-Session Fast Update

**觸發**：某個 skill 在本 session 漏步驟 / 建議錯誤 / 技術棧不對

### Step 1：問題定位
```
問題類型：
□ 缺少必要步驟
□ 步驟順序錯誤
□ 範例程式碼技術棧不符
□ 清單項目遺漏
□ 描述不精確導致 agent 誤解
```

### Step 2：套用 Edit Budget（Conservative）
- 最多修改 **3 處**
- 每處修改 **< 10 行**
- 不改整體結構
- 不改 frontmatter `name` / `description`

### Step 3：Validation Gate
修改前在心中過以下三個測試：

**Test 1 — Regression**：過去能用這個 skill 處理的 3 個典型任務，修改後還能處理嗎？

**Test 2 — Scope**：修改有沒有讓 skill 的適用範圍意外擴大或縮小？

**Test 3 — Precision**：有沒有引入新的歧義？

### Step 4：執行
- 通過 → Edit SKILL.md，記錄到 `vault/memory/skill-opt-log.md`
- 未通過 → 記錄到 `vault/memory/skill-opt-rejected.md`，等 Slow Update

---

## Mode B：Slow Update（週期性結構重組）

**觸發**：3 次以上 Fast Update 都沒有根本解決問題；或 skill-stocktake 評為需要重構

### Step 1：讀取歷史
```bash
# 查看此 skill 的優化歷史
grep -A10 "<skill-name>" vault/memory/skill-opt-log.md
grep -A5 "<skill-name>" vault/memory/skill-opt-rejected.md
```

### Step 2：套用 Edit Budget（Normal / Aggressive）
- **Normal**：允許重寫最多 30% 的內容，保留核心結構
- **Aggressive**：允許完全重構，但需要完整的 3-layer Validation Gate

### Step 3：完整 Validation Gate（三層）
1. **Layer 1 — Description Coverage**：所有 MANDATORY TRIGGERS 在新 description 中有對應
2. **Layer 2 — Regression Smoke**：列出 5 個典型任務，逐一確認
3. **Layer 3 — Precision**：列出 3 個不應觸發的情境，確認不誤觸發

### Step 4：執行 + 備份
```bash
# 備份原始版本
cp skills/<skill-name>/SKILL.md vault/memory/skill-backups/<skill-name>-YYYY-MM-DD.md
# 套用新版本
# Edit skills/<skill-name>/SKILL.md
```

---

## Mode C：Description Optimization（觸發精度）

**觸發**：skill 應觸發時沒觸發 / 不應觸發時卻觸發

### Description 優化公式

```markdown
description: [核心功能一句話]. Use when [觸發情境].
MANDATORY TRIGGERS: [關鍵字1], [關鍵字2], [關鍵字3].
Do NOT use for [排除情境].
```

### 觸發率分析
```
觸發率太低 → 加 MANDATORY TRIGGERS
觸發率太高 → 加 "Do NOT use for..."
描述太長 → 精簡，只留觸發關鍵字
描述太短 → 補充使用情境
```

### 驗證方法
給自己出 5 題情境判斷題：
> 「這個情境下，我（作為 LLM）會選這個 skill 嗎？」

期望答案與實際行為一致 → 優化成功。

---

## Mode D：Merge（合併重複 Skill）

**觸發**：發現兩個 skill 覆蓋 80% 以上相同功能

### 步驟
1. 確認兩個 skill 的核心差異
2. 決定保留哪一個作為主 skill
3. 將另一個的獨特內容 merge 進主 skill
4. 在被合併的 skill frontmatter 加：
   ```yaml
   status: deprecated
   merged-into: <main-skill-name>
   deprecated-date: YYYY-MM-DD
   ```
5. 不立即刪除，保留 30 天後觀察

---

## 記錄模板

每次優化完，追加到 `vault/memory/skill-opt-log.md`：

```markdown
## [YYYY-MM-DD] [skill-name] — Mode [A/B/C/D]

- **問題**：[具體描述]
- **變更摘要**：[改了什麼]
- **Edit Budget**：[X/3 Conservative | X/5 Normal | Aggressive]
- **Validation**：[Pass ✓ | Fail ✗]
- **失敗原因**（若 Fail）：[說明]
- **下一步**：[進入 Slow Update | 需觀察 | 完成]
```

---

## 常見問題速查

| 症狀 | 診斷 | Mode |
|------|------|------|
| Agent 用了 skill 但結果不完整 | 缺少步驟 | A |
| Skill 從來不被選中 | Description 觸發關鍵字不夠 | C |
| Skill 太常被誤用 | Description 範圍太廣 | C |
| 修了好幾次還是不對 | 結構性問題 | B |
| 兩個 skill 功能重疊 | 冗餘 | D |
| Skill > 200 行 | 過重，考慮拆分 | B（拆分） |

---

*配合工具：skill-stocktake（評估）+ skill-creator（新建）+ skill-opt（優化）= 完整 skill lifecycle*
