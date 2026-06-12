---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: 外籍旅客退稅 E 指購
repo: perms
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P1]
source_paths:
  - "C:/Users/7010/Desktop/gravityTest/perms"
  - "C:/Users/7010/Desktop/gravityTest/perms/pom.xml"
  - "C:/Users/7010/Desktop/gravityTest/perms/src"
summary: perms 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# perms — 2026-06-08 全面分析

## 定位

- 系統：外籍旅客退稅 E 指購
- 類型：Struts2 WAR + MyBatis + reports
- 風險等級：P1
- 索引狀態：CodeGraph 701 files / 27,238 nodes / 61,419 edges；Java 291、JavaScript 268、TypeScript 123、YAML 12、Python 7；route 29

## 技術棧證據

- artifactId: APERMS，packaging WAR
- Spring 4.0.0.RELEASE
- Struts2 2.5.33
- MyBatis / mybatis-spring
- Log4j2 2.17.2 + log4j-1.2-api bridge
- Quartz、JasperReports plugin

## 架構觀察

- action 分 am/bu/dl/hq/mg/rt，多模組 XML 與 mapper SQL。
- jobservice/jobservice.impl 以及 quartz.properties 是排程分析入口。
- generic.rpt 與報表 procedure/mapper 是重點脈絡。

## 風險與注意事項

- Spring 4.0 與 servlet 2.4 老舊。
- 雖使用 Log4j2，但同時存在 slf4j-log4j12/log4j-1.2-api 相容層，需確認實際 binding。
- 已知使用者不接受 recap 當證據，PERMS 問題必須回 action/mapper/procedure。

## 下一步建議

- SQL 問題一律 CodeGraph/context -> action -> commonService/mapper。
- 報表問題優先 trace RptContext 與 mapper/procedure。

## 本輪證據來源

- C:\Users\7010\Desktop\gravityTest\perms
- C:\Users\7010\Desktop\gravityTest\perms\pom.xml
- C:\Users\7010\Desktop\gravityTest\perms\src

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
