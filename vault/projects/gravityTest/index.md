# 📚 gravityTest — Knowledge Vault Index

> **組織**：com.tradevan（Tradevan 貿易資訊科技）  
> **分析啟動日期**：2026-05-12  
> **Vault 根目錄**：`vault/projects/gravityTest/`  
> **狀態**：🟢 Phase 01 完成 | 🔲 Phase 02–07 待執行

---

## 🗺️ Phase 進度追蹤

| Phase | 名稱 | 狀態 | 完成日期 | 關鍵輸出 |
|-------|------|------|---------|---------|
| 01 | Inventory & Discovery | ✅ 完成 | 2026-05-12 | [[01_inventory/project-registry]] · [[00_overview/inventory-summary]] |
| 02 | Architecture Analysis | 🔲 待執行 | — | `02_architecture/` |
| 03 | Technology Analysis | 🔲 待執行 | — | `03_technology/` |
| 04 | Code Analysis | 🔲 待執行 | — | `04_code-analysis/` |
| 05 | Security Analysis | 🔲 待執行 | — | `05_security/` |
| 06 | Data Flow & Dependency | 🔲 待執行 | — | `06_data-flow/` · `07_dependencies/` |
| 07 | Technical Debt & Refactoring | 🔲 待執行 | — | `08_technical-debt/` · `09_refactoring/` |

---

## 📂 Vault 目錄結構

```
vault/projects/gravityTest/
├── index.md                      ← 本檔案（主索引）
├── 00_overview/
│   ├── inventory-summary.md      ← Phase 01 摘要
│   └── system-groups.md          ← 系統分群說明
├── 01_inventory/
│   ├── project-registry.md       ← 19 個專案完整登錄表
│   ├── module-inventory.md       ← 子模組清單
│   ├── repo-relations.md         ← 專案間關聯
│   └── tech-classification.md   ← 技術分類矩陣
├── 02_architecture/              ← Phase 02（待）
│   └── diagrams/
├── 03_technology/                ← Phase 03（待）
├── 04_code-analysis/             ← Phase 04（待）
├── 05_security/                  ← Phase 05（待）
├── 06_data-flow/                 ← Phase 06（待）
├── 07_dependencies/              ← Phase 06（待）
├── 08_technical-debt/            ← Phase 07（待）
├── 09_refactoring/               ← Phase 07（待）
├── 10_risk-analysis/             ← Phase 07（待）
└── 11_priority-fixes/            ← Phase 07（待）
```

---

## 🔗 知識連結圖（Knowledge Links）

```
[[00_overview/inventory-summary]]
    ├──→ [[01_inventory/project-registry]]
    ├──→ [[01_inventory/module-inventory]]
    ├──→ [[01_inventory/repo-relations]]
    └──→ [[01_inventory/tech-classification]]

【待建立 — Phase 02+】
[[02_architecture/architecture-summary]]
[[03_technology/tech-stack-summary]]
[[05_security/security-risk-summary]]
[[08_technical-debt/final-summary]]
[[09_refactoring/refactor-roadmap]]
```

---

## ⚡ 緊急事項（已確認，需立即處理）

| 優先級 | 項目 | 位置 |
|--------|------|------|
| 🔴 P0 | Firebase Admin SDK Private Key 外洩 | `PTWCS/src/main/resources/*.json` |
| 🔴 P0 | Log4j 1.2.17 CVE-2019-17571 (CVSS 9.8) | `PFTZC_BK` |
| 🔴 P1 | Oracle DB 密碼存在版控 | `PTWCS/application-local.properties` |
| 🔴 P1 | Spring 3.2.x EOL（2016 年停維） | `PCLMS_AP`、`PFTZC_AP_new` |

---

## 🏢 業務系統分群

| Group | 系統名稱 | 核心專案 |
|-------|---------|---------|
| A | **保稅稽核系統** (PCLMS) | PCLMS_AP · PCLMS_BK_new · PCLMS_FD · PCLMS_LIBS_new |
| B | **自貿港帳冊稽核系統** (PFTZC) | PFTZC_AP_new · PFTZC_BK · PFTZC_LIBS |
| C | **台北關門禁系統** | PTWCS |
| C | **通關金流平台系統** | pepis_ap |
| C | **外籍旅客退稅E指購系統** | perms |
| D | **AI 工具平台** | pixiu-core · pixiu-auto-research · ProjectCreater |
| E | **暫存/過渡/待清理** | pclms_ap_tmp · pclms_bk_tmp · PFTZB · PPOST · blankP |

---

## 📊 整體規模快覽

| 指標 | 數值 |
|-----|------|
| 專案總數 | 19 |
| 核心業務專案 | 11 |
| Java 原始碼檔案（估計） | ~4,200+ .java |
| 最大單一專案 | pepis_ap（~1,186 .java） |
| Build Tool | Maven Multi-Module（主）、npm/pnpm（輔） |
| 主要資料庫 | Oracle（全系統） |
| 架構類型 | 單體 WAR 為主，PTWCS 六邊形架構例外 |

---

*本 Vault 由 AI 架構分析系統自動生成並持續更新。每個 Phase 完成後此索引將同步更新。*  
*後續 AI Agent 接手時請先閱讀本檔案，再依 Phase 順序讀取對應摘要。*
