# Repo Relations — 專案間關聯圖

> **Phase**：01
> **更新日期**：2026-05-12

---

## Summary

本文件定義所有專案間的依賴關係、共用模組關係，以及推測的執行期系統間呼叫關係。

---

## Findings

### Maven Compile-Time 依賴關係（已確認）

```
【PCLMS 系統群】
PCLMS_AP (pclms_web WAR)
  └── depends on ──→ PCLMS_LIBS_new (pclms-lib 0.0.1-SNAPSHOT)
  └── depends on ──→ [Tradevan Internal] tv-easy 0.0.5
  └── depends on ──→ [Tradevan Internal] tv-xdao (excluded)
  └── depends on ──→ [Tradevan Internal] tv-framework (excluded)
  └── depends on ──→ [Tradevan Internal] tv-commons (excluded)
  └── depends on ──→ [Tradevan Internal] tv-logging-core (excluded)

PCLMS_BK_new (pclms_bp JAR)
  └── depends on ──→ [Tradevan Internal] tv-xdao 1.3.2
  └── depends on ──→ [Tradevan Internal] tv-commons 1.0.7
  └── depends on ──→ [Tradevan Internal] tv-logging-core 1.0.5
  └── depends on ──→ [Tradevan Internal] tv-framework 1.0.4
  └── depends on ──→ [Tradevan Internal] jmsClient-eqdq 1.3.1
  └── depends on ──→ Oracle ojdbc8

PCLMS_LIBS_new (pclms-lib JAR)
  └── depends on ──→ [Tradevan Internal] tv-easy 0.0.5
  └── depends on ──→ [Tradevan Internal] tv-framework 1.0.4
  └── depends on ──→ org.quartz-scheduler 2.3.2
  └── depends on ──→ org.springframework:spring-web

【PFTZC 系統群】
PFTZC_AP_new (pftzc_web WAR)
  └── depends on ──→ PFTZC_LIBS（推測，未直接讀取 pom）
  └── depends on ──→ [Tradevan Internal] tv-framework (推測)
  └── log4j2 2.17.1（已安全升級）

PFTZC_BK (pftzc_bp JAR)
  └── depends on ──→ PFTZC_LIBS (pftzc_lib)
  └── depends on ──→ [Tradevan Internal] tv-xdao 1.1.9
  └── depends on ──→ Oracle ojdbc8
  └── depends on ──→ freemarker 2.3.30
  └── depends on ──→ snakeyaml 1.10 (⚠️ 舊版)
  └── depends on ──→ log4j 1.2.17-fix1 (🔴 CVE)

PFTZC_LIBS (pftzc_lib JAR)
  └── depends on ──→ [Tradevan Internal] tv-framework 1.2.2
  └── depends on ──→ [Tradevan Internal] tv-xdao 1.1.9
  └── depends on ──→ [Tradevan Internal] tv-easy 0.0.5
  └── depends on ──→ guava 18.0 (⚠️ 2014年)

【獨立系統】
PTWCS (ptwcs_ap WAR)
  └── depends on ──→ spring-boot-starter-parent 2.3.2 (🔴 EOL)
  └── depends on ──→ spring-boot-starter-security
  └── depends on ──→ spring-boot-starter-quartz
  └── depends on ──→ spring-boot-starter-mail
  └── depends on ──→ Firebase Admin SDK
  └── depends on ──→ JasperReports
  └── depends on ──→ Oracle ojdbc8
  └── depends on ──→ io.github.h8000572003:commons 0.3.6
  └── depends on ──→ io.github.chungtsai:test 0.0.5

pepis_ap (WAR)
  └── depends on ──→ struts2-core 2.5.33
  └── depends on ──→ spring (版本待確認)
  └── depends on ──→ lombok 0.10.0-RC3 (⚠️ 2011年 RC 版本)
  └── depends on ──→ Oracle ojdbc8 (推測)
  └── depends on ──→ antlr 2.7.7

perms (WAR)
  └── depends on ──→ struts2-core 2.5.33
  └── depends on ──→ mybatis-spring 2.1.2
  └── depends on ──→ spring (版本待確認)
  └── depends on ──→ Oracle ojdbc8 (推測)
  └── depends on ──→ quartz
```

---

### Source-Code 複製依賴（非 Maven）

```
PCLMS_BK_new/JAVA/process_monitor_mvn/
  └── 原始碼複製 ──→ PFTZC_BK/JAVA/process_monitor_mvn/

PCLMS_BK_new/JAVA/jks/
  └── 原始碼複製 ──→ PFTZC_BK/JAVA/jks/
```

> ⚠️ 這兩個模組如果一方修改，另一方不會自動同步，已造成潛在行為不一致風險。

---

### 執行期系統間關聯（Runtime，推測）

```
使用者/稽核人員
       │ HTTP/HTTPS
       ▼
┌─────────────────────────────────────────────────────┐
│         PCLMS_AP (保稅稽核 - 前台)                   │
│         或 PFTZC_AP_new (自貿港 - 前台)              │
│         或 pepis_ap (通關金流)                       │
│         或 perms (退稅E指購)                         │
│         或 PTWCS (台北關門禁)                        │
└─────────────────────────────────────────────────────┘
       │
       │ JMS Queue (PCLMS AP→BK)
       │ Dispatch Queue (PFTZC AP→BK)
       ▼
┌─────────────────────────────────────────────────────┐
│         PCLMS_BK_new (保稅稽核 - 後台批次)           │
│         或 PFTZC_BK (自貿港 - 後台批次)              │
└─────────────────────────────────────────────────────┘
       │
       │ Oracle JDBC
       ▼
┌─────────────────────────────────────────────────────┐
│         Oracle Database                              │
│         (多個系統共用，Schema 邊界待確認)             │
└─────────────────────────────────────────────────────┘

PTWCS ──→ Firebase FCM ──→ Mobile App（門禁通知）
PTWCS ──→ Mail Server
pepis_ap ──→ 財政部/海關外部 API（推測，saab_api_sql.xml 暗示）
perms ──→ 退稅主管機關 API（推測）
```

---

### 潛在共用 Oracle DB 風險

目前所有業務系統均使用 Oracle DB，且沒有看到明確的 DB 邊界設計。
高度懷疑多系統**共用相同 Oracle Instance**，可能透過不同 Schema 或 User 隔離。

> **⚠️ 風險**：若 DB 帳戶無細緻的 Schema 隔離，一個系統的 bug 可能影響其他系統資料。
> **建議**：Phase 06（Data Flow）需深度掃描各系統的 datasource 設定，確認 Schema 邊界。

---

## Risks

| Risk ID | 說明 | 嚴重度 |
|---------|------|--------|
| R01-REL-001 | process_monitor_mvn 雙份原始碼 | 🔴 HIGH |
| R01-REL-002 | jks 雙份原始碼 | 🔴 HIGH |
| R01-REL-003 | Oracle DB 可能無 Schema 邊界隔離 | 🟡 MEDIUM |
| R01-REL-004 | Tradevan 私有 Library 版本不一（tv-framework 1.0.4 vs 1.2.2） | 🟡 MEDIUM |
| R01-REL-005 | pepis_ap / perms 對外 API 依賴不明確 | 🟡 MEDIUM |

---

## Confidence

| 項目 | 信心度 |
|-----|--------|
| Maven 依賴（已讀取 pom.xml 的專案） | ✅ Confirmed |
| 原始碼複製模組 | ✅ Confirmed |
| Runtime 系統間通訊（JMS/Dispatch） | ✅ Confirmed |
| Oracle DB 共用推測 | 🟡 Medium Confidence |
| pepis_ap / perms 外部 API | 🟡 Medium Confidence |
| 各系統 DB Schema 邊界 | 🔴 Low Confidence（需 Phase 06 確認） |

---

*[[../index]] · [[project-registry]] · [[module-inventory]] · [[tech-classification]]*
