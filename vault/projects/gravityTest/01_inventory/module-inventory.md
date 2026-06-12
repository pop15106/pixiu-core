# Module Inventory — 子模組清單

> **Phase**：01  
> **更新日期**：2026-05-12

---

## Summary

本文件列出所有 Maven Multi-Module 結構下的子模組，以及業務套件（Package）層次的功能模組對應。

---

## Findings

### Maven 多模組結構清單

| Parent 專案 | 子模組 | artifactId | 說明 |
|------------|--------|-----------|------|
| `PCLMS_AP` | `JAVA/pclms_mvn` | pclms_web | 前台 WAR，主要 Web 層 |
| `PCLMS_BK_new` | `JAVA/pclms_bp` | pclms_bp | 後台業務核心 |
| `PCLMS_BK_new` | `JAVA/process_monitor_mvn` | — | 流程監控（⚠️ 與 PFTZC_BK 複製） |
| `PCLMS_BK_new` | `JAVA/jks` | — | JKS 金鑰管理（⚠️ 與 PFTZC_BK 複製） |
| `PCLMS_FD` | `pclms_app` | — | Spring App 層 |
| `PCLMS_FD` | `pclms_fd` | pclms_fd | React 前端（WAR，含 urlrewritefilter） |
| `PCLMS_FD` | `pclms-util` | — | 工具模組 |
| `PFTZC_AP_new` | `JAVA/pftzc_mvn` | pftzc_web | 前台 WAR，主要 Web 層 |
| `PFTZC_BK` | `JAVA/FTZC_BK` | pftzc_bp | 後台業務核心 |
| `PFTZC_BK` | `JAVA/process_monitor_mvn` | — | 流程監控（⚠️ 複製自 PCLMS_BK） |
| `PFTZC_BK` | `JAVA/jks` | — | JKS 金鑰管理（⚠️ 複製自 PCLMS_BK） |
| `PTWCS` | `ptwcs_ap` | ptwcs_ap | Spring Boot 主體 |

---

### 重複模組風險矩陣

| 模組名稱 | 出現位置 1 | 出現位置 2 | 風險 | 建議 |
|---------|----------|----------|------|------|
| `process_monitor_mvn` | `PCLMS_BK_new/JAVA/` | `PFTZC_BK/JAVA/` | 🔴 行為可能分叉 | 建立獨立 Maven Artifact |
| `jks` | `PCLMS_BK_new/JAVA/` | `PFTZC_BK/JAVA/` | 🔴 金鑰操作邏輯不一致 | 建立獨立 Maven Artifact |

---

### 業務套件（Package）功能模組對應

#### PCLMS_BK_new — pclms_bp 核心套件

| 套件 | 功能描述 | 重要度 |
|-----|---------|--------|
| `com.tradevan.clms.controller` | HTTP 入口/控制器 | ⭐⭐⭐ |
| `com.tradevan.clms.service` | 業務邏輯層 | ⭐⭐⭐ |
| `com.tradevan.clms.job` | Quartz 排程工作 | ⭐⭐⭐ |
| `com.tradevan.clms.job.clean` | 資料清理作業 | ⭐⭐ |
| `com.tradevan.clms.job.cmd` | 命令式作業 | ⭐⭐ |
| `com.tradevan.clms.job.mail` | 郵件排程 | ⭐⭐ |
| `com.tradevan.clms.job.task` | 一般任務 | ⭐⭐ |
| `com.tradevan.clms.iog` | 進出口作業（Import/Output Goods） | ⭐⭐⭐ |
| `com.tradevan.clms.grntCheck` | 擔保品/保證金核查 | ⭐⭐⭐ |
| `com.tradevan.clms.message` | 訊息處理 | ⭐⭐ |
| `com.tradevan.clms.msg` | 訊息物件 | ⭐ |
| `com.tradevan.clms.send` | 發送機制（JMS/Email） | ⭐⭐ |
| `com.tradevan.clms.bean` | 資料物件 | ⭐ |
| `com.tradevan.clms.dto` | DTO 層 | ⭐ |
| `com.tradevan.clms.common` | 公用工具 | ⭐ |
| `Billing` | ⚠️ 計費模組（根目錄，違反命名慣例） | ⭐⭐⭐ |

#### PFTZC_BK — FTZC_BK 核心套件

| 套件 | 功能描述 | 重要度 |
|-----|---------|--------|
| `com.tradevan.ftzc.business` | 業務核心邏輯 | ⭐⭐⭐ |
| `com.tradevan.ftzc.controller` | 控制器 | ⭐⭐⭐ |
| `com.tradevan.ftzc.service` | 服務層 | ⭐⭐⭐ |
| `com.tradevan.ftzc.dispatchQueue` | 任務派送佇列 | ⭐⭐⭐ |
| `com.tradevan.ftzc.parser` | 文件解析（EDI/XML） | ⭐⭐⭐ |
| `com.tradevan.ftzc.task` | 排程任務 | ⭐⭐ |
| `com.tradevan.ftzc.common.ftp` | FTP 傳輸 | ⭐⭐⭐ |
| `com.tradevan.ftzc.common.file` | 文件操作 | ⭐⭐ |
| `com.tradevan.ftzc.common.note` | 通知機制 | ⭐⭐ |
| `com.tradevan.ftzc.doman` | ⚠️ 領域模型（拼字錯誤應為 domain） | ⭐⭐ |
| `com.tradevan.ftzc.message` | 訊息 | ⭐⭐ |
| `com.tradevan.ftzc.model` | 資料模型 | ⭐ |
| `com.tradevan.ftzc.vo` | Value Object | ⭐ |
| `com.tradevan.commons.logger` | 日誌（共用） | ⭐ |

#### PFTZC_AP_new — pftzc_mvn 核心套件

| 套件 | 功能描述 | 重要度 |
|-----|---------|--------|
| `com.tradevan.ftzc.action` | Struts/Spring Action（HTTP 入口） | ⭐⭐⭐ |
| `com.tradevan.ftzc.dao` / `dao.impl` | 資料存取層 | ⭐⭐⭐ |
| `com.tradevan.ftzc.domain.code` | 業務代碼定義 | ⭐⭐ |
| `com.tradevan.ftzc.domain.dto` | DTO 物件 | ⭐⭐ |
| `com.tradevan.ftzc.restful` | RESTful API 端點 | ⭐⭐⭐ |
| `com.tradevan.ftzc.restful.aspect` | AOP 橫切（日誌/授權） | ⭐⭐ |
| `com.tradevan.ftzc.interceptor` | 攔截器（認證） | ⭐⭐⭐ |
| `com.tradevan.ftzc.exception` | 例外處理 | ⭐⭐ |
| `com.tradevan.ftzc.model.excelprinter` | Excel 報表輸出 | ⭐⭐ |

#### PTWCS — ptwcs_ap 六邊形架構套件

| 套件 | 架構層 | 功能描述 | 重要度 |
|-----|--------|---------|--------|
| `adapter.rest` | Adapter（外部） | REST API 入口 | ⭐⭐⭐ |
| `adapter.rest.auth` | Adapter（外部） | JWT 認證 | ⭐⭐⭐ |
| `adapter.repository` | Adapter（外部） | DB 存取 | ⭐⭐⭐ |
| `adapter.entity.po` | Adapter（外部） | JPA 實體 | ⭐⭐ |
| `adapter.entity.mapper` | Adapter（外部） | MyBatis Mapper | ⭐⭐ |
| `adapter.entity.dynsql` | Adapter（外部） | 動態 SQL | ⭐⭐ |
| `adapter.service.*` | Adapter（內部） | 各業務服務實作 | ⭐⭐⭐ |
| `adapter.service.audit` | Adapter（內部） | 稽核 | ⭐⭐⭐ |
| `adapter.service.check` | Adapter（內部） | 門禁檢核 | ⭐⭐⭐ |
| `adapter.service.crypto` | Adapter（內部） | 加解密 | ⭐⭐⭐ |
| `adapter.service.firebase` | Adapter（外部） | Firebase FCM Push | ⭐⭐⭐ |
| `adapter.service.inoutwarehouse` | Adapter（內部） | 進出倉/關 | ⭐⭐⭐ |
| `usecase` | Core（Use Case） | 業務用例定義 | ⭐⭐⭐ |
| `entity` | Core（Domain） | 領域實體 | ⭐⭐⭐ |

#### perms — APERMS 核心套件

| 套件 | 功能描述 |
|-----|---------|
| `action.am` | Account Management（帳戶管理） |
| `action.bu` | Business Unit（業務單位） |
| `action.dl` | Download（下載功能） |
| `action.hq` | Headquarters（總部作業） |
| `action.mg` | Management（管理） |
| `action.rt` | Refund Tax（退稅核心） |
| `interceptor` | 攔截器（認證） |
| `jobservice` | 排程服務 |
| `generic.rpt` | 報表產生 |
| `model` | 資料模型 |

---

## Risks

| Risk ID | 說明 |
|---------|------|
| R01-MOD-001 | process_monitor_mvn 雙份複製（PCLMS + PFTZC） |
| R01-MOD-002 | jks 雙份複製（PCLMS + PFTZC） |
| R01-MOD-003 | PCLMS_BK_new 中 `Billing` 套件位於根目錄，命名不符規範 |
| R01-MOD-004 | PFTZC_BK 中 `doman` 拼字錯誤（應為 `domain`） |

---

## Confidence

| 項目 | 信心度 |
|-----|--------|
| Maven 模組結構 | ✅ Confirmed（find pom.xml 掃描） |
| 套件層次結構 | ✅ Confirmed（find -type d 掃描） |
| 套件功能描述 | 🟡 High Confidence（命名規律推斷） |
| 模組間互動細節 | 🟡 Medium Confidence（需 Phase 04 深度掃描） |

---

*[[../index]] · [[../00_overview/inventory-summary]] · [[project-registry]] · [[repo-relations]]*
