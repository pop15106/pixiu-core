---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: SAAB / SSO family
repo: psaab
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P1]
source_paths:
  - "%GRAVITYTEST_ROOT%/psaab"
  - "%GRAVITYTEST_ROOT%/psaab/pom.xml"
summary: psaab 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# psaab — 2026-06-08 全面分析

## 定位

- 系統：SAAB / SSO family
- 類型：JS-heavy webapp + minimal Java
- 風險等級：P1
- 索引狀態：CodeGraph 140 files / 541 nodes / 730 edges；JavaScript 138、Java 2

## 技術棧證據

- pom 座標與 pisso_ap 類似：com.tradevan.isso:pisso WAR
- Struts2 2.5.33
- Spring 2.5.6.SEC03
- tv-isso-api 1.0.13、tv-saab-system 1.3.14
- log4j 1.2.17-fix1

## 架構觀察

- CodeGraph 顯示主要是 JavaScript，Java 僅 2 檔。
- 可能是 SAAB/SSO family 的前端或輕量 web layer。
- 與 pisso_ap 高度重疊，後續需確認是否為 fork/部署變體。

## 風險與注意事項

- 老舊 Spring/Struts/Log4j 風險與 pisso_ap 相同。
- pom 座標與 pisso_ap 相同可能造成 artifact/部署識別混淆。

## 下一步建議

- 比較 psaab 與 pisso_ap 的 package/diff，確認實際部署角色。

## 本輪證據來源

- %GRAVITYTEST_ROOT%\psaab
- %GRAVITYTEST_ROOT%\psaab\pom.xml

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
