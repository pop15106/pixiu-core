---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: 通關金流平台 / PEPIS
repo: pepis_ap
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P1]
source_paths:
  - "%GRAVITYTEST_ROOT%/pepis_ap"
  - "%GRAVITYTEST_ROOT%/pepis_ap/pom.xml"
  - "%GRAVITYTEST_ROOT%/pepis_ap/view/CCPS/package.json"
  - "%GRAVITYTEST_ROOT%/pepis_ap/view/ccps_re/package.json"
summary: pepis_ap 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# pepis_ap — 2026-06-08 全面分析

## 定位

- 系統：通關金流平台 / PEPIS
- 類型：Struts2 WAR + Vue/React frontends
- 風險等級：P1
- 索引狀態：CodeGraph 1,406 files / 34,416 nodes / 85,067 edges；Java 1,186、JavaScript 176、Vue 41、TypeScript 1、PHP 2

## 技術棧證據

- artifactId: pepis_ap，packaging WAR
- Spring 5.2.8.RELEASE
- Struts2 2.5.33
- Servlet API 2.4 / JSP 2.0
- tv-isso-api 1.0.13、tv-saab-*、tv-xdao 1.1.9
- view/CCPS: Vue 2.7.16；view/ccps_re: React 17.0.2

## 架構觀察

- Java 後端最大，前端同時存在 Vue 2 CCPS 與 React ccps_re。
- conf/struts2.xml、conf/saab/saab_api_sql.xml、conf/xdao_sql.xml 是入口/SQL 關鍵。
- 近期香港/登入/公告相關調查已在記憶中，後續需以現行 source diff 為準。

## 風險與注意事項

- Struts2 與 servlet 2.4 歷史風險高。
- Lombok 0.10.0-RC3 極舊。
- 前端 axios 0.21.x、Vue CLI 4/CRA 4 偏舊。
- 與 SSO/SAAB/ISSO library 高耦合。

## 下一步建議

- 對外 endpoint 先從 struts2.xml/convention/action trace。
- SSO/announcement/menu 類問題要同查 tv-isso-api、psaab/pisso_ap。

## 本輪證據來源

- %GRAVITYTEST_ROOT%\pepis_ap
- %GRAVITYTEST_ROOT%\pepis_ap\pom.xml
- %GRAVITYTEST_ROOT%\pepis_ap\view\CCPS\package.json
- %GRAVITYTEST_ROOT%\pepis_ap\view\ccps_re\package.json

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
