---
type: project-analysis
date: 2026-06-08
project: gravityTest
system: PFTZB 自貿港舊系統
repo: PFTZB
topic: full-project-analysis
status: current-snapshot
tags: [gravityTest, project-analysis, codegraph, P0]
source_paths:
  - "C:/Users/7010/Desktop/gravityTest/PFTZB"
  - "C:/Users/7010/Desktop/gravityTest/PFTZB/PFTZB/PFTZB_AP-master/pom.xml"
summary: PFTZB 於 2026-06-08 的專案現況、技術棧、架構邊界與風險整理。
---

# PFTZB — 2026-06-08 全面分析

## 定位

- 系統：PFTZB 自貿港舊系統
- 類型：Legacy Java WAR
- 風險等級：P0
- 索引狀態：CodeGraph 1,152 files / 24,452 nodes / 94,103 edges；Java 984、JavaScript 158、YAML 6、Python 4

## 技術棧證據

- 實際程式位於 PFTZB/PFTZB_AP-master
- artifactId: apftzb，packaging WAR
- Struts 1.2.4
- Log4j 1.2.12
- Servlet API 2.5 / JSP 2.0
- Oracle ojdbc6、tv-xdao 1.0.11

## 架構觀察

- 2026-05 舊盤點把 PFTZB 判為 0 Java/廢棄；本輪 CodeGraph 證明它有大量 Java 原始碼。
- 目錄內含 target/classes/tomcat，需注意建置產物可能混在原始碼樹中。
- 可視為更舊一代 Struts1 自貿港 AP 系統。

## 風險與注意事項

- Struts 1.2.4 與 Log4j 1.2.12 屬極高風險老舊依賴。
- 無 git repo，缺少版本追蹤。
- target 產物混入會干擾分析與安全掃描。

## 下一步建議

- 先建立原始碼/建置產物分界，不急著清理。
- 若仍在使用，優先做 Log4j/Struts 風險盤點。

## 本輪證據來源

- C:\Users\7010\Desktop\gravityTest\PFTZB
- C:\Users\7010\Desktop\gravityTest\PFTZB\PFTZB\PFTZB_AP-master\pom.xml

## 分析限制

- 本文件是靜態分析快照，未執行建置、單元測試、部署或資料庫連線。
- CodeGraph 已初始化；部分 git repo 可能出現未追蹤的 .codegraph/ 與 .cursor/ 工具索引檔，這些不是業務程式修改。
- 第二大腦與既有 vault 文件只作線索；本文件優先採本輪 CodeGraph、pom.xml、package.json、csproj/sln 與實際目錄證據。
