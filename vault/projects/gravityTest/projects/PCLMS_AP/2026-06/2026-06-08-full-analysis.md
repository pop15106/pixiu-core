---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: PCLMS 保稅稽核
repo: PCLMS_AP
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P1]
source_paths:
  - "C:/Users/7010/Desktop/gravityTest/PCLMS_AP"
  - "C:/Users/7010/Desktop/gravityTest/PCLMS_AP/pom.xml"
  - "C:/Users/7010/Desktop/gravityTest/PCLMS_AP/JAVA/pclms_mvn/pom.xml"
summary: PCLMS_AP 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# PCLMS_AP — 2026-06-08 全面分析

## 定位

- 系統：PCLMS 保稅稽核
- 類型：AP Web / legacy Spring MVC
- 風險等級：P1
- 索引狀態：CodeGraph 756 files / 17,332 nodes / 42,878 edges；Java 642、JavaScript 98、Python 10、YAML 6

## 技術棧證據

- Maven parent: pclms-web-parent，子模組 JAVA/pclms_mvn
- WAR：pclms_web
- Spring MVC 3.2.15.RELEASE
- Servlet API 2.5 / JSP 2.0
- Oracle ojdbc6 11.2.0.1.0
- tv-xdao 1.3.2、tv-framework 1.0.8、pclms-lib

## 架構觀察

- AP 層集中在 JAVA/pclms_mvn，主要由 servlet、service/impl、resources/conf/xdao.xml 組成。
- 既有 working tree 有多個業務檔案修改；本分析只記錄現況，不判斷這些修改是否應提交。
- CodeGraph 初始化新增 .codegraph 與 .cursor 規則，需視為工具索引檔，勿混入業務 commit。

## 風險與注意事項

- Spring 3.2 與 Servlet 2.5 皆屬高齡基礎，安全與升級風險高。
- xdao.xml 與 Oracle 連線設定屬資料層高風險區，任何調整要回到 SQL/交易邊界驗證。
- 服務層檔案如 CalBalance/GoodsBalance/Grnt/OutNMonths 屬高耦合核心，不宜局部猜修。

## 下一步建議

- 後續分析優先建立 UI/Servlet -> Service -> xdao SQL -> DB table 的 trace。
- 庫存、擔保品、月彙報問題應與 PCLMS_LIBS_new 一起看。

## 本輪證據來源

- C:\Users\7010\Desktop\gravityTest\PCLMS_AP
- C:\Users\7010\Desktop\gravityTest\PCLMS_AP\pom.xml
- C:\Users\7010\Desktop\gravityTest\PCLMS_AP\JAVA\pclms_mvn\pom.xml

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
