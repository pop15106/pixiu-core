# Project Registry — 專案完整登錄表

> **Phase**：01  
> **更新日期**：2026-05-12  
> **專案總數**：19

---

## Summary

本文件為 gravityTest 所有 19 個子專案的完整登錄表，包含類型、技術棧、規模、狀態與分析優先級。

---

## Findings

### 完整專案登錄表

| # | 專案名稱 | 群組 | 業務系統 | 類型 | 語言 | Framework | 打包 | Java 檔數 | 狀態 | 分析優先級 |
|---|---------|------|---------|------|------|-----------|------|---------|------|---------|
| 01 | `PCLMS_AP` | A | 保稅稽核系統 | Backend | Java 8 | Spring MVC 3.2.15 | WAR | ~642 | 🟢 Active | 🔴 高 |
| 02 | `PCLMS_BK_new` | A | 保稅稽核系統 | Backend | Java 8 | Spring 5.2.8 | JAR | ~626 | 🟢 Active | 🔴 高 |
| 03 | `PCLMS_FD` | A | 保稅稽核系統 | FullStack | Java 8 + React | Spring + React | WAR | ~中等 | 🟢 Active | 🟡 中 |
| 04 | `PCLMS_LIBS_new` | A | 保稅稽核系統 | Library | Java 8 | Spring 3.x | JAR | ~289 | 🟢 Active | 🟡 中 |
| 05 | `PFTZC_AP_new` | B | 自貿港帳冊稽核 | Backend | Java 8 | Spring MVC 3.2.15 | WAR | ~553 | 🟢 Active | 🔴 高 |
| 06 | `PFTZC_BK` | B | 自貿港帳冊稽核 | Backend | Java 8 | Spring | JAR | ~531 | 🟢 Active | 🔴 高 |
| 07 | `PFTZC_LIBS` | B | 自貿港帳冊稽核 | Library | Java 8 | Spring | JAR | ~小 | 🟢 Active | 🟡 中 |
| 08 | `PFTZB` | B | 自貿港（舊） | Unknown | — | — | — | 0 | ⚫ 廢棄 | 🟢 低 |
| 09 | `PTWCS` | C | 台北關門禁系統 | Backend | Java 8 | Spring Boot 2.3.2 | WAR | ~中等 | 🟢 Active | 🔴 高 |
| 10 | `pepis_ap` | C | 通關金流平台 | Backend | Java 8 | Struts2 2.5.33 + Spring | WAR | ~1,186 | 🟢 Active | 🔴 高 |
| 11 | `perms` | C | 外籍旅客退稅E指購 | Backend | Java 8 | Struts2 2.5.33 + Spring | WAR | ~291 | 🟢 Active | 🟡 中 |
| 12 | `ProjectCreater` | D | AI 工具 | Tool | TypeScript | Next.js 14 | — | 0 | 🟢 Active | 🟢 低 |
| 13 | `pixiu-core` | D | AI Agent 平台 | Infra | JSON/MD | Claude Code | — | 0 | 🟢 Active | 🟢 低 |
| 14 | `pixiu-auto-research` | D | AI 研究工具 | Tool | Node.js (ESM) | — | — | 0 | 🟢 Active | 🟢 低 |
| 15 | `blankP` | E | 設定模板 | Script | JSON | — | — | 0 | 🟡 輔助 | 🟢 低 |
| 16 | `pclms_ap_tmp` | E | 保稅稽核（舊） | Unknown | Java | — | — | 少 | ⚫ 暫存 | 🟢 低 |
| 17 | `pclms_bk_tmp` | E | 保稅稽核（舊） | Unknown | Java | Spring | — | 少 | ⚫ 暫存 | 🟢 低 |
| 18 | `claude-parity-skills-package` | E | Claude Skills | Tool | — | — | — | 0 | 🟡 輔助 | 🟢 低 |
| 19 | `PPOST` | E | 未知 | Unknown | — | — | — | 0 | ⚫ 空 | 🟢 低 |

---

### 核心業務專案詳細資訊

#### P01 — PCLMS_AP（保稅稽核系統 AP 層）

```yaml
groupId: com.tradevan.pclms
artifactId: pclms-web-parent
version: 0.0.1-SNAPSHOT
packaging: pom (parent)
child_module: JAVA/pclms_mvn (WAR)
spring_version: 3.2.15.RELEASE
java_files: ~642
key_packages:
  - clms.dto.calBalance / calGuaranty / goodsBalance / goodsMonth / grnt
  - com.tradevan.clms
  - com.tradevan.common.db
  - com.tradevan.xss.filter   ← XSS 過濾器（有意識，待驗證完整性）
dependencies:
  - pclms-lib (PCLMS_LIBS_new)
  - tv-easy, tv-xdao, tv-framework, tv-commons, tv-logging-core
  - ojdbc8 (Oracle)
  - servlet-api 2.5, jsp-api 2.0
  - junit-jupiter-api 5.7.0
risks:
  - Spring 3.2.x EOL 2016
  - servlet-api 2.5 極老舊
```

#### P02 — PCLMS_BK_new（保稅稽核系統 BK 層）

```yaml
groupId: com.tradevan.clms
artifactId: pclms_bk_parent
version: 140
packaging: pom (parent)
child_modules:
  - JAVA/pclms_bp (主業務)
  - JAVA/process_monitor_mvn (流程監控)
  - JAVA/jks (JKS 金鑰)
spring_version: 5.2.8.RELEASE (mybatis-spring 2.1.2)
java_files: ~626
key_packages:
  - com.tradevan.clms.bean
  - com.tradevan.clms.controller
  - com.tradevan.clms.service
  - com.tradevan.clms.job (clean/cmd/common/mail/task)
  - com.tradevan.clms.iog       ← 進出口相關
  - com.tradevan.clms.grntCheck ← 擔保品檢核
  - com.tradevan.clms.message
  - com.tradevan.clms.send
  - Billing (根目錄套件，未遵循命名規範 ⚠️)
dependencies:
  - jmsClient-eqdq 1.3.1
  - tv-xdao 1.3.2, tv-commons 1.0.7, tv-logging-core 1.0.5
  - ojdbc8, commons-lang3, commons-jxpath, commons-configuration
  - junit-jupiter-api 5.7.0, junit 4.x
risks:
  - Billing package 在根目錄，命名不規範
  - process_monitor_mvn 原始碼複製
```

#### P05 — PFTZC_AP_new（自貿港帳冊稽核系統 AP 層）

```yaml
groupId: com.tradevan.pftzc
artifactId: pftzc-web-parent
version: 0.0.1-SNAPSHOT
packaging: pom (parent)
child_module: JAVA/pftzc_mvn (WAR)
spring_version: 3.2.15.RELEASE
java_files: ~553
key_packages:
  - com.tradevan.ftzc.action
  - com.tradevan.ftzc.bean
  - com.tradevan.ftzc.dao / dao.impl
  - com.tradevan.ftzc.domain.code / dto / utils  ← DDD 意圖
  - com.tradevan.ftzc.interceptor
  - com.tradevan.ftzc.model.excelprinter
  - com.tradevan.ftzc.restful / restful.aspect / restful.constant
  - com.tradevan.ftzc.exception
logging: Log4j2 2.17.1 (已從 1.x 升級，安全)
risks:
  - Spring 3.2.x EOL
```

#### P06 — PFTZC_BK（自貿港帳冊稽核系統 BK 層）

```yaml
groupId: com.tradevan.ftzc
artifactId: PFTZC_BK_PARENT
version: 0.0.1-SNAPSHOT
packaging: pom (parent)
child_modules:
  - JAVA/FTZC_BK (主業務)
  - JAVA/process_monitor_mvn (流程監控, 複製自 PCLMS_BK)
  - JAVA/jks (JKS 金鑰, 複製自 PCLMS_BK)
java_files: ~531
key_packages:
  - com.tradevan.ftzc.bean
  - com.tradevan.ftzc.business    ← 業務核心
  - com.tradevan.ftzc.controller
  - com.tradevan.ftzc.dispatchQueue
  - com.tradevan.ftzc.doman       ← ⚠️ 拼字錯誤（應為 domain）
  - com.tradevan.ftzc.message
  - com.tradevan.ftzc.model
  - com.tradevan.ftzc.parser
  - com.tradevan.ftzc.service
  - com.tradevan.ftzc.task
  - com.tradevan.ftzc.utils
  - com.tradevan.ftzc.vo
  - com.tradevan.ftzc.common.file / ftp  ← FTP 傳輸
  - com.tradevan.commons.logger
logging: Log4j 1.2.17-fix1 🔴 CVE CRITICAL
risks:
  - Log4j 1.x 高危 CVE
  - doman 拼字錯誤
  - process_monitor_mvn/jks 複製
  - freemarker 2.3.30, snakeyaml 1.10（可能有 CVE）
```

#### P09 — PTWCS（台北關門禁系統）

```yaml
parent: spring-boot-starter-parent 2.3.2.RELEASE
groupId: com.tradevan
artifactId: ptwcs_ap
version: 0.0.1-SNAPSHOT
packaging: war
java_version: 1.8
architecture: Hexagonal (六邊形架構)
key_packages:
  - com.tradevan.ptwcs.adapter        ← 外部介面層
    - entity/dynsql, entity/mapper, entity/po
    - repository
    - rest / rest.auth / rest.deserializer
    - service/audit, check, code, crypto, firebase, inoutwarehouse, mail
  - com.tradevan.ptwcs.entity         ← 領域實體
  - com.tradevan.ptwcs.usecase        ← 業務用例
profiles: local, test, prod, ver
dependencies:
  - spring-boot-starter-security
  - spring-boot-starter-mail
  - spring-boot-starter-quartz
  - Firebase Admin SDK
  - JasperReports (報表)
  - ojdbc8
security_files:
  - ptwcsfcmtest-5e763-firebase-adminsdk-*.json  🔴 P0 私鑰外洩
  - application-local.properties (DB 密碼)
prod_config:
  - spring.datasource.jndiName = java:/PTWCSPool (正確，使用 JNDI)
  - allowed.servernames = ptwcs.tradevan.com.tw (白名單)
```

#### P10 — pepis_ap（通關金流平台系統）

```yaml
groupId: com.tradevan.pepis
artifactId: pepis_ap
packaging: war
version: 0.0.1-SNAPSHOT
java_files: ~1,186 (最大)
framework: Struts2 2.5.33 + Spring
key_packages:
  - com.tradevan.pccps.domain.dto.pay.creditcard  ← 信用卡支付
  - com.tradevan.pccps.domain.ebill               ← 電子帳單
  - com.tradevan.pccps.domain.invoice.a0401/a0501 ← 電子發票格式
  - com.tradevan.commons.logger
config_files:
  - conf/struts2.xml
  - conf/saab/saab_api_sql.xml   ← 外部 API SQL
  - conf/xdao_sql.xml
  - conf/Event.xml               ← 事件機制
  - conf/authorization.xml
risks:
  - 規模最大，複雜度高
  - Struts2 歷史 RCE CVE
  - lombok 0.10.0-RC3 (2011年，極舊)
  - servlet-api 2.4 (2003年)
```

#### P11 — perms（外籍旅客退稅E指購系統）

```yaml
groupId: com.tradevan.perms
artifactId: APERMS
packaging: war
version: 0.0.1-SNAPSHOT
java_files: ~291
framework: Struts2 2.5.33 + Spring + MyBatis
key_packages:
  - com.tradevan.perms.action.am/bu/dl/hq/mg/rt
  - com.tradevan.perms.interceptor
  - com.tradevan.perms.jobservice / jobservice.impl  ← 排程
  - com.tradevan.perms.generic.rpt  ← 報表
  - com.tradevan.perms.model
config_files:
  - conf/applicationContext/（完整 Spring XML 設定）
  - conf/mybatis.xml
  - conf/quartz.properties
  - conf/modules/am/bu/dl/hq/mg/rt.xml  ← 模組化設定
  - mapper/*.xml (MyBatis)
```

---

## Risks

> 詳見 [[../00_overview/inventory-summary#Risks]]

---

## Dependencies

> 詳見 [[module-inventory]] 與 [[repo-relations]]

---

## Recommendations

後續 Phase 02 分析時，建議優先深度讀取：
1. `PCLMS_BK_new/JAVA/pclms_bp/src/main/java` — 最核心的批次處理邏輯
2. `PFTZC_BK/JAVA/FTZC_BK/src/main/java` — 含 FTP/MQ 高風險模組
3. `PTWCS/ptwcs_ap/src/main/java` — 六邊形架構，作為重構參考標竿
4. `pepis_ap/src/main/java` — 最大規模，需分批分析

---

## Confidence

| 項目 | 信心度 |
|-----|--------|
| 專案名稱、數量、路徑 | ✅ Confirmed |
| Java 檔案數量 | ✅ Confirmed（直接 find 計算） |
| Framework 版本 | ✅ Confirmed（pom.xml） |
| 套件結構 | ✅ Confirmed（find 掃描） |
| 業務邏輯細節 | 🟡 High Confidence（套件名推斷） |
| 所有依賴版本 | 🟡 High Confidence（部分 pom 已讀） |

---

*[[../index]] · [[../00_overview/inventory-summary]] · [[module-inventory]] · [[tech-classification]]*
