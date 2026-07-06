---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: AI 研究工具
repo: pixiu-auto-research
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P3]
source_paths:
  - "%GRAVITYTEST_ROOT%/pixiu-auto-research"
  - "%GRAVITYTEST_ROOT%/pixiu-auto-research/package.json"
summary: pixiu-auto-research 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# pixiu-auto-research — 2026-06-08 全面分析

## 定位

- 系統：AI 研究工具
- 類型：Node ESM CLI/tool
- 風險等級：P3
- 索引狀態：CodeGraph 9 files / 97 nodes / 222 edges；JavaScript 8、YAML 1

## 技術棧證據

- package type: module
- scripts: cli、smoke
- 目錄：api、configs、docs、domains、experiments、scripts、src

## 架構觀察

- 獨立 AI research/tooling 專案，不是母體 pixiu-core。
- 體量小，適合以 smoke script 驗證。

## 風險與注意事項

- 無 git repo，版本追蹤需補。
- configs/domains 可能含工具策略，需避免與母體規則混淆。

## 下一步建議

- 補 git 或確認此目錄是否僅為本機實驗。

## 本輪證據來源

- %GRAVITYTEST_ROOT%\pixiu-auto-research
- %GRAVITYTEST_ROOT%\pixiu-auto-research\package.json

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
