---
type: project-analysis-index
date: 2026-06-08
project: gravityTest
system: gravityTest
repo: gravityTest
topic: comprehensive-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, index]
source_paths:
  - "%GRAVITYTEST_ROOT%"
  - "%PIXIU_CORE%/vault/projects/gravityTest/00_overview/inventory-summary.md"
  - "%PIXIU_CORE%/vault/projects/gravityTest/01_inventory/project-registry.md"
summary: 2026-06-08 針對 gravityTest 除 pixiu-core 母體外 22 個項目的 CodeGraph 初始化與全面靜態分析索引。
---

# gravityTest — 2026-06-08 全面分析索引

## 範圍

- 分析根目錄：%GRAVITYTEST_ROOT%
- 排除母體：pixiu-core
- 本輪納入：22 個非母體目錄
- 寫入方式：每個專案依 projects/<repo>/2026-06/2026-06-08-full-analysis.md 歸檔
- CodeGraph：22 個非母體目錄均已初始化 .codegraph；claude-parity-skills-package 與 tv-isso-api-doc 為 0 程式碼索引，屬文件/技能包類型

## 舊盤點更正

- 2026-05-12 舊文件記錄 19 個子專案；本輪現況是 22 個非母體項目。
- PFTZB 不是 0 Java/廢棄空殼；CodeGraph 索引到 1,152 files，含 984 個 Java 檔，主要位於 PFTZB/PFTZB_AP-master。
- PPOST 不是空目錄；CodeGraph 索引到 550 files，主要是 C# solution/project 群。
- PCLMS_FD 不是純前端；CodeGraph 顯示 722 Java + 101 JavaScript，應視為 mixed full-stack/FD 專案。
- 新增/補入 PISSO family：pisso_ap、psaab、tv-isso-api、tv-isso-api-doc。

## 總表

| 專案 | 系統 | 類型 | 風險 | CodeGraph/語言概況 | 文件 |
|---|---|---|---|---|---|
| PCLMS_AP | PCLMS 保稅稽核 | AP Web / legacy Spring MVC | P1 | CodeGraph 756 files / 17,332 nodes / 42,878 edges；Java 642、JavaScript 98、Python 10、YAML 6 | [[../projects/PCLMS_AP/2026-06/2026-06-08-full-analysis|分析]] |
| PCLMS_BK_new | PCLMS 保稅稽核 | BK batch / Maven multi-module | P1 | CodeGraph 654 files / 15,439 nodes / 32,017 edges；Java 626、YAML 18、Python 8、C 2 | [[../projects/PCLMS_BK_new/2026-06/2026-06-08-full-analysis|分析]] |
| PCLMS_FD | PCLMS 保稅稽核 | FD / Java + React full-stack | P2 | CodeGraph 823 files / 20,399 nodes / 44,350 edges；Java 722、JavaScript 101 | [[../projects/PCLMS_FD/2026-06/2026-06-08-full-analysis|分析]] |
| PCLMS_LIBS_new | PCLMS 保稅稽核 | Shared Java library | P1 | CodeGraph 289 files / 8,886 nodes / 11,774 edges；Java 289 | [[../projects/PCLMS_LIBS_new/2026-06/2026-06-08-full-analysis|分析]] |
| PFTZC_AP_new | PFTZC 自貿港帳冊稽核 | AP Web / Spring MVC + Struts2 | P1 | CodeGraph 888 files / 27,811 nodes / 66,716 edges；Java 553、JavaScript 317、YAML 12、Python 4、PHP 2 | [[../projects/PFTZC_AP_new/2026-06/2026-06-08-full-analysis|分析]] |
| PFTZC_BK | PFTZC 自貿港帳冊稽核 | BK batch / Maven multi-module | P1 | CodeGraph 552 files / 17,610 nodes / 32,798 edges；Java 531、YAML 13、Python 8 | [[../projects/PFTZC_BK/2026-06/2026-06-08-full-analysis|分析]] |
| PFTZC_LIBS | PFTZC 自貿港帳冊稽核 | Shared Java library | P2 | CodeGraph 234 files / 7,950 nodes / 10,828 edges；Java 229、YAML 3、Python 2 | [[../projects/PFTZC_LIBS/2026-06/2026-06-08-full-analysis|分析]] |
| PFTZB | PFTZB 自貿港舊系統 | Legacy Java WAR | P0 | CodeGraph 1,152 files / 24,452 nodes / 94,103 edges；Java 984、JavaScript 158、YAML 6、Python 4 | [[../projects/PFTZB/2026-06/2026-06-08-full-analysis|分析]] |
| PTWCS | 台北關門禁系統 | Spring Boot WAR + React | P0 | CodeGraph 1,074 files / 15,310 nodes / 28,476 edges；Java 681、JavaScript 361、JSX 5、YAML 16、Python 11；route 92 | [[../projects/PTWCS/2026-06/2026-06-08-full-analysis|分析]] |
| pepis_ap | 通關金流平台 / PEPIS | Struts2 WAR + Vue/React frontends | P1 | CodeGraph 1,406 files / 34,416 nodes / 85,067 edges；Java 1,186、JavaScript 176、Vue 41、TypeScript 1、PHP 2 | [[../projects/pepis_ap/2026-06/2026-06-08-full-analysis|分析]] |
| perms | 外籍旅客退稅 E 指購 | Struts2 WAR + MyBatis + reports | P1 | CodeGraph 701 files / 27,238 nodes / 61,419 edges；Java 291、JavaScript 268、TypeScript 123、YAML 12、Python 7；route 29 | [[../projects/perms/2026-06/2026-06-08-full-analysis|分析]] |
| pisso_ap | PISSO / SSO | Struts2 WAR + JS-heavy webapp | P1 | CodeGraph 767 files / 4,445 nodes / 7,077 edges；Java 102、JavaScript 643、PHP 22 | [[../projects/pisso_ap/2026-06/2026-06-08-full-analysis|分析]] |
| psaab | SAAB / SSO family | JS-heavy webapp + minimal Java | P1 | CodeGraph 140 files / 541 nodes / 730 edges；JavaScript 138、Java 2 | [[../projects/psaab/2026-06/2026-06-08-full-analysis|分析]] |
| tv-isso-api | ISSO API library | Java library | P1 | CodeGraph 33 files / 632 nodes / 1,173 edges；Java 33 | [[../projects/tv-isso-api/2026-06/2026-06-08-full-analysis|分析]] |
| ProjectCreater | AI 工具 | Next.js tool | P3 | CodeGraph 33 files / 247 nodes / 514 edges；TSX 17、TypeScript 13、JavaScript 2、YAML 1 | [[../projects/ProjectCreater/2026-06/2026-06-08-full-analysis|分析]] |
| pixiu-auto-research | AI 研究工具 | Node ESM CLI/tool | P3 | CodeGraph 9 files / 97 nodes / 222 edges；JavaScript 8、YAML 1 | [[../projects/pixiu-auto-research/2026-06/2026-06-08-full-analysis|分析]] |
| blankP | AI 評估/模板輔助 | Python/YAML helper | P3 | CodeGraph 8 files / 56 nodes / 79 edges；Python 5、YAML 3 | [[../projects/blankP/2026-06/2026-06-08-full-analysis|分析]] |
| claude-parity-skills-package | AI skill package | Docs/skills package | P3 | CodeGraph 0 files / 0 nodes / 0 edges；無可解析程式碼 | [[../projects/claude-parity-skills-package/2026-06/2026-06-08-full-analysis|分析]] |
| pclms_ap_tmp | PCLMS 暫存 | legacy tmp source slice | P3 | CodeGraph 8 files / 175 nodes / 302 edges；Java 7、JavaScript 1 | [[../projects/pclms_ap_tmp/2026-06/2026-06-08-full-analysis|分析]] |
| pclms_bk_tmp | PCLMS 暫存 | legacy tmp source slice | P3 | CodeGraph 1 file / 10 nodes / 15 edges；Java 1 | [[../projects/pclms_bk_tmp/2026-06/2026-06-08-full-analysis|分析]] |
| PPOST | PPOST / 郵務與轉檔群 | C# WinForms/batch solution group | P1 | CodeGraph 550 files / 11,375 nodes / 20,270 edges；C# 545、YAML 3、Python 2 | [[../projects/PPOST/2026-06/2026-06-08-full-analysis|分析]] |
| tv-isso-api-doc | ISSO 文件 | Documentation only | P3 | CodeGraph 0 files / 0 nodes / 0 edges；doc 目錄未被 CodeGraph 視為程式碼 | [[../projects/tv-isso-api-doc/2026-06/2026-06-08-full-analysis|分析]] |

## 跨專案風險矩陣

- P0：PTWCS 有 Firebase service account JSON 與 datasource password 設定檔跡象；文件不保存秘密值，但需優先輪替與移出 repo。
- P0：PFTZB 使用 Struts 1.2.4 與 Log4j 1.2.12，若仍在使用，風險高於 2026-05 舊盤點所示。
- P1：PCLMS_BK_new、PFTZC_BK、pisso_ap、psaab 仍有 Log4j 1.x family 依賴或相容層。
- P1：tv-isso-api/pom.xml 本輪 XML parser 顯示 dependency 標籤不成對，需先釐清是否為暫存破損或實際 build 風險。
- P1：PCLMS/PFTZC 多處仍使用 Spring 3.x/4.x、Servlet 2.x、Struts2 2.3/2.5 等高齡技術。
- P2：process_monitor_mvn 與 jks 在 PCLMS_BK_new/PFTZC_BK 重複存在，屬修補漂移風險。
- P3：工具/文件/暫存目錄缺 git 或缺 build manifest，需先界定是否納入正式治理。

## 後續建議順序

1. 先做 P0/P1 安全治理：PTWCS secrets、PFTZB Struts/Log4j、BK/PISSO Log4j、tv-isso-api pom 健康度。
2. 再做核心業務 flow tracing：PCLMS AP/BK/LIBS、PFTZC AP/BK/LIBS、pepis_ap、perms。
3. 最後整理工具與暫存：ProjectCreater、pixiu-auto-research、blankP、claude-parity-skills-package、pclms_*_tmp、tv-isso-api-doc。

## 索引副作用

CodeGraph 初始化會在各專案建立 .codegraph/ 與 .cursor/rules/codegraph.mdc。在 git repo 中這些可能呈現未追蹤檔，請勿與業務變更混入同一 commit；若要提交，應另行決策。
