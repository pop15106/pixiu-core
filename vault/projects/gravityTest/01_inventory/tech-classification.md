# Tech Classification — 技術分類矩陣

> **Phase**：01
> **更新日期**：2026-05-12

---

## Summary

本文件為所有核心業務專案建立完整的技術分類矩陣，識別版本風險、EOL 狀態與升級優先級。

---

## Findings

### 技術分類矩陣（核心業務專案）

| 技術面向 | PCLMS_AP | PCLMS_BK_new | PFTZC_AP_new | PFTZC_BK | PTWCS | pepis_ap | perms |
|---------|---------|-------------|-------------|---------|-------|---------|-------|
| **語言** | Java 8 | Java 8 | Java 8 | Java 8 | Java 8 | Java 8 | Java 8 |
| **主框架** | Spring MVC 3.2 | Spring 5.2 | Spring MVC 3.2 | Spring | Spring Boot 2.3.2 | Struts2 2.5.33 | Struts2 2.5.33 |
| **框架 EOL** | 🔴 2016 | 🟡 2022 | 🔴 2016 | 🟡 舊 | 🔴 2021 | 🟡 Active | 🟡 Active |
| **ORM/DAO** | tv-xdao | tv-xdao | tv-xdao | tv-xdao | JPA+MyBatis | tv-xdao | MyBatis |
| **Logging** | SLF4J | SLF4J+Log4j2 | Log4j2 2.17.1 | **Log4j 1.x** 🔴 | Logback | Log4j(推測) | Log4j(推測) |
| **DB Driver** | ojdbc8 | ojdbc8 | ojdbc8 | ojdbc8 | ojdbc8 | ojdbc8 | ojdbc8 |
| **DB 連線** | 推測 XML | 推測 XML | 推測 XML | 推測 XML | JNDI(prod)/JDBC(dev) | XML | MyBatis XML |
| **Auth** | Interceptor(推測) | N/A | Interceptor | N/A | Spring Security+JWT | Struts2 Interceptor | Struts2 Interceptor |
| **Scheduler** | Quartz(推測) | Quartz | Quartz(推測) | Quartz | Quartz | Quartz(推測) | Quartz |
| **Build** | Maven | Maven | Maven | Maven | Maven | Maven | Maven |
| **Packaging** | WAR | JAR | WAR | JAR | WAR | WAR | WAR |
| **Server** | Tomcat/JBoss | Standalone | Tomcat/JBoss | Standalone | 內嵌 Tomcat | Tomcat | Tomcat |
| **前端** | JSP/JSTL | N/A | JSP/JSTL | N/A | SPA(React推測) | JSP | JSP/Tiles |
| **測試框架** | JUnit 5 | JUnit 4+5 | JUnit 4 | — | Spring Test | JUnit+Mockito | — |

---

### 框架版本風險評估

| 框架 | 版本 | 官方 EOL | CVE 風險 | 影響專案 | 升級難度 |
|-----|------|---------|---------|---------|---------|
| Spring MVC | **3.2.15** | **2016-12** | 🔴 極高（多個未修補） | PCLMS_AP、PFTZC_AP_new | 🔴 高（需全面回歸） |
| Spring Framework | 4.0.0 | 2020-12 | 🔴 高 | 部分專案 | 🔴 高 |
| Spring Framework | 5.2.8 | 2022-12 | 🟡 中 | PCLMS_BK_new | 🟡 中 |
| Spring Boot | **2.3.2** | **2021-08** | 🔴 高 | PTWCS | 🟡 中（Boot 升級路徑較清晰） |
| Struts2 | 2.5.33 | Active | 🟡 中（歷史高危，現版本相對穩定） | pepis_ap、perms | 🟡 中 |
| Log4j | **1.2.17** | **2015** | 🔴 CRITICAL (CVSS 9.8) | PFTZC_BK | 🟢 低（換依賴即可） |
| Log4j2 | 2.17.1 | Active | ✅ 安全 | PFTZC_AP_new | N/A |
| Logback | — | Active | ✅ 安全 | PTWCS | N/A |
| Guava | **18.0** | 2014 | 🟡 中（多個已知 CVE） | PCLMS_LIBS、PFTZC_LIBS | 🟢 低 |
| lombok | **0.10.0-RC3** | 2011（RC） | 🟡 中 | pepis_ap | 🟢 低（升至 1.x） |
| snakeyaml | **1.10** | 舊 | 🟡 中（CVE-2022-1471） | PFTZC_BK | 🟢 低 |
| servlet-api | **2.4 / 2.5** | 2003/2006 | 🟡 中 | PCLMS_AP、pepis_ap | 🔴 高（需配合容器升級） |
| commons-configuration | 1.4 / 1.6 | 舊 | 🟡 中 | PCLMS_BK、PFTZC_BK | 🟢 低 |
| antlr | 2.7.7 | 舊 | 🟢 低 | pepis_ap | 🟢 低 |

---

### Tradevan 內部 Library 版本現況

| Library | 版本（PCLMS） | 版本（PFTZC） | 版本差異 | 風險 |
|---------|------------|------------|---------|------|
| tv-framework | 1.0.4 | 1.2.2 | ⚠️ 不一致 | 行為可能差異 |
| tv-xdao | 1.3.2 | 1.1.9 | ⚠️ 不一致 | DAO 行為可能差異 |
| tv-easy | 0.0.5 | 0.0.5 | ✅ 一致 | — |
| tv-commons | 1.0.7 | — | ⚠️ PFTZC 未明確使用 | — |
| tv-logging-core | 1.0.5 | — | ⚠️ PFTZC 未明確使用 | — |

> ⚠️ tv-framework 和 tv-xdao 在兩大系統間版本不一致，Phase 04 需深入比較行為差異。

---

### Build & Runtime 環境分類

| 專案 | Build Tool | 打包格式 | 執行容器 | 設定方式 |
|-----|-----------|---------|---------|---------|
| PCLMS_AP | Maven | WAR | App Server（JBoss/Tomcat） | Spring XML |
| PCLMS_BK_new | Maven | JAR | Standalone | Spring XML |
| PCLMS_FD | Maven + npm | WAR | App Server | Spring XML + React |
| PFTZC_AP_new | Maven | WAR | App Server | Spring XML |
| PFTZC_BK | Maven | JAR | Standalone | Spring XML |
| PTWCS | Maven | WAR | 內嵌 Tomcat（Boot） | application.properties |
| pepis_ap | Maven | WAR | App Server | Struts2 XML |
| perms | Maven + npm | WAR | App Server | Struts2 + MyBatis XML |

---

### CI/CD 現況

| 發現 | 位置 | 說明 |
|-----|------|------|
| `deploy-action.xml` | PCLMS_AP, PCLMS_BK_new, PFTZC_AP_new, PFTZC_BK | 推測為 Jenkins/Ant 部署腳本 |
| `deploy.xml` | PCLMS_BK_new, PFTZC_BK | 完整部署描述 |
| `tag.json` | PCLMS_AP, PCLMS_BK_new, PFTZC_AP_new, PFTZC_BK | 版本標籤 |
| `.agent/` | 多個專案 | Pixiu AI Agent 設定，非 CI/CD |

> ⚠️ **未發現** Jenkins Pipeline、GitHub Actions、GitLab CI 等現代 CI/CD 設定。
> 推測為**手動或半自動部署**，依賴 `deploy-action.xml` 腳本執行。
> 這是維運層面的主要技術債。

---

### Docker / Kubernetes 現況

| 類型 | 狀態 |
|-----|------|
| Dockerfile | ❌ 未發現任何 Dockerfile |
| docker-compose.yml | ❌ 未發現 |
| Kubernetes YAML | ❌ 未發現 |
| Helm Chart | ❌ 未發現 |

> **結論**：全系統無容器化，均為傳統 WAR 部署至 App Server。

---

## Risks

| Risk ID | 描述 | 優先級 |
|---------|------|--------|
| R01-TECH-001 | Log4j 1.x CVSS 9.8 仍在使用 | 🔴 P0 |
| R01-TECH-002 | Spring MVC 3.2.x EOL（2016 年） | 🔴 P1 |
| R01-TECH-003 | Spring Boot 2.3.2 EOL（2021 年） | 🔴 P1 |
| R01-TECH-004 | 無任何 CI/CD Pipeline，依賴手動部署 | 🟡 P2 |
| R01-TECH-005 | 無容器化策略，水平擴展困難 | 🟡 P2 |
| R01-TECH-006 | tv-framework / tv-xdao 跨系統版本不一致 | 🟡 P2 |
| R01-TECH-007 | lombok 0.10.0-RC3（2011 RC 版） | 🟡 P2 |
| R01-TECH-008 | snakeyaml 1.10（CVE-2022-1471） | 🟡 P2 |
| R01-TECH-009 | Guava 18.0（2014，含已知 CVE） | 🟡 P2 |
| R01-TECH-010 | 無統一 Logging 框架（各系統混用） | 🟢 P3 |

---

## Recommendations

| 優先級 | 技術升級項目 | 備註 |
|--------|------------|------|
| 🔴 P0 | PFTZC_BK：Log4j 1.x → Log4j2 2.17.2 | 一天內完成 |
| 🔴 P1 | PTWCS：Spring Boot 2.3.2 → 3.2.x | 最易，可先行 |
| 🔴 P1 | 制定 Spring MVC 3.2 升級路線圖 | 長期計畫，至少 3 個月 |
| 🟡 P2 | 建立 Jenkins/GitLab CI Pipeline | 提升部署可靠性 |
| 🟡 P2 | Dockerize PTWCS（Spring Boot 最易） | 容器化起點 |
| 🟡 P2 | 統一 tv-framework / tv-xdao 版本 | 跨系統一致性 |
| 🟡 P2 | pepis_ap：升級 lombok 至 1.18.x | 30 分鐘 |
| 🟡 P2 | PFTZC_BK：升級 snakeyaml | 30 分鐘 |
| 🟢 P3 | 統一全系統 Logging 為 Logback + SLF4J | 一週 |

---

## Confidence

| 項目 | 信心度 |
|-----|--------|
| Framework 版本（pom.xml 直接讀取） | ✅ Confirmed |
| EOL 狀態（Spring 官方資料） | ✅ Confirmed |
| Log4j CVE（CVE 資料庫） | ✅ Confirmed |
| CI/CD 缺失（目錄掃描確認） | ✅ Confirmed |
| 無 Docker（目錄掃描確認） | ✅ Confirmed |
| PCLMS_FD 前端技術（React） | 🟡 High Confidence（package.json 確認） |
| pepis_ap / perms logging 框架 | 🟡 Medium Confidence（部分 pom 未深度讀取） |

---

*[[../index]] · [[../00_overview/inventory-summary]] · [[project-registry]] · [[module-inventory]] · [[repo-relations]]*
