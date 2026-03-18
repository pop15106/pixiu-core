---
name: troubleshooting-master
description: 專案經驗累積與問題解決大全。此 Skill 指引 AI 系統如何從錯誤、Runtime 異常及使用者反饋中學習，並將經驗沉澱為可移植的知識資產。
---

# Troubleshooting Master (問題解決方式大全)

## 📖 總覽

本 Skill 是本專案的「集體記憶中心」。它不只是指令，更是一套「經驗資產化」的流程，確保任何接手的 AI 都能繼承前人的修復經驗，避免重複犯錯。

## 📁 檔案結構 (靜動解耦架構)

```text
母艦端 (C:\PixiuCore\):
└── troubleshooting-master/
    ├── SKILL.md             ← 你正在看的全域執行規範 (靜態大腦)
    └── experience-ledger.md ← 全域通用經驗庫 (母艦記憶)

子專案端 (Working Workspace):
└── project-ledger.md        ← 當前專案專屬經驗庫 (動態記憶)
```

## 🚀 AI 執行規範 (SOP)

### 1. 任務啟動前：雙層檢索 (Dual-Search)

在處理技術問題前，必須依序檢索：

1. **母艦全域 (`C:\PixiuCore\...\experience-ledger.md`)**：確認是否有底層通用的解法。
2. **子專案區域 (`<WorkspaceRoot>\project_ledger.md`)**：確認是否有該專案特有的業務或技術債紀錄。

### 2. 任務執行中：比對與對齊

若紀錄與現狀吻合，優先引用。若子專案紀錄與母艦紀錄有衝突，以**子專案紀錄優先**（專案自治原則）。

### 3. 任務結束前：層級研判與寫入 (Sync & Distill)

在標記任務完成前，執行「具價值經驗提取」，並進行分流：

#### 分流 A：區域留存 (Local Retain)

- **對象**：涉及「專案業務邏輯」、「特定舊版 Code」、「專案特有變數/路徑」的問題。
- **動作**：僅寫入當前專案根目錄的 `project-ledger.md`。嚴禁污染母艦。

#### 分流 B：全域淬鍊 (Global Distillation)

- **對象**：涉及「通用基礎建設 (Git/Docker/環境)」、「主流框架通病」、「工程流程規範」的問題。
- **動作**：
    1. 寫入本地 `project-ledger.md` 作為備份。
    2. 啟動「淬鍊」：抹除專案隱私與路徑，抽象為通用法則。
    3. **寫回母艦**：將法則追加至 `C:\PixiuCore\...\experience-ledger.md`，供 50 個子專案同步受惠。

## 📝 經驗紀錄基準 (Ledger Standard)

為了確保知識的高品質，紀錄時需遵守：

- **精簡**：去除無關的草稿，只保留最終有效的指令或 Code。
- **準確**：標註錯誤發生的具體環境（如：Windows CMD, Java 17）。
- **可搜尋**：使用清晰的 `#標籤`。

## 🛠️ 維護與瘦身規範 (Maintenance & Distillation)

為了確保知識庫不會因過載而影響 AI 效能，必須執行以下管理：

### 1. 動態合併 (Refactoring on the Fly)

- **規則**：寫入新紀錄前，必須檢查是否有相似主題。
- **動作**：若已有 80% 相似度之紀錄，應採取「更新舊紀錄」或「合併為通用原則」，嚴禁無效追加。

### 2. 容量警示臨界點 (Thresholds)

- **警示線**：當帳本超過 **30** 條紀錄或 **500** 行時觸發。
- **處理流程**：AI 必須主動向 User 發起「歸納重構提案」。

### 3. 三段式瘦身法

- **歸納 (Condense)**：將多個碎片 Bug 總結為一條開發準則，存入 `user_rules.md` 或本文件的規範區。
- **歸檔 (Archive)**：將過時紀錄移動到 `archive/` 目錄。
- **刪除 (Purge)**：刪除無參考價值的「一次性錯誤」。

## 📚 延伸閱讀

- [全域經驗儲儲庫 - experience-ledger.md](experience-ledger.md)
