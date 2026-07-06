---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: PFTZC 自貿港帳冊稽核
repo: PFTZC_BK
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P1]
source_paths:
  - "%GRAVITYTEST_ROOT%/PFTZC_BK"
  - "%GRAVITYTEST_ROOT%/PFTZC_BK/pom.xml"
  - "%GRAVITYTEST_ROOT%/PFTZC_BK/JAVA/FTZC_BK/pom.xml"
summary: PFTZC_BK 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# PFTZC_BK — 2026-06-08 全面分析

## 定位

- 系統：PFTZC 自貿港帳冊稽核
- 類型：BK batch / Maven multi-module
- 風險等級：P1
- 索引狀態：CodeGraph 552 files / 17,610 nodes / 32,798 edges；Java 531、YAML 13、Python 8

## 技術棧證據

- Maven parent: PFTZC_BK_PARENT
- 子模組：JAVA/process_monitor_mvn、JAVA/FTZC_BK、JAVA/jks
- FTZC_BK packaging: jar
- Oracle ojdbc8、jmsClient-eqdq 1.2.5、tv-xdao 1.3.2
- log4j:log4j:1.2.17-fix1

## 架構觀察

- BK 層聚焦 business、controller、dispatchQueue、message、parser、service、task、utils、ftp。
- process_monitor_mvn 與 jks 與 PCLMS_BK_new 平行複製。
- doman 拼字仍是套件層技術債，未建議直接改名。

## 風險與注意事項

- Log4j 1.x 與 FTP/MQ 交界屬高風險。
- 複製模組造成修補不一致。
- 批次與外部檔案傳輸需保留驗證紀錄。

## 下一步建議

- 優先做 dispatchQueue/message/task 的 flow trace。
- 整理 process_monitor/jks 差異清單，但不先重構。

## 本輪證據來源

- %GRAVITYTEST_ROOT%\PFTZC_BK
- %GRAVITYTEST_ROOT%\PFTZC_BK\pom.xml
- %GRAVITYTEST_ROOT%\PFTZC_BK\JAVA\FTZC_BK\pom.xml

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
