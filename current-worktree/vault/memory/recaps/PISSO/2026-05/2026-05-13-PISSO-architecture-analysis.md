---
type: recap
date: 2026-05-13
project: PISSO
system: PISSO
repo: psaab,tv-isso-api
topic: architecture-analysis
status: done
tags: [pisso, psaab, tv-isso-api, architecture, security]
summary: 盤點 psaab 與 tv-isso-api 的系統分工與資料流，建立後續 tracing 的架構基線。
---

# PISSO 雙專案架構分析 — psaab + tv-isso-api

> 分析時間：2026-05-13 | 工具：Antigravity (Claude Opus 4.6)

## 📌 任務摘要

對工作區中 `psaab` 與 `tv-isso-api` 兩個專案進行完整的系統架構分析，涵蓋技術棧、目錄結構、程式邏輯、相依關係、風險評估與改善建議。

---

## 🔍 專案識別

| 項目 | psaab | tv-isso-api |
|------|-------|-------------|
| groupId | `Saab` | `com.tradevan.isso` |
| artifactId | `Saab` | `tv-isso-api` |
| 版本 | `0.0.1-SNAPSHOT` | `1.0.13` |
| 打包 | **WAR** | **JAR** |
| 類型 | 全端 Web（後端 + JSP） | 後端 API Library |
| App ID | `SAAB` / `SAAB_EXT` | `ISSO` |

### 關聯

tv-isso-api 是共用函式庫（JAR），被 psaab 等 WAR 專案引用。兩者共用 Tradevan 私有框架（tv-framework / tv-saab-system / tv-xdao）。

---

## 🏗️ 技術棧

| 維度 | psaab | tv-isso-api |
|------|-------|-------------|
| 語言 | Java 8 | Java 8 |
| Web 框架 | Struts 2.5.33 | Struts 2.5.33 |
| 前端 | JSP + JSTL + Tiles 3.0.8 | N/A |
| 企業框架 | tv-framework 1.0.4 + tv-saab-system 1.3.14 | tv-saab-system 1.3.12 + tv-saab-api 1.2.8 |
| 資料庫 | MySQL 8.x | Oracle + MySQL + Derby + H2 |
| DAO | tv-xdao（透過框架） | tv-xdao 1.1.4 |
| 連線池 | c3p0 0.9.1.2 | c3p0 0.9.1.2 |
| Logging | log4j 1.2.17-fix1 | log4j 2.20.0 |
| Spring | spring-core 6.2.2 | spring-webmvc + spring-context 6.2.2 |
| App Server | Tomcat 7 / WebLogic | N/A（JAR） |
| 環境管理 | Maven Profile（local/test/ver/pro） | 單一 conf |

---

## 📂 目錄結構重點

### psaab
- 自有程式碼**僅 2 個 Java 檔**（`XssFilter.java` + `XSSRequestWrapper.java`）
- 業務邏輯全在 tv-framework / tv-saab-system 框架內
- `webapp/pages/` 下有 application / org / user / role / privilege / log 等管理頁面
- 環境設定用 `src/main/resources/env/{local,test,ver,pro}/`

### tv-isso-api
- 清楚的三層架構：`bean/` → `model/` → `service/`
- 8 個 Bean (DO)、8 個 Model、6 個 Service
- 核心服務：UserDataService、OrgDataService、AuthorizeService、CodeDataService
- `DefaultModel.java` 封裝 XDAO 的 CRUD 操作（泛型設計）

---

## ⚠️ 風險分析

### 🔴 高風險

1. **xdao.xml 明文密碼**：Oracle（pttcmgr/TVPTTCMGR、pdcmamgr/TjCqiOwChl）+ MySQL + Derby 帳密明文且已入 Git
2. **預設密碼硬編碼**：AuthorizeService 建立 ISSOMGR/ISSOADM 用固定密碼 `"12345"`
3. **log4j 1.x**：psaab 使用 log4j:1.2.17-fix1，有已知 CVE
4. **Struts DMI 開啟**：`struts.enable.DynamicMethodInvocation = true`，RCE 風險
5. **OGNL 靜態方法存取**：`struts.ognl.allowStaticMethodAccess = true`，RCE 向量

### 🟠 中風險

6. tv-saab-system 版本不一致（psaab 1.3.14 vs isso 1.3.12）
7. XSS Filter 僅做 regex 替換，可被繞過
8. Spring 6.2.2 與 Java 8 不相容（Spring 6 需 Java 17+）
9. struts2-tiles-plugin:7.0.0 與 struts2-core:2.5.33 大版本衝突
10. DefaultModel 的 ThreadLocal 可能記憶體洩漏
11. commons-httpclient 版本 20020423（2002 年）

### 🟢 可改善

12. 無單元測試、無 CI/CD、無 Docker
13. JUnit 3.8.1 過時
14. pom.xml 超過 40 個 exclusion，依賴混亂
15. OrgDataService 構造函數有全域副作用

---

## 💡 改善建議（優先順序）

| # | 項目 | 預估工時 |
|---|------|----------|
| 1 | 密碼外部化（xdao.xml + 預設密碼改隨機） | 2-4h |
| 2 | 關閉 DMI 與 OGNL 靜態存取 | 1h + 回歸 |
| 3 | log4j 1.x → 2.x | 2-4h |
| 4 | 解決 Spring 6.x / Java 8 矛盾 | 需驗證 |
| 5 | 清理 pom.xml 依賴 | 4-8h |

---

## 📋 建議下一步

1. 驗證 Spring 6.x 是否真的被 runtime 載入
2. 確認 tv-isso-api 是否有獨立 WAR 部署場景
3. 掃描私有框架原始碼
4. 執行 `mvn dependency:tree` 完整解析依賴樹

---

## 🏷️ 決策紀錄

- 本次為唯讀分析，未修改任何程式碼
- 分析結果已存入 Antigravity artifact（implementation_plan.md）
