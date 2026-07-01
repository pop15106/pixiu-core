---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: PCLMS 暫存
repo: pclms_ap_tmp
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P3]
source_paths:
  - "%GRAVITYTEST_ROOT%/pclms_ap_tmp"
summary: pclms_ap_tmp 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# pclms_ap_tmp — 2026-06-08 全面分析

## 定位

- 系統：PCLMS 暫存
- 類型：legacy tmp source slice
- 風險等級：P3
- 索引狀態：CodeGraph 8 files / 175 nodes / 302 edges；Java 7、JavaScript 1

## 技術棧證據

- 含 CSdisplay/CSlist/CSsave/CSupdate、Filter 類檔案
- 無完整 Maven manifest

## 架構觀察

- 看起來是 PCLMS AP 舊功能切片或暫存修補資料。
- 非完整可建置專案。

## 風險與注意事項

- 容易與 PCLMS_AP 正式 repo 混淆。
- 若要引用，需回正式 repo 驗證。

## 下一步建議

- 標記為 archive/tmp，避免作為 source of truth。

## 本輪證據來源

- %GRAVITYTEST_ROOT%\pclms_ap_tmp

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
