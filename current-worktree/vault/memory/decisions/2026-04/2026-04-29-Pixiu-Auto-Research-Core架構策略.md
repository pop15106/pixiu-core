---
type: decision
date: 2026-04-29
project: AUTO_RESEARCH
system: PIXIUCORE
repo: Playground
topic: Pixiu-Auto-Research-Core架構策略
status: accepted
decision: Pixiu Auto Research Core 架構策略
alternative: 完全通用平台：抽象過度，第一版難以驗收。 直接做 20-agent 大型系統：成本高，容易先複雜化而無法驗證核心閉環。 先做交易策略：雖貼近文章案例，但與使用者工作場景距離較遠，且風險治理較複雜。
summary: Pixiu Auto Research Core 架構策略
tags: [decision, pixiucore, auto-research, agent-team]
---

# 決策：Pixiu Auto Research Core 架構策略

## 決策內容

Pixiu Auto Research 不採單一完全通用黑盒，而採「Auto Research Core + Research Domain Plugin」兩層架構。

通用核心負責：runner、agent dispatch、experiment registry、budget / stop rule、reset protocol、report / recap。

Domain plugin 負責：evaluator、dataset、candidate schema、mutation rules、safety rules。

## 選擇原因

研究閉環真正能否運作，關鍵在 evaluator 與可量化 feedback。不同任務的評分標準、資料集、候選產物格式與安全邊界不同，因此不能完全通用化；但編排、登錄、停損、重置與報告可以共用。

## 棄選方案

- 完全通用平台：抽象過度，第一版難以驗收。
- 直接做 20-agent 大型系統：成本高，容易先複雜化而無法驗證核心閉環。
- 先做交易策略：雖貼近文章案例，但與使用者工作場景距離較遠，且風險治理較複雜。

## 建議 MVP

第一個 domain plugin 建議採 SAST 報告分析。先建立 evaluator 與 registry，再接 2 至 3 個 agents 平行產候選，最後加入 reset protocol 與 budget rule。