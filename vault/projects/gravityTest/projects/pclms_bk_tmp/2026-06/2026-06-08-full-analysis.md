---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: PCLMS 暫存
repo: pclms_bk_tmp
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P3]
source_paths:
  - "%GRAVITYTEST_ROOT%/pclms_bk_tmp"
summary: pclms_bk_tmp 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# pclms_bk_tmp — 2026-06-08 全面分析

## 定位

- 系統：PCLMS 暫存
- 類型：legacy tmp source slice
- 風險等級：P3
- 索引狀態：CodeGraph 1 file / 10 nodes / 15 edges；Java 1

## 技術棧證據

- 僅 ConnectSupplier.java 與 ver 目錄

## 架構觀察

- 非完整 BK 專案，只是暫存片段。

## 風險與注意事項

- 不可拿來推論 PCLMS_BK_new 現行行為。

## 下一步建議

- 若無保留需求，列入封存/清理候選。

## 本輪證據來源

- %GRAVITYTEST_ROOT%\pclms_bk_tmp

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
