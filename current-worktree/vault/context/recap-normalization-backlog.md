---
type: implementation-plan
date: 2026-05-15
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: recap-normalization-backlog
status: draft
summary: 記錄 recap 正規化的待辦、進度更新與已收尾狀態。
tags: [pixiucore, vault, recap, normalization, backlog]
---

# Recap 正規化待辦

## 盤點摘要

- `vault/memory/recaps` 約 46 份 Markdown recap
- `type` 主要混用 `session-recap` / `recap` / `monthly-summary`
- `project` 只有少部分已有
- `system`、`repo`、`summary` 幾乎都還沒系統化
- `date` 與 `created` 混用
- 目錄內混入少數非 recap 檔案：
  - `gen_docx_ppost_piece.py`
  - `2026-04/` 下的 `.docx`

## 正規化欄位目標

後續舊 recap 逐步補成：

- `type`
- `date`
- `project`
- `system`
- `repo`
- `topic`
- `status`
- `summary`

## Priority A：先補最常查、最需要分專案的 recap

### PCLMS

- `2026-05-15-144501-pclms-bk-local-orapass-l8-db-test.md`
- `2026-05-15-090000PCLMS-8080-port-bind-node-conflict.md`
- `2026-05-11-PCLMS-BK-TS-L8-無法收訊調查.md`
- `2026-05-06-PCLMS_AP庫存核銷手動調整根因清查.md`
- `2026-05-05-PCLMS庫存核銷問題AP-BK雙端深度分析.md`
- `2026-05-04-100000-PCLMS彙報出倉孤兒表頭與未確認報單調查.md`
- `2026-05-04-134024-PCLMS按月彙報出倉調查與Recap技能修正.md`

### PEPIS / CCPS

- `2026-05-14-pepis-ap-login-captcha-session-cookie-debug.md`
- `2026-05-14-102604-pepis-login-announcement-ui-recap.md`
- `2026-05-13-pepis-login-forgot-password-captcha.md`
- `2026-05-12-141903-pepis-payment-service-apply-table.md`
- `2026-05-07-PEPIS-FedEx-web-hide-remote-recap.md`
- `2026-05-06-PEPIS-FedEx-provider-adjustment.md`
- `2026-05-05-PEPIS-eDDA-3.4-Bug修復.md`
- `2026-05-04-191150-PEPIS-3.4查詢修改與Recap跨專案回寫.md`
- `2026-05-04-190600-PEPIS-3.4查詢修改除錯.md`

### Second Brain

- `2026-05-15-113517-second-brain-sandbox-vs-antigravity-query.md`
- `2026-05-13-000000-second-brain-n8n-ui-publish-workflow.md`
- `2026-05-12-123000-second-brain-github-one-click-deploy.md`
- `2026-05-12-114315-second-brain-full-index-and-ops.md`
- `2026-05-12-100025-second-brain-nvidia-api-complete.md`
- `2026-05-11-181044-n8n-qdrant-vault-nvidia-api-progress.md`

### PixiuCore

- `2026-05-06-pixiu-core-portable-path-sync.md`
- `2026-05-04-142717-PixiuCore-README更新.md`
- `2026-04/2026-04-20-母體雙向同步.md`
- `2026-04/2026-04-20-母體雙向同步 1.md`

## Priority B：再補工具鏈 / 研究 / 架構分析

- `2026-05-13-PISSO-psaab-tv-isso-api-架構分析.md`
- `2026-04/2026-04-29-105025-Pixiu-Auto-Research-Core實作方案.md`
- `2026-04/2026-04-29-105958-Pixiu-Auto-Research-Manual-Codex-Scoring.md`
- `2026-04/2026-04-29-112703-Pixiu-Auto-Research-MVP實作落地.md`
- `2026-04/2026-04-29-121857-Pixiu-Auto-Research-SAST-triage規則.md`
- `2026-04/2026-04-21-111300-OpenSpec導入規劃.md`
- `2026-04/2026-04-27-103853-DOCX文件產生與make-docx技能化.md`
- `2026-04/2026-04-27-152302-CCA-F教材書籍化與DOCX輸出驗證.md`
- `2026-04/2026-04-27-154144-DOCX驗證流程調整.md`

## Priority C：最後清舊格式與雜訊

- `2026-04/2026-04-月度整理.md`
- `2026-04/2026-04-20-115554-PPOST-件數比對邏輯修正.md`
- `2026-04/2026-04-20-133513-PCLMS-L1傳送規則盤點.md`
- `2026-04/2026-04-20-133513-PCLMS-L1傳送規則盤點 1.md`
- `2026-04/2026-04-30-101303-EDDA查詢修改測試回饋.md`

## 先不動的項目

這一輪不直接處理：

- `memory/recaps` 原件搬移
- `.docx` 清理
- `gen_docx_ppost_piece.py` 位置調整
- `Dashboard` Dataview 改寫
- 所有舊 recap 一次性重命名

## 最小風險執行法

1. 先讓新 recap 用新欄位規格
2. 再補 Priority A
3. 確認專案索引頁好用後，再往 B、C 擴

## 2026-05-15 最新進度更新

本輪已完成兩類補強：

1. 修復 28 份 recap 的 `summary` 編碼污染，將 frontmatter 裡被寫成 `?` / `??` 的中文摘要改回正常 UTF-8 內容。
2. 再補齊 5 份近期 recap 的 `project / system / repo / topic / summary` 欄位。

目前欄位覆蓋數：

- `project`: 33
- `system`: 33
- `repo`: 33
- `topic`: 33
- `summary`: 33

目前仍缺上述欄位的 recap 共 13 份，主要集中在 2026-04 舊 recap：

- `2026-04-20-113252-PCLMS彙報出倉待確認原因釐清.md`
- `2026-04-20-115554-PPOST-件數比對邏輯修正.md`
- `2026-04-20-133513-PCLMS-L1傳送規則盤點.md`
- `2026-04-20-133513-PCLMS-L1傳送規則盤點 1.md`
- `2026-04-20-PCLMS-按月彙報進倉流程.md`
- `2026-04-20-PCLMS已申報彙報單Bug診斷.md`
- `2026-04-20-母體雙向同步.md`
- `2026-04-20-母體雙向同步 1.md`
- `2026-04-29-102717-Agent-Team前置判斷硬閘門.md`
- `2026-04-29-151239-Spec-Improve技能新增同步.md`
- `2026-04-29-171300-pepis-ap-3.4申請查詢修改功能實作.md`
- `2026-04-30-101303-EDDA查詢修改測試回饋.md`
- `2026-04-月度整理.md`

補充踩坑：

- 這次證實 frontmatter 若用不安全的批次寫法，中文 `summary` 很容易被污染成 `?`。
- 因此後續 Priority C 的舊 recap 正規化，應沿用 UTF-8 明確寫回流程，且每批都要做抽查。

## 2026-05-15 最終收尾更新

本輪 Priority C 已完成，`vault/memory/recaps` 目前 46 份 Markdown recap 全數具備：

- `project`
- `system`
- `repo`
- `topic`
- `summary`

最終覆蓋數：

- `project`: 46
- `system`: 46
- `repo`: 46
- `topic`: 46
- `summary`: 46

目前缺上述欄位的 recap 數量：`0`

因此 recap 正規化階段可視為完成；後續整理重點可轉向：

1. second-brain manifest / index 重建
2. `memory/recaps` 內非 Markdown 雜訊清單整理
3. 視需要將高價值 recap 升格為 project note 或 decision
