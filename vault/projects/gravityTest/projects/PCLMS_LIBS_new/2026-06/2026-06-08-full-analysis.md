---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: PCLMS 保稅稽核
repo: PCLMS_LIBS_new
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P1]
source_paths:
  - "C:/Users/7010/Desktop/gravityTest/PCLMS_LIBS_new"
  - "C:/Users/7010/Desktop/gravityTest/PCLMS_LIBS_new/pom.xml"
summary: PCLMS_LIBS_new 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# PCLMS_LIBS_new — 2026-06-08 全面分析

## 定位

- 系統：PCLMS 保稅稽核
- 類型：Shared Java library
- 風險等級：P1
- 索引狀態：CodeGraph 289 files / 8,886 nodes / 11,774 edges；Java 289

## 技術棧證據

- artifactId: pclms-lib
- Spring 3.2.15.RELEASE
- Quartz 2.3.2
- tv-framework 1.0.4、tv-easy 0.0.5
- commons-configuration 1.4、commons-collections4 4.2

## 架構觀察

- PCLMS 共用 library，AP 已明確依賴此 artifact。
- 大量 enum/interface/method 節點顯示它承載共用 domain 與工具邏輯。
- 任何修改都應以 PCLMS_AP/PCLMS_BK_new 影響範圍一起評估。

## 風險與注意事項

- 共用 library 的小改可能同時影響 AP、BK、FD。
- Spring 3.2 仍存在於 library 層，升級需先做依賴相容矩陣。

## 下一步建議

- 建立 exported API / 被 AP-BK 使用點清單。
- 先用 CodeGraph impact 查高共用類別，再決定是否改。

## 本輪證據來源

- C:\Users\7010\Desktop\gravityTest\PCLMS_LIBS_new
- C:\Users\7010\Desktop\gravityTest\PCLMS_LIBS_new\pom.xml

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
