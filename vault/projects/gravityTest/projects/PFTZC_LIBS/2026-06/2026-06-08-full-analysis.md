---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: PFTZC 自貿港帳冊稽核
repo: PFTZC_LIBS
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P2]
source_paths:
  - "C:/Users/7010/Desktop/gravityTest/PFTZC_LIBS"
  - "C:/Users/7010/Desktop/gravityTest/PFTZC_LIBS/pom.xml"
summary: PFTZC_LIBS 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# PFTZC_LIBS — 2026-06-08 全面分析

## 定位

- 系統：PFTZC 自貿港帳冊稽核
- 類型：Shared Java library
- 風險等級：P2
- 索引狀態：CodeGraph 234 files / 7,950 nodes / 10,828 edges；Java 229、YAML 3、Python 2

## 技術棧證據

- artifactId: pftzc_lib
- tv-framework 1.2.2
- tv-xdao 1.1.9
- junit 4.13.2
- tv-easy 0.0.5

## 架構觀察

- PFTZC AP/BK 共用 library。
- 大量 enum/interface 顯示共用 domain 與代碼表承載。
- 與 PFTZC_AP_new、PFTZC_BK 的相容性是主要維護邊界。

## 風險與注意事項

- 共享 artifact 變更會同時影響 AP/BK。
- tv-xdao 1.1.9 與 AP/BK 版本可能不同，需確認相容性。

## 下一步建議

- 建立 AP/BK 對 pftzc_lib 的實際引用清單。

## 本輪證據來源

- C:\Users\7010\Desktop\gravityTest\PFTZC_LIBS
- C:\Users\7010\Desktop\gravityTest\PFTZC_LIBS\pom.xml

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
