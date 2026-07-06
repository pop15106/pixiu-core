---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: PCLMS 保稅稽核
repo: PCLMS_FD
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P2]
source_paths:
  - "%GRAVITYTEST_ROOT%/PCLMS_FD"
  - "%GRAVITYTEST_ROOT%/PCLMS_FD/pom.xml"
  - "%GRAVITYTEST_ROOT%/PCLMS_FD/pclms_fd/package.json"
summary: PCLMS_FD 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# PCLMS_FD — 2026-06-08 全面分析

## 定位

- 系統：PCLMS 保稅稽核
- 類型：FD / Java + React full-stack
- 風險等級：P2
- 索引狀態：CodeGraph 823 files / 20,399 nodes / 44,350 edges；Java 722、JavaScript 101

## 技術棧證據

- Maven parent: pclms-re-web
- 子模組：pclms_app、pclms_fd
- React package: react-pclms
- React 17.0.2、react-scripts 4.0.3、axios 0.21.1、react-redux 7.2.4
- WAR：pclms_fd

## 架構觀察

- 此專案不是純前端；CodeGraph 顯示 Java 檔數高於 JS，應視為 mixed full-stack。
- pclms_fd 是 React 前端，pclms_app/pclms-util 仍需當作 Java 後端/共用支援看待。
- 前端 build 與 Maven WAR 打包關係需在部署流程中另外確認。

## 風險與注意事項

- React scripts 4 與 axios 0.21.x 偏舊，前端供應鏈風險存在。
- Java 與 React 同 repo，變更時容易把前後端不同風險混在同一 commit。
- 既有 package-lock 應與 package.json 一起驗證。

## 下一步建議

- 後續以路由/頁面 -> API 呼叫 -> Java endpoint 的方式補交互圖。
- 先確認實際部署時 React build 是否被打進 WAR。

## 本輪證據來源

- %GRAVITYTEST_ROOT%\PCLMS_FD
- %GRAVITYTEST_ROOT%\PCLMS_FD\pom.xml
- %GRAVITYTEST_ROOT%\PCLMS_FD\pclms_fd\package.json

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
