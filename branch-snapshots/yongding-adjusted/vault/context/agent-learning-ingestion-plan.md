---
type: implementation-plan
date: 2026-05-15
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: agent-learning-ingestion-plan
status: draft
summary: 定義你先口述材料、我協助整理、再寫入經驗沉澱區並同步第二大腦的工作流程。
tags: [pixiucore, agent-learning, second-brain, workflow]
---

# Agent Learning 寫入流程

## 你提供什麼

你可以很隨意地提供原始材料：

- 這次最後怎麼解
- 前輩怎麼說
- 查哪張表才有答案
- 哪個 log 最有用
- 哪個關鍵字最容易搜到
- 哪條路一開始走錯

不用先自己整理成正式筆記。

## 我幫你做什麼

我會先把內容收斂成：

1. 問題是什麼
2. 真正有效的做法是什麼
3. 哪些線索是誤導
4. 這經驗是否可重用
5. 應該落到 observation、instinct，還是 decision

## 寫入順序

### Step 1
先整理成 observation

### Step 2
若多次重複，再提煉成 instinct

### Step 3
若已經是穩定規則，再升格成 decision / skill / SOP

## 第二大腦同步建議

這一區每新增一批 observation / instinct 後，再重跑一次：

1. manifest export
2. Qdrant reindex

這樣 second-brain 吃到的是整理後的經驗，而不是你原始丟給我的碎片。
