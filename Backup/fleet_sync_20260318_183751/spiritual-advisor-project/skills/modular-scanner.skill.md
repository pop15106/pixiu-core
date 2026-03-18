---
name: modular-scanner
description: |
  模組切割掃描器 (Modular Scanner)。自動掃描專案結構，識別領域邊界，
  為每個功能模組生成專屬的 .skill.md 檔案，降低 AI 幻覺並加速開發。
  配套 Workflow: /modular-scan
license: MIT
compatibility: Pixiu Agent / Claude Code / Cursor / Antigravity
metadata:
  author: pixiu
  version: "1.1"
  category: architecture
---

# Modular Scanner Skill - 模組切割掃描器

> **用途**：自動將專案拆解為獨立的領域模組，並為每個模組生成標準化的 Skill 檔案，使 AI 在後續開發中能精準載入所需上下文。

---

## 核心理念

**問題**：當 AI 處理大型專案時，過多的上下文會導致：
- 🧠 **幻覺 (Hallucination)**：混淆不同模組的變數與邏輯
- 🐌 **分析速度下降**：Token 浪費在無關程式碼上
- ❌ **情境誤判**：錯認 A 模組的邏輯為 B 模組的行為

**解法**：將專案切割為獨立的「領域 Skill」，每個 Skill 包含該模組的完整契約定義，AI 只需載入相關 Skill 即可精準工作。

---

## 粒度等級定義 (Granularity Levels)

模組切割的粗細程度可透過「粒度等級」控制，共分三級：

| 等級 | 代號 | 適用場景 | 切割策略 |
|------|------|---------|----------|
| 粗切 | `coarse` | 小型專案（< 20 檔案）/ 快速概覽 | 依「頂層資料夾」合併，一個頂層目錄 = 一個模組 |
| 標準 | `standard` | 中型專案（20~80 檔案），**預設值** | 依「邊界識別規則」切割（見 Phase 2） |
| 細切 | `fine` | 大型專案（> 80 檔案）/ 微服務架構 | 依「單一檔案職責」，獨立 Hook/Util/Type 皆可成模組 |

### 粒度決策邏輯

AI 依序檢查以下條件，取第一個命中的結果：

1. **使用者明確指定** → 使用指定值（如 `/modular-scan --granularity=fine`）
2. **設定檔存在** → 讀取專案根目錄 `.modular-scanner.json` 的 `granularity` 欄位
3. **自動推斷** → 計算 `src/`（或主要程式碼目錄）下的檔案總數：
   - `< 20` → `coarse`
   - `20 ~ 80` → `standard`
   - `> 80` → `fine`

> **設定檔範例** `.modular-scanner.json`：
> ```json
> {
>   "granularity": "fine",
>   "excludeDirs": ["node_modules", "dist", ".next"]
> }
> ```

---

## 執行流程 (Pipeline)

### Phase 1：技術棧偵測
> 依賴：`tech-stack.skill.md`

1. 偵測前端/後端框架、資料庫、部署環境
2. 識別套件管理器與版本
3. 輸出技術棧摘要

### Phase 2：領域邊界掃描

掃描以下目錄結構，識別獨立的功能領域：

**前端掃描路徑**（依框架調整）：
```
src/components/     → 識別 UI 元件群組
src/pages/ 或 src/app/  → 識別頁面/路由模組
src/services/       → 識別 API 串接層
src/hooks/          → 識別共用邏輯
src/contexts/       → 識別狀態管理邊界
```

**後端掃描路徑**：
```
routes/ 或 api/     → 識別 API 端點群組
models/             → 識別資料模型
services/           → 識別業務邏輯層
utils/              → 識別共用工具
```

**邊界識別規則**（依粒度等級套用不同策略）：

#### `standard` 模式（預設）
| 訊號 | 判定 |
|------|------|
| 獨立的元件檔案 + 對應的 API 端點 | 一個領域模組 |
| 共享的 Context/Hook 被多個元件引用 | 一個共用層模組 |
| 獨立的資料模型 + 計算邏輯 | 一個引擎模組 |
| 認證/權限/付費相關 | 一個基礎設施模組 |

#### `coarse` 模式（合併導向）
| 訊號 | 判定 |
|------|------|
| 同一頂層目錄下的所有元件 | 合併為一個模組 |
| 所有 Hook + Context + Util | 合併為一個「共用層」模組 |
| 認證 + 付費 + 權限 | 合併為一個「平台基礎」模組 |

#### `fine` 模式（拆分導向）
| 訊號 | 判定 |
|------|------|
| 單一元件檔案有獨立邏輯 | 獨立成模組 |
| 每個 Hook / Custom Hook | 獨立成模組 |
| 每個 Util / Helper 檔案 | 獨立成模組 |
| 每個 API Route 檔案 | 獨立成模組 |

### Phase 3：生成領域 Skill

為每個識別到的模組，生成標準格式的 `.skill.md`：

```markdown
---
name: [模組名稱]-module
description: |
  [模組中文名] 領域模組規範。定義資料結構、API 契約、UX 行為與錯誤處理。
  由 modular-scanner 自動生成。
metadata:
  author: modular-scanner
  version: "1.0"
  category: domain-module
  generated_at: [時間戳]
---

# [模組名稱] Module Skill

## 1. 資料結構 (Data Contract)
> 此模組的核心 TypeScript/Python 型別定義

## 2. API 端點 (API Endpoints)
> 前後端通訊的端點、方法、請求/回應格式

## 3. 狀態管理 (State Management)
> 此模組管理的狀態與其生命週期

## 4. UX 行為規範 (UX Behavior)
> 載入態、錯誤態、成功態的互動細節
> (若已有 UxSoul 手冊，引用連結即可)

## 5. 錯誤處理 (Error Handling)
> 此模組可能的錯誤情境與處理策略

## 6. 依賴關係 (Dependencies)
> 此模組依賴的其他模組或共用層
```

### Phase 4：索引更新

1. 將生成的 Skills 加入 `AGENTS.md` 的 `skills` 索引
2. 在 `skill-trigger.shared.md` 中加入對應的觸發關鍵字
3. 更新 `skills.registry.yaml`

---

## 輸出範例

掃描完成後，輸出摘要：

```markdown
🔍 模組切割掃描完成

| # | 模組名稱 | 類型 | 生成檔案 | 涵蓋範圍 |
|---|---------|------|---------|---------|
| 1 | auth-trial | 基礎設施 | auth-trial-module.skill.md | 登入、API Key、試用額度 |
| 2 | tarot-engine | 領域 | tarot-engine-module.skill.md | 抽牌、牌義、AI 解讀 |
| 3 | ziwei-engine | 領域 | ziwei-engine-module.skill.md | 排盤、宮位、四化 |
| ... | ... | ... | ... | ... |

📁 已生成 N 個 Skill 檔案至 `.agent/skills/`
📝 已更新 AGENTS.md 索引
🎯 已更新 skill-trigger 觸發規則
```

---

## 注意事項

- **不改動程式碼**：此 Skill 只做分析與文件化，不修改任何原始碼
- **人工確認**：生成的 Skill 草稿需經使用者確認後才正式納入
- **增量更新**：可重複執行，會偵測已存在的模組 Skill 並標記差異
- **搭配使用**：建議搭配 `UxSoul-extractor.skill.md` 一起使用，可產出更精細的 UX 意圖分析

---

## 觸發關鍵字

以下關鍵字會觸發此 Skill 的建議：
`模組切割`、`拆模組`、`模組化`、`切分`、`領域拆分`、`domain split`、`modularize`、`module scan`
