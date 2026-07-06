# System Groups — 業務系統分群說明

> **Phase**：01
> **更新日期**：2026-05-12

---

## Summary

本文件定義 gravityTest 下所有專案的業務分群歸屬，作為後續所有 Phase 分析的業務語境基礎。所有系統均屬於台灣**海關與關務管理**領域，由 Tradevan 貿易資訊科技開發維護。

---

## Findings

### Group A — 保稅稽核系統（PCLMS）

**業務說明**：管理保稅貨物的申報、追蹤、稽核與帳冊核對。
**服務對象**：海關稽核人員、保稅倉業者。

| 專案 | 角色 | 說明 |
|-----|------|------|
| `PCLMS_AP` | 前台 Web AP 層 | 使用者操作介面，WAR 部署 |
| `PCLMS_BK_new` | 後台批次 BK 層 | 批次作業、JMS 消費、排程 |
| `PCLMS_FD` | 前後端分離 FD 層 | React 前端 + Java App 層 |
| `PCLMS_LIBS_new` | 共用函式庫 | AP/BK/FD 共用的工具與核心邏輯 |
| `pclms_ap_tmp` | 暫存過渡版本 | 建議封存 |
| `pclms_bk_tmp` | 暫存過渡版本 | 建議封存 |

**AP-BK 通訊機制**：JMS Queue（`jmsClient-eqdq`）

---

### Group B — 自貿港帳冊稽核系統（PFTZC）

**業務說明**：自由貿易港區（Free Trade Zone）的進出口帳冊管理與海關稽核。
**服務對象**：自貿港業者、海關稽核單位。

| 專案 | 角色 | 說明 |
|-----|------|------|
| `PFTZC_AP_new` | 前台 Web AP 層 | 使用者操作介面，WAR 部署 |
| `PFTZC_BK` | 後台批次 BK 層 | 文件解析、FTP、Dispatch Queue |
| `PFTZC_LIBS` | 共用函式庫 | AP/BK 共用的工具與核心邏輯 |
| `PFTZB` | 空目錄 | 用途不明，建議確認後刪除 |

**AP-BK 通訊機制**：Dispatch Queue（自研）
**外部通訊**：FTP Server（帳冊文件傳輸）

---

### Group C — 獨立業務系統

#### C-1 台北關門禁系統（PTWCS）

**業務說明**：台北關人員進出門禁管理，支援 Mobile App 操作與 Push 通知。
**架構特色**：六邊形架構（Hexagonal Architecture），技術棧最現代。

| 專案 | 角色 | 說明 |
|-----|------|------|
| `PTWCS` | 完整後端服務 | Spring Boot 2.3.2，JWT Auth，Firebase FCM |

**外部依賴**：Oracle DB、Firebase FCM、Mail Server

---

#### C-2 通關金流平台系統（pepis_ap）

**業務說明**：通關作業的金流處理，含電子發票、信用卡、支付整合。
**程式規模**：最大，約 1,186 個 .java 檔。

| 專案 | 角色 | 說明 |
|-----|------|------|
| `pepis_ap` | 完整後端服務 | Struts2 + Spring，WAR 部署 |

**外部依賴**：Oracle DB、財政部/海關 API（推測）

---

#### C-3 外籍旅客退稅E指購系統（perms）

**業務說明**：外籍旅客在台購物退稅電子化作業，E指購即電子化申請退稅。
**架構觀察**：action 子套件依功能分群（am/bu/dl/hq/mg/rt），組織清晰。

| 專案 | 角色 | 說明 |
|-----|------|------|
| `perms` | 完整後端服務 | Struts2 + Spring + MyBatis，WAR 部署 |

**外部依賴**：Oracle DB
**Action 功能模組**：am（帳戶管理）/ bu（業務）/ dl（下載）/ hq（總部）/ mg（管理）/ rt（退稅）— 推測

---

### Group D — AI 工具平台

| 專案 | 類型 | 說明 |
|-----|------|------|
| `pixiu-core` | AI Agent 框架設定 | Claude Code / Obsidian Vault 整合，含 plugin/skills/hooks |
| `pixiu-auto-research` | Node.js CLI 工具 | 自動研究輔助，生成 Markdown |
| `ProjectCreater` | Next.js Web 工具 | 專案骨架產生器（zip 下載） |

---

### Group E — 暫存與待清理

| 專案                             | 建議處置       | 原因                   |
| ------------------------------ | ---------- | -------------------- |
| `pclms_ap_tmp`                 | 封存         | 無完整原始碼，過渡版本          |
| `pclms_bk_tmp`                 | 封存         | 有 pom.xml 無 src，過渡版本 |


---

## Confidence

| 項目 | 信心度 |
|-----|--------|
| 業務系統命名（A/B/C 群） | ✅ Confirmed（使用者直接確認） |
| AP/BK 分離架構 | ✅ Confirmed |
| Group D 業務無關性 | ✅ Confirmed |
| pepis_ap 對外 API 細節 | 🟡 Medium Confidence |
| perms action 模組業務意義 | 🟡 Medium Confidence |
| PFTZB 廢棄原因 | 🔴 Low Confidence（需人工確認） |

---

*[[../index]] · [[inventory-summary]] · [[../01_inventory/project-registry]]*
