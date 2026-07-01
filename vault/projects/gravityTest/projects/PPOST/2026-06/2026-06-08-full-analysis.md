---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: PPOST / 郵務與轉檔群
repo: PPOST
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P1]
source_paths:
  - "%GRAVITYTEST_ROOT%/PPOST"
  - "%GRAVITYTEST_ROOT%/PPOST/forward_post/ForwardPOST.sln"
  - "%GRAVITYTEST_ROOT%/PPOST/post/EHU.sln"
summary: PPOST 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# PPOST — 2026-06-08 全面分析

## 定位

- 系統：PPOST / 郵務與轉檔群
- 類型：C# WinForms/batch solution group
- 風險等級：P1
- 索引狀態：CodeGraph 550 files / 11,375 nodes / 20,270 edges；C# 545、YAML 3、Python 2

## 技術棧證據

- 多個 .sln/.csproj：forward_post、post、ec_convert、ec_receive、enplane_convert、postal_convert
- 主要語言 C#
- 大量 WinForms Designer、DBConnect、FTPTool、DataAdapter、Core/Share 模組

## 架構觀察

- 2026-05 舊盤點把 PPOST 判為空；本輪證明它是大型 C# 專案群。
- forward_post/ForwardPOST 是主要 UI/作業模組，含進貨、揀貨、裝箱、裝袋、資料傳送、權限管理。
- post 下有 TradeVan.Core/FormDataAdapter/POST/EHU 等多個 library/project。

## 風險與注意事項

- 無 git repo，且含大量壓縮檔與多份方案，版本來源需先釐清。
- DBConnect/FTPTool/DataAdapter 類檔案代表資料庫與檔案傳輸風險。
- WinForms Designer 大量生成碼，分析時需區分 UI 生成碼與業務碼。

## 下一步建議

- 先建立 solution/project 關係圖，再挑 ForwardPOST 與 post/TradeVan.* 做深入 trace。
- 先不要清理壓縮檔，需確認是否為歷史版本依據。

## 本輪證據來源

- %GRAVITYTEST_ROOT%\PPOST
- %GRAVITYTEST_ROOT%\PPOST\forward_post\ForwardPOST.sln
- %GRAVITYTEST_ROOT%\PPOST\post\EHU.sln

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
