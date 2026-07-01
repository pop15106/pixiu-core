---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: 台北關門禁系統
repo: PTWCS
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P0]
source_paths:
  - "%GRAVITYTEST_ROOT%/PTWCS"
  - "%GRAVITYTEST_ROOT%/PTWCS/ptwcs_ap/pom.xml"
  - "%GRAVITYTEST_ROOT%/PTWCS/ptwcs_ap/view/ptwcs_react/package.json"
  - "%GRAVITYTEST_ROOT%/PTWCS/ptwcs_ap/src/main/resources"
summary: PTWCS 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# PTWCS — 2026-06-08 全面分析

## 定位

- 系統：台北關門禁系統
- 類型：Spring Boot WAR + React
- 風險等級：P0
- 索引狀態：CodeGraph 1,074 files / 15,310 nodes / 28,476 edges；Java 681、JavaScript 361、JSX 5、YAML 16、Python 11；route 92

## 技術棧證據

- Spring Boot parent 2.3.2.RELEASE
- Java 1.8，packaging WAR
- Spring Security / Mail / Web / AOP
- Firebase Admin SDK 8.1.0
- MyBatis Spring Boot Starter 2.1.3
- React 18.2.0 + react-scripts 4.0.3

## 架構觀察

- 後端套件有 adapter/entity/usecase 分層，較接近六邊形架構。
- 前端位於 ptwcs_ap/view/ptwcs_react，另有 build 後資產進入 webapp。
- Firebase messaging 同時存在前端 compat JS 與後端 admin SDK。

## 風險與注意事項

- src/main/resources 內存在 Firebase service account JSON，檔案含 private_key 欄位，需立即輪替與移出 repo。
- application-local/test/generator properties 含 datasource password key/value，文件不記錄值但應列為秘密治理風險。
- Spring Boot 2.3.2 與 react-scripts 4 均已老舊。

## 下一步建議

- 優先處理秘密撤銷/輪替與 git history 風險評估。
- 再建立 adapter -> usecase -> repository/MyBatis 的核心流程圖。

## 本輪證據來源

- %GRAVITYTEST_ROOT%\PTWCS
- %GRAVITYTEST_ROOT%\PTWCS\ptwcs_ap\pom.xml
- %GRAVITYTEST_ROOT%\PTWCS\ptwcs_ap\view\ptwcs_react\package.json
- %GRAVITYTEST_ROOT%\PTWCS\ptwcs_ap\src\main\resources

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
