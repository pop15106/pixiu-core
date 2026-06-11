---
type: decision
date: 2026-04-21
project: OPENSPEC
system: PIXIUCORE
repo: pixiu-core
topic: OpenSpec-與Pixiu並存
status: accepted
decision: OpenSpec 與 Pixiu /plan 流程關係
choice: 兩者並存，各司其職
alternative: 全面替換 Pixiu /plan
reason: Pixiu /plan 已成熟，OpenSpec 補充「正式規格文件持久化」這一層
summary: OpenSpec 與 Pixiu /plan 流程關係：兩者並存，各司其職
tags: [decision]
---

# OpenSpec 與 Pixiu /plan 並存策略

## 背景
OpenSpec 的 /opsx:propose 和 Pixiu /plan 功能有重疊，需定義分工。

## 決策
兩者並存：
- Pixiu `/plan`：快速規劃、對話內使用
- `/opsx:propose`：需要留存正式規格文件的功能開發

## 影響
不破壞現有工作流程，OpenSpec 作為正式規格層疊加在上面。
