---
type: decision
date: 2026-04-29
project: AUTO_RESEARCH
system: PIXIUCORE
repo: Playground
topic: Pixiu-Auto-Research-MVP落地路徑
status: accepted
decision: Pixiu Auto Research MVP 落地路徑
alternative: 直接在 gravityTest 根目錄新增零散檔案：容易混入既有資料，維護成本高。 現在就做 API agent loop：使用者目前沒有 API，會阻塞 MVP。 引入 TypeScript / dependencies：第一版不需要編譯與安裝流程，Node 內建模組足夠。
summary: Pixiu Auto Research MVP 落地路徑
tags: [decision, pixiucore, auto-research, mvp]
---

# 決策：Pixiu Auto Research MVP 落地路徑

## 決策內容

Pixiu Auto Research MVP 先落地在 `<workspace-root>\pixiu-auto-research`，作為獨立子專案運作。第一版不接 API、不需要外部套件、不修改既有 PCLMS/Pixiu 專案檔案。

## 選擇原因

`gravityTest` 內已有多個既有專案與文件，直接放在根目錄會增加污染與誤改風險。獨立子專案可保持邊界清楚，也方便後續決定是否初始化 git、同步回 PixiuCore、或遷移到正式 repo。

## 棄選方案

- 直接在 gravityTest 根目錄新增零散檔案：容易混入既有資料，維護成本高。
- 現在就做 API agent loop：使用者目前沒有 API，會阻塞 MVP。
- 引入 TypeScript / dependencies：第一版不需要編譯與安裝流程，Node 內建模組足夠。

## 後續要求

下一步用去識別化 SAST 樣本跑真實手動評分流程，再決定是否補 deterministic evaluator 或同步成 PixiuCore skill / command。