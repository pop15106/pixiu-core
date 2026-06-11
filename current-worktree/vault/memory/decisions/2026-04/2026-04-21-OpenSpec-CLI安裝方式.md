---
type: decision
date: 2026-04-21
project: OPENSPEC
system: PIXIUCORE
repo: pixiu-core
topic: OpenSpec-CLI安裝方式
status: accepted
decision: OpenSpec CLI 安裝方式
choice: npm -g 全域裝一次
alternative: 各專案 devDependency
reason: skills 從母體注入，不需要各專案重複安裝
summary: OpenSpec CLI 安裝方式：npm -g 全域裝一次
tags: [decision]
---

# OpenSpec CLI 安裝方式

## 背景
OpenSpec CLI 需要安裝才能使用 /opsx 指令。

## 決策
`npm install -g @fission-ai/openspec@latest` 全域安裝一次即可。

## 影響
所有子專案不需各自安裝，維護單一版本。
