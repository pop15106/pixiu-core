---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: ISSO API library
repo: tv-isso-api
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P1]
source_paths:
  - "C:/Users/7010/Desktop/gravityTest/tv-isso-api"
  - "C:/Users/7010/Desktop/gravityTest/tv-isso-api/pom.xml"
summary: tv-isso-api 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# tv-isso-api — 2026-06-08 全面分析

## 定位

- 系統：ISSO API library
- 類型：Java library
- 風險等級：P1
- 索引狀態：CodeGraph 33 files / 632 nodes / 1,173 edges；Java 33

## 技術棧證據

- artifactId: tv-isso-api，version 1.0.13，packaging JAR
- 依賴 tv-saab-api/system、tv-webcomponent、tv-xdao
- pom 原文可見 Spring 6.2.2、Log4j2 2.20.0 等依賴

## 架構觀察

- 小型 Java library，供 pepis_ap/pisso_ap/psaab 等系統引用。
- API library 是 SSO/公告/登入相關問題的共用依賴之一。

## 風險與注意事項

- pom.xml 目前不是 well-formed XML，parser 顯示 dependency 標籤不成對；這是建置/維護高風險。
- 作為共用 library，任何版本異動會影響多個 SSO/PEPIS/SAAB 系統。

## 下一步建議

- 先修正或確認 pom 是否為暫存破損檔，再做依賴風險評估。
- 用 callers/impact 查 IssoAnnouncementDO、login/session 相關類別。

## 本輪證據來源

- C:\Users\7010\Desktop\gravityTest\tv-isso-api
- C:\Users\7010\Desktop\gravityTest\tv-isso-api\pom.xml

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
