---
type: session-recap
date: 2026-04-29
project: AUTO_RESEARCH
system: PIXIUCORE
repo: pixiu-auto-research
topic: core-implementation-plan
status: done
tags: [recap, session, pixiucore, auto-research, agent-team]
summary: 規劃 Pixiu Auto Research Core 的實作方案，整合 agent-team 與核心流程設計。
---

# Session Recap：Pixiu Auto Research Core 實作方案

## 🎯 任務目標與背景

使用者想建立一套「Agent Team + Auto Research」架構，參考 Paradigm Autoresearch Hackathon 冠軍案例：多個 AI agent 平行產生策略、執行模擬、評估分數，並在停滯時透過 reset agent 從已驗證結論重新探索。

本次討論釐清：Pixiu 目前已有 agents、orchestration、DevFleet、loop-operator 等多 agent 底座，但要達到完整研究閉環，還需要補齊四個核心元件：Evaluator、Experiment Registry、Reset Protocol、Budget / Stop Rule。

本次任務目標是先產出一份 DOCX 實作方案，而非直接修改 PixiuCore 架構或撰寫程式碼。

## ✅ 本次完成

1. 判斷本次不啟用 agent team：任務為單一路徑文件產出與 recap，不需要平行 agent。
2. 產出 DOCX：$docxPath。
3. 文件內容涵蓋：通用核心與 domain plugin 分層、四個核心元件、SAST 報告分析 MVP、Agent Team 角色分工、檔案結構、Phase 計畫、風險治理。
4. 驗證：artifact-tool renderer 執行失敗且無 stderr；改用 Word COM 成功匯出 PDF：$pdfPath。
5. 驗證：PDF 共 8 頁，文字抽取 6243 字，確認包含 Pixiu Auto Research Core、Evaluator、Experiment Registry、Reset Protocol、Budget / Stop Rule 等關鍵內容。
6. 補充視覺檢查：使用 PDF.js + Node canvas 產出 8 頁 PNG 總覽，確認頁面結構正常，無空白頁、明顯重疊或表格爆版；但 PDF.js 對中文字型呈方框，判定為 renderer 字型限制而非 DOCX 文字缺失。

## 🔄 進行中

目前步驟：實作方案文件已完成，等待使用者審閱後決定是否進入實作 Phase。

整體進度：1 / 1 Phase 完成。

各 Phase 狀態：
- Phase 1 架構討論：✅完成
- Phase 2 DOCX 實作方案產出：✅完成
- Phase 3 Recap 回寫母體：✅完成

卡點：artifact-tool 仍無法在本機可靠渲染 DOCX；本次已用 Word COM + PDF 文字抽取 + PDF.js 結構總覽替代驗收。

## 📐 當前規劃完整內容

Auto Research 架構採「通用核心 + domain plugin」：

Auto Research Core（通用）：
- runner：執行研究迴圈
- agent-dispatcher：分派 strategy / implement / review 類任務
- registry：記錄 experiment、candidate、score、artifact
- budget：控制時間、次數、成本、失敗率
- reset：soft reset / hard reset
- report：產出 run report、best candidate、recap

Research Domain Plugin（依案例）：
- evaluator：本案例的自動評分器
- dataset：測試資料與 golden set
- candidate.schema：候選產物格式
- mutation rules：允許 agent 嘗試的修改範圍
- safety rules：禁止行為與風險閘門

建議第一個 MVP domain：SAST 報告分析。

原因：SAST 報告有固定輸入、固定輸出、可建立 golden set，且評分指標可量化。比交易策略安全，也比通用文件審查更容易驗證。

MVP Phase：
1. Core Skeleton：runner、registry、budget config、基本 CLI。
2. SAST Evaluator：sast-analysis evaluator、rubric、sample dataset。
3. Agent Loop：strategy → candidate → evaluator → registry → best。
4. Reset：soft reset / hard reset、research_brief.md。
5. Governance：budget、stop rule、risk flags、recap report。

## 🎯 重要決策（含棄選方案）

| 決策點 | 選擇 | 棄選方案 | 原因 |
|--------|------|---------|------|
| Auto Research 架構 | 通用核心 + Domain Plugin | 全部硬做成單一通用黑盒 | 評分器、資料集、候選格式必須 by case；核心流程可共用 |
| 第一個 MVP domain | SAST 報告分析 | 交易策略、完全通用平台 | SAST 輸入輸出清楚、可量化、風險低，貼近使用者工作情境 |
| 實作順序 | 先產 DOCX 方案，不直接改程式 | 直接 scaffold 專案 | 符合 Pixiu 審批閘門，先審方案再實作 |
| 文件驗證 | Word COM + PDF 檢查補位 | 強行依賴 artifact-tool | 本機 artifact-tool 無 stderr 失敗；已有既往踩坑記錄 |

## ⚠️ 發現的問題 / 踩坑

- artifact-tool renderer 仍失敗且無 stderr，無法作為本機 DOCX 視覺驗收主路徑。
- LibreOffice renderer 不可用，因本機找不到 soffice/libreoffice binary。
- pdf2image 無法使用，因缺 Poppler。
- PDF.js + Node canvas 可產頁面總覽，但中文字型顯示為方框；可用於檢查頁面結構，不適合作為中文字視覺內容驗收。

## 📌 下次 session 要做的事

優先執行：
- [ ] 使用者審閱 $docxPath。
- [ ] 決定第一個 domain 是否採 SAST 報告分析。
- [ ] 若確認進入實作，先建立 MVP 白名單路徑與 Phase 1 計畫。

可並行：
- [ ] 盤點 PixiuCore 既有 commands / agents 哪些可復用於 Auto Research Core。
- [ ] 準備 SAST 去識別化樣本與 golden set 格式。

待確認：
- [ ] 是否要把 Auto Research Core 做成 PixiuCore 內建 command / skill，或先放在獨立實驗專案。

## 💾 關鍵狀態

- 專案：PixiuCore / Playground
- 分支：未檢查，本次未進行 git 操作
- 改動檔案：$docxPath、本 recap、decision 檔、memory-summary.md
- 尚未 commit 的變更：未檢查