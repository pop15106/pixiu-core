---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: PISSO / SSO
repo: pisso_ap
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P1]
source_paths:
  - "C:/Users/7010/Desktop/gravityTest/pisso_ap"
  - "C:/Users/7010/Desktop/gravityTest/pisso_ap/pom.xml"
summary: pisso_ap 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# pisso_ap — 2026-06-08 全面分析

## 定位

- 系統：PISSO / SSO
- 類型：Struts2 WAR + JS-heavy webapp
- 風險等級：P1
- 索引狀態：CodeGraph 767 files / 4,445 nodes / 7,077 edges；Java 102、JavaScript 643、PHP 22

## 技術棧證據

- artifactId: pisso，packaging WAR
- Struts2 2.5.33
- Spring core/context 2.5.6.SEC03
- Servlet API 3.0.1
- tv-isso-api 1.0.13、tv-saab-system 1.3.14
- log4j 1.2.17-fix1

## 架構觀察

- Java 數量少但 JavaScript 大量，應視為 SSO/SAAB Web 前端與少量後端組合。
- 與 tv-isso-api、psaab 同 family，pom 座標與依賴高度相似。
- tvCodeGen、vm 目錄存在，可能有產碼/模板流程。

## 風險與注意事項

- Spring 2.5.6、Log4j 1.x、Struts2 三者同時存在，安全債高。
- SSO 類系統牽涉認證入口，任何修補需做安全審查。

## 下一步建議

- 先畫 login/session/menu/token 流程，不先改。
- 與 psaab/tv-isso-api 做 library 邊界對照。

## 本輪證據來源

- C:\Users\7010\Desktop\gravityTest\pisso_ap
- C:\Users\7010\Desktop\gravityTest\pisso_ap\pom.xml

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
