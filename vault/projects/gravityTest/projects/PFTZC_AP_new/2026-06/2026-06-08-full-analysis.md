---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: PFTZC 自貿港帳冊稽核
repo: PFTZC_AP_new
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P1]
source_paths:
  - "%GRAVITYTEST_ROOT%/PFTZC_AP_new"
  - "%GRAVITYTEST_ROOT%/PFTZC_AP_new/pom.xml"
  - "%GRAVITYTEST_ROOT%/PFTZC_AP_new/JAVA/pftzc_mvn/pom.xml"
summary: PFTZC_AP_new 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# PFTZC_AP_new — 2026-06-08 全面分析

## 定位

- 系統：PFTZC 自貿港帳冊稽核
- 類型：AP Web / Spring MVC + Struts2
- 風險等級：P1
- 索引狀態：CodeGraph 888 files / 27,811 nodes / 66,716 edges；Java 553、JavaScript 317、YAML 12、Python 4、PHP 2

## 技術棧證據

- Maven parent: pftzc-web-parent，子模組 JAVA/pftzc_mvn
- WAR：pftzc_web
- Spring MVC 3.2.15.RELEASE
- Struts2 2.3.24.3
- Log4j2 2.17.1 bridge / core
- Oracle ojdbc6、tv-xdao 1.0.15、JMSQueue/jmseqdq

## 架構觀察

- AP 層混合 Struts2、Spring MVC、Jersey REST 與大量 JS。
- 套件包含 action、dao、domain/code/dto/utils、restful、interceptor、excelprinter。
- 與 PFTZC_LIBS 透過 pftzc_lib 連動。

## 風險與注意事項

- Struts2 2.3.x 與 Spring 3.2 同時偏舊，RCE/維護風險高。
- Servlet API 2.5 與 commons-dbcp 1.x 顯示容器模型老舊。
- REST、Struts action、DAO 混用，trace 時要按入口分流。

## 下一步建議

- 優先建立 action/restful -> dao/service -> pftzc_lib 的地圖。
- 把 JS 前端資產與 Java endpoint 分開分析。

## 本輪證據來源

- %GRAVITYTEST_ROOT%\PFTZC_AP_new
- %GRAVITYTEST_ROOT%\PFTZC_AP_new\pom.xml
- %GRAVITYTEST_ROOT%\PFTZC_AP_new\JAVA\pftzc_mvn\pom.xml

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
