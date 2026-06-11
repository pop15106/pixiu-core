---
type: decision
date: 2026-05-04
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: PixiuCore-README採現況入口文件
status: accepted
decision: PixiuCore README 採現況入口文件
choice: 將 README 改為短版現況入口文件，重點放在盤點數字、目錄用途、安裝入口、Session 啟動規則與已知技術債。
alternative: 逐段修補舊 README：成本高，且未來數字仍容易漂移。 同步大改 SKILLS_INDEX.md 與安裝腳本：超出本次使用者要求，不符合最小改動原則。
reason: 入口文件應先保證可信與可維護。母艦正在持續翻修，先把 README 變成地圖，再逐步翻修細部文件，比一次大拆大改更安全。
summary: PixiuCore README 採現況入口文件：將 README 改為短版現況入口文件，重點放在盤點數字、目錄用途、安裝入口、Session 啟動規則與已知技術債。
tags: [decision, pixiucore, readme]
---

# 決策：PixiuCore README 採現況入口文件

## 背景

<workspace-root>\pixiu-core\README.md 原本是長篇百科式介紹，但與目前實際目錄內容和技能數量已有落差。

## 選擇

將 README 改為短版現況入口文件，重點放在盤點數字、目錄用途、安裝入口、Session 啟動規則與已知技術債。

## 棄選方案

- 逐段修補舊 README：成本高，且未來數字仍容易漂移。
- 同步大改 SKILLS_INDEX.md 與安裝腳本：超出本次使用者要求，不符合最小改動原則。

## 原因

入口文件應先保證可信與可維護。母艦正在持續翻修，先把 README 變成地圖，再逐步翻修細部文件，比一次大拆大改更安全。