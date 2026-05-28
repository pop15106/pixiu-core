---
決策: OpenSpec CLI 安裝方式
選擇: npm -g 全域裝一次
棄選方案: 各專案 devDependency
原因: skills 從母體注入，不需要各專案重複安裝
日期: 2026-04-21
專案: PixiuCore
---

# OpenSpec CLI 安裝方式

## 背景
OpenSpec CLI 需要安裝才能使用 /opsx 指令。

## 決策
`npm install -g @fission-ai/openspec@latest` 全域安裝一次即可。

## 影響
所有子專案不需各自安裝，維護單一版本。
