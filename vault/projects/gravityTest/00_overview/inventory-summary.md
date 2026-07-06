# Phase 01 — Inventory & Discovery Summary

> **Phase**：01 / 07
> **完成日期**：2026-05-12
> **分析範圍**：`%GRAVITYTEST_ROOT%`（全目錄）
> **前置 Phase**：N/A（首階段）
> **下一 Phase**：[[../02_architecture/architecture-summary]] （待建立）

---

## Summary

本階段對 gravityTest 目錄下的全部 19 個子專案完成初始盤點。
確認組織為 **Tradevan 貿易資訊科技**（groupId: `com.tradevan`），所有核心業務系統圍繞台灣**關務與海關稽核**領域運作。系統群分為五大業務方向，技術棧以 **Java 8 + 傳統 Spring MVC + Oracle DB + Maven Multi-Module** 為主體架構，僅 PTWCS 採用現代化的 Spring Boot + 六邊形架構。

---

## Findings

### F01 — 專案規模與業務範疇

- **19 個子專案**，11 個為核心業務，8 個為工具/暫存/輔助
- 業務領域集中於：保稅稽核、自貿港帳冊稽核、關門禁管控、通關金流、外籍旅客退稅
- 程式碼規模估計：共 ~4,200+ `.java` 檔，最大為 `pepis_ap`（~1,186 files）
- 所有業務系統共用 Oracle DB（多 Schema 推測），無獨立 DB 邊界

### F02 — 系統分群結果

| 群組 | 系統 | 關係 |
|-----|------|------|
| Group A | 保稅稽核系統（PCLMS） | AP + BK + FD + LIBS 四層分離 |
| Group B | 自貿港帳冊稽核系統（PFTZC） | AP + BK + LIBS 三層分離 |
| Group C-1 | 台北關門禁系統（PTWCS） | 獨立 Spring Boot 服務 |
| Group C-2 | 通關金流平台（pepis_ap） | 獨立 Struts2 WAR |
| Group C-3 | 外籍旅客退稅E指購（perms） | 獨立 Struts2 WAR |
| Group D | AI 工具平台 | pixiu-core / auto-research / ProjectCreater |
| Group E | 暫存與待清理 | pclms_*_tmp / PFTZB / PPOST / blankP |

### F03 — 關鍵架構特徵

- **AP/BK 分離模式**：PCLMS 與 PFTZC 均採 AP 層（前台 HTTP）+ BK 層（後台批次/JMS）分離設計，以 JMS Queue 或 Dispatch Queue 做非同步橋接
- **共用模組複製問題**：`process_monitor_mvn` 和 `jks` 模組在 PCLMS_BK_new 與 PFTZC_BK 中**各有一份原始碼複本**，未共用同一 Library
- **PTWCS 架構最現代**：明確分為 `adapter / entity / usecase` 三層，符合六邊形架構（Hexagonal Architecture）
- **Monorepo 特徵**：gravityTest 目錄作為多專案容器，但各專案無頂層 Maven Aggregator 統一管理

### F04 — 技術棧分佈

| 技術面 | 主要技術 | 版本範圍 |
|-------|---------|---------|
| 語言 | Java | 8（估計，PTWCS 明確標示 1.8） |
| 框架（傳統） | Spring MVC | 3.2.15 / 4.0.0 / 5.2.8 |
| 框架（現代） | Spring Boot | 2.3.2 |
| MVC 框架 | Struts2 | 2.5.33 |
| 前端框架 | React、Next.js | Next 14 |
| ORM | tv-xdao（自研）、MyBatis、Spring JPA | 各版本不一 |
| DB | Oracle | ojdbc8 |
| MQ | jmsClient-eqdq（自研 JMS） | 1.3.1 |
| Build | Maven Multi-Module、npm、pnpm | — |
| Logging | Log4j 1.x ⚠️、Log4j2、Logback、SLF4J | 各專案不一 |
| Scheduler | Quartz | 2.3.2 |
| Push | Firebase FCM Admin SDK | — |
| Auth | Spring Security（PTWCS）、自製 Interceptor | — |

### F05 — 暫存/廢棄專案識別

| 專案                             | 狀態判定                  | 建議     |
| ------------------------------ | --------------------- | ------ |
| `pclms_ap_tmp`                 | 過渡版本（無完整原始碼）          | 封存或刪除  |
| `pclms_bk_tmp`                 | 過渡版本（有 pom.xml，無 src） | 封存或刪除  |


---

## Risks

| Risk ID | 類型 | 嚴重度 | 說明 |
|---------|------|--------|------|
| R01-SEC-001 | 資安 | 🔴 P0 CRITICAL | Firebase Admin SDK 私鑰硬編碼於 source code |
| R01-SEC-002 | 資安 | 🔴 P0 CRITICAL | Log4j 1.2.17（CVE-2019-17571 CVSS 9.8）仍在使用 |
| R01-SEC-003 | 資安 | 🔴 P1 HIGH | Oracle DB 密碼存在 .properties 且進入版控 |
| R01-ARCH-001 | 架構 | 🔴 P1 HIGH | Spring 3.2.x EOL（2016），含大量未修補漏洞 |
| R01-ARCH-002 | 架構 | 🟡 P2 MEDIUM | Spring Boot 2.3.2 EOL（2021） |
| R01-DEBT-001 | 技術債 | 🟡 P2 MEDIUM | process_monitor_mvn 雙份複製，維護分叉 |
| R01-DEBT-002 | 技術債 | 🟡 P2 MEDIUM | jks 模組雙份複製 |
| R01-CLEAN-001 | 清潔度 | 🟢 P3 LOW | 6 個暫存/廢棄專案佔用目錄空間 |

---

## Dependencies

### 跨專案依賴（已確認）

```
PCLMS_LIBS_new  ──→  PCLMS_AP
PCLMS_LIBS_new  ──→  PCLMS_BK_new（推測）
PCLMS_LIBS_new  ──→  PCLMS_FD（推測）
PFTZC_LIBS      ──→  PFTZC_AP_new（推測）
PFTZC_LIBS      ──→  PFTZC_BK（確認）
```

### 共用 Tradevan 內部 Library（所有 Java 專案）

```
tv-framework    (1.0.4 / 1.2.2)
tv-xdao         (1.1.9 / 1.3.2)
tv-easy         (0.0.5)
tv-commons      (1.0.7)
tv-logging-core (1.0.5)
jmsClient-eqdq  (1.3.1)
```

> ⚠️ 上述 Library 為 Tradevan 私有 Maven Repo 管理，外部無法取得，升級時需特別注意版本相容性

### 共用模組（原始碼複製，非 Library）

```
process_monitor_mvn  →  PCLMS_BK_new/JAVA/  AND  PFTZC_BK/JAVA/
jks                  →  PCLMS_BK_new/JAVA/  AND  PFTZC_BK/JAVA/
```

---

## Recommendations

| 優先級 | 建議項目 | 預估工時 |
|--------|---------|---------|
| P0 🔴 | 立即撤銷 Firebase Service Account Key，重新生成 | 30 分鐘 |
| P0 🔴 | PFTZC_BK 升級 Log4j 1.x → Log4j2 2.17.2 | 1 天 |
| P1 🔴 | 建立 .gitignore 規則，禁止機密 properties/json 入版控 | 2 小時 |
| P1 🔴 | 制定 Spring 3.2 升級路線圖 | 1 週規劃 |
| P2 🟡 | 合併 process_monitor_mvn 為獨立 Maven Artifact | 3–5 天 |
| P2 🟡 | 合併 jks 為獨立 Maven Artifact | 2–3 天 |
| P3 🟢 | 清理 PFTZB / PPOST / pclms_*_tmp 暫存目錄 | 1 天 |
| P3 🟢 | 修正 PFTZC_BK `doman` 拼字錯誤 | 2 小時 |

---

## Confidence

| 項目 | 信心度 | 說明 |
|-----|--------|------|
| 專案數量與名稱 | ✅ Confirmed | 直接目錄掃描 |
| 業務系統命名 | ✅ Confirmed | 由使用者確認修正 |
| Java 主語言 | ✅ Confirmed | pom.xml 直接確認 |
| Oracle DB 使用 | ✅ Confirmed | ojdbc8 依賴確認 |
| Spring 版本 | ✅ Confirmed | pom.xml 解析 |
| Firebase 私鑰外洩 | ✅ Confirmed | 直接讀取 JSON 內容 |
| Log4j 1.x 使用 | ✅ Confirmed | pom.xml 解析 |
| process_monitor_mvn 雙份複製 | ✅ Confirmed | 目錄結構直接確認 |
| 業務邏輯細節 | 🟡 High Confidence | 依套件命名推斷，未讀完整程式碼 |
| 跨專案 DB Schema 關係 | 🟡 Medium Confidence | 未掃描 SQL 層確認 |
| CI/CD 流程細節 | 🟡 Medium Confidence | 僅發現 deploy-action.xml，未深入解析 |
| pepis_ap 對外 API 端點 | 🟡 Medium Confidence | 發現 saab_api_sql.xml，未完整掃描 |

---

## Knowledge Links

- 詳細專案登錄 → [[../01_inventory/project-registry]]
- 子模組清單 → [[../01_inventory/module-inventory]]
- 技術分類矩陣 → [[../01_inventory/tech-classification]]
- 專案間關聯 → [[../01_inventory/repo-relations]]
- 系統分群說明 → [[system-groups]]
- 主索引 → [[../index]]

---

*Phase 01 完成。下一步請執行 Phase 02：Architecture Analysis，
請先讀取本文件與 [[../01_inventory/project-registry]] 後再開始分析。*
