---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: PCLMS 保稅稽核
repo: PCLMS_BK_new
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P1]
source_paths:
  - "%GRAVITYTEST_ROOT%/PCLMS_BK_new"
  - "%GRAVITYTEST_ROOT%/PCLMS_BK_new/pom.xml"
  - "%GRAVITYTEST_ROOT%/PCLMS_BK_new/JAVA/pclms_bp/pom.xml"
summary: PCLMS_BK_new 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# PCLMS_BK_new — 2026-06-08 全面分析

## 定位

- 系統：PCLMS 保稅稽核
- 類型：BK batch / Maven multi-module
- 風險等級：P1
- 索引狀態：CodeGraph 654 files / 15,439 nodes / 32,017 edges；Java 626、YAML 18、Python 8、C 2

## 技術棧證據

- Maven parent: pclms_bk_parent version 140
- 子模組：JAVA/pclms_bp、JAVA/process_monitor_mvn、JAVA/jks
- 主要業務 JAR：pclms_bp
- Oracle ojdbc8、jmsClient-eqdq 1.3.0、tv-xdao 1.3.2
- log4j:log4j:1.2.17-fix1

## 架構觀察

- BK 層負責批次、排程、訊息、JMS/dispatch 類工作。
- process_monitor_mvn 與 jks 與 PFTZC_BK 有同名複本，屬跨 repo 技術債。
- pclms_bp 是主要業務模組，job、service、message、send 類套件是後續 trace 核心。

## 風險與注意事項

- Log4j 1.x 相容修正版仍是高風險技術債。
- 批次與 JMS 牽涉外部 queue，不能只靠單元測試判斷成功。
- process_monitor_mvn/jks 複製造成修補漂移風險。

## 下一步建議

- 優先建立 batch/job -> service -> mapper/xdao -> queue 的 trace 圖。
- 若要整理共用模組，先只做盤點，不直接抽 library。

## 本輪證據來源

- %GRAVITYTEST_ROOT%\PCLMS_BK_new
- %GRAVITYTEST_ROOT%\PCLMS_BK_new\pom.xml
- %GRAVITYTEST_ROOT%\PCLMS_BK_new\JAVA\pclms_bp\pom.xml

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
