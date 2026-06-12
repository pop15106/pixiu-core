---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: ISSO 文件
repo: tv-isso-api-doc
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P3]
source_paths:
  - "C:/Users/7010/Desktop/gravityTest/tv-isso-api-doc"
summary: tv-isso-api-doc 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# tv-isso-api-doc — 2026-06-08 全面分析

## 定位

- 系統：ISSO 文件
- 類型：Documentation only
- 風險等級：P3
- 索引狀態：CodeGraph 0 files / 0 nodes / 0 edges；doc 目錄未被 CodeGraph 視為程式碼

## 技術棧證據

- doc 目錄

## 架構觀察

- 文件型目錄，應作為 tv-isso-api / PISSO family 的輔助資料。

## 風險與注意事項

- 文件可能與程式版本不同步，不能單獨當 source of truth。

## 下一步建議

- 需要 API 細節時，先對照 tv-isso-api 原始碼與 pom。

## 本輪證據來源

- C:\Users\7010\Desktop\gravityTest\tv-isso-api-doc

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
