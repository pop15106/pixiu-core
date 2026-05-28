---
type: convention
主題: "Vault 月份封存慣例"
版本: 1.0.0
日期: 2026-04-21
tags: [convention, archive, vault]
---

# Vault 月份封存慣例

## 核心原則

vault/memory 下所有用來累積紀錄的子目錄，**一律採用月份子資料夾封存**。

```text
vault/memory/
├── recaps/
│   ├── 2026-04/     ← 封存月份
│   ├── 2026-05/     ← 封存月份
│   └── （本月新檔放根層）
├── decisions/
│   ├── 2026-04/
│   └── （本月新檔放根層）
└── （未來新增的紀錄目錄同樣遵循此結構）
```

## 適用目錄

目前已套用：

- `vault/memory/recaps/` — Session Recap 紀錄
- `vault/memory/decisions/` — 重要決策紀錄

未來新增的紀錄型目錄（如 `learnings/`、`bugs/`、`experiments/` 等）**自動適用此慣例**，無需額外說明。

## 檔案存放規則

| 情境 | 存放位置 |
|------|---------|
| 本月新建的紀錄 | 目錄根層，例如 `recaps/2026-05-01-xxx.md` |
| 上個月的紀錄（月底或次月初封存） | 移入 `YYYY-MM/` 子資料夾 |
| 超過兩個月前的紀錄 | 已在對應月份子資料夾，不再移動 |

## 封存時機

每月 1 日首次 session 時觸發，由 AI 執行：

1. 在各紀錄目錄建立 `YYYY-MM/` 子資料夾（上個月份）
2. 將根層所有屬於上個月的檔案移入該資料夾
3. 在 Dashboard 封存舊月份 callout、新增本月 callout 預留位置

## Dashboard 呈現規則

每個紀錄區塊分兩層：

```markdown
## 📋 本月 [區塊名稱]

​```dataview
FROM "vault/memory/[目錄]"
WHERE !contains(file.folder, "20")   ← 只顯示根層（本月）
​```

> [!summary]- 📅 YYYY年M月 封存[紀錄類型]
>
> ​```dataview
> FROM "vault/memory/[目錄]/YYYY-MM"
> ​```
```

規則：

- 本月區塊：顯示根層檔案（無月份子資料夾的檔案）
- 封存 callout：預設**摺疊**（`-` 號），點擊展開
- 封存 callout 按月份新增，舊的不刪除

## 新增紀錄目錄的 SOP

新建一個 `vault/memory/xxx/` 目錄時，AI 需同步：

1. 確認目錄名稱是否為紀錄型（隨時間累積的內容）
2. 若是，在 Dashboard 加入對應的本月 + 封存 callout 區塊
3. 在本文件「適用目錄」清單追加該目錄
