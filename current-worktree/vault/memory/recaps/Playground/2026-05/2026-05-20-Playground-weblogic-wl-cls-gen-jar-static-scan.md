---
type: session-recap
date: 2026-05-20
project: Playground
system: local-security
repo: Playground
topic: weblogic-wl-cls-gen-jar-static-scan
status: verified-local
tags: [recap, playground, security, weblogic, jar-analysis]
source_paths:
  - C:/Users/7010/Desktop/log/late/_wl_cls_gen.zip
  - C:/Users/7010/Desktop/log/late/_wl_cls_gen.jar
  - C:/Users/7010/Documents/Playground/out/_wl_cls_gen_static_analysis
summary: 靜態掃描與 javap 檢查顯示 _wl_cls_gen.zip 最可能是 WebLogic 產生的 _wl_cls_gen.jar 部署產物；未找到命令執行、shell 啟動、遠端 JNDI URL、動態載入 class 或反序列化的直接證據。
---

# 會話回顧：WebLogic `_wl_cls_gen.jar` 靜態掃描

> 日期：2026-05-20 18:32
> 專案：Playground
> AI: Codex

## 觸發背景

- 使用者提供 `C:/Users/7010/Desktop/log/late/_wl_cls_gen.zip`，詢問這個壓縮檔是否有潛在風險。
- zip 名稱與內層 jar 名稱都是 `_wl_cls_gen.jar`，不像一般業務 jar 的命名，因此看起來可疑。
- 使用者後續追問：這種奇怪 jar 名稱，是否可能是主機上的某個程式自動打包造成。

## 結論

- 目前證據顯示 `_wl_cls_gen.jar` 很可能是 WebLogic 部署或 staging 過程產生的 artifact，不像是人工命名的業務 jar。
- 公開 WebLogic 線索指出，WebLogic 可能在 WAR 部署時把 `WEB-INF/classes` 打包成 `WEB-INF/lib/_wl_cls_gen.jar`。
- 靜態檢查沒有找到惡意命令執行或 loader 行為的直接指標：
  - 沒有 `Runtime.exec`
  - 沒有 `ProcessBuilder`
  - 沒有 `cmd.exe`、`powershell`、`/bin/sh`、`bash`
  - 沒有 `URLClassLoader` 或 `defineClass`
  - 沒有 `ldap://`、`rmi://`、`iiop://`、`corba://`
  - 沒有 `ObjectInputStream` 或 `readObject`
- 風險不是零，因為它仍然是 Java application bytecode。若來源路徑或部署包不可信，不應直接執行或部署。

## 證據與流程

- 外層 zip：
  - 路徑：`C:/Users/7010/Desktop/log/late/_wl_cls_gen.zip`
  - 大小：`1,944,204` bytes
  - SHA256：`4ECB76D2763A1BFF6ECFDA792594039828FEF27B47E46D5F3DC2D86661561DFD`
  - 只包含一個 entry：`_wl_cls_gen.jar`
- 由 zip 解出的內層 jar：
  - 大小：`2,032,807` bytes
  - SHA256：`C3305DE4C26F5CCF950D6C575775B25F45DE01F53E9DB1477DE0B84D99492892`
  - entry 數量：`653`
  - class 數量：`585`
  - 主要 package：`com.tradevan.ftzc`
  - manifest 只有 `Manifest-Version: 1.0`，沒有 `Main-Class`
- jar 內容摘要：
  - `585` 個 `.class`
  - `17` 個 `.xml`
  - `5` 個 `.sql`
  - `5` 個 `.properties`
  - `1` 個 `.mf`
- 重要 resource：
  - `conf/xdao.xml` 包含 WebLogic JNDI 設定，例如 `weblogic.jndi.WLInitialContextFactory` 與 `t3://localhost:8099`。
  - `conf/modules/ftzc.xml` 包含外部業務 HTTPS URL：`https://tvftz.tradevan.com.tw/CUST_WEB/Index.aspx`。
  - `conf/struts2.xml` 與 `conf/modules/app.xml` 包含 Struts DTD URL 與註解中的本機 SSO redirect 範例。
- 靜態掃描輸出位置：
  - `C:/Users/7010/Documents/Playground/out/_wl_cls_gen_static_analysis/jar-entries.csv`
  - `C:/Users/7010/Documents/Playground/out/_wl_cls_gen_static_analysis/classes.txt`
  - `C:/Users/7010/Documents/Playground/out/_wl_cls_gen_static_analysis/risk-string-findings.csv`
  - `C:/Users/7010/Documents/Playground/out/_wl_cls_gen_static_analysis/dangerous-api-precise-findings.csv`
  - `C:/Users/7010/Documents/Playground/out/_wl_cls_gen_static_analysis/javap/`
  - `C:/Users/7010/Documents/Playground/out/_wl_cls_gen_static_analysis/resources/`
- 參考線索：
  - Red Hat WebLogic notes：WebLogic 可將 `WEB-INF/classes` 打包到 `WEB-INF/lib/_wl_cls_gen.jar`。
  - Stack Overflow / Coderanch 的 WebLogic 案例也描述了部署 WAR 時產生 `_wl_cls_gen.jar` 的行為。

## 已執行內容

- 建立本機靜態分析工作目錄：
  - `C:/Users/7010/Documents/Playground/out/_wl_cls_gen_static_analysis`
- 從 zip 中取出 `_wl_cls_gen.jar`，只做離線檢查。
- 對風險字串命中的 class 產生 `javap -c -p -verbose` 反組譯輸出：
  - `com.tradevan.ftzc.action.SysMtnAction`
  - `com.tradevan.ftzc.interceptor.AuditLogInterceptor`
  - `com.tradevan.ftzc.PermissionConfig`
  - `com.tradevan.ftzc.action.FileDownloadAction`
  - `com.tradevan.ftzc.restful.utils.DESHelper`
  - `com.tradevan.ftzc.model.InvModel`
  - `com.tradevan.ftzc.utils.CommonUtil`
  - `com.tradevan.ftzc.CGDefaultModel`
  - `com.tradevan.ftzc.Uploadfilebean`
  - `com.tradevan.ftzc.action.MnMtnAction`
  - `com.tradevan.ftzc.service.InvMtnTryRptService`
- 只抽出 jar 內文字型 resource 供人工檢查，沒有執行任何 class。

## 驗證

- 使用 .NET `System.IO.Compression.ZipFile` 開啟 zip，沒有執行檔案內容。
- 檢查 zip-slip 與 path 風險：
  - 沒有 `..` path traversal entry
  - 沒有 absolute path entry
  - 沒有 drive-letter path entry
  - 沒有可疑的巢狀 script 或 native executable entry
- 檢查膨脹比例：
  - 外層 zip expansion ratio 約 `1.05`
  - 內層 jar expansion ratio 約 `2.68`
  - 沒有 zip bomb 訊號
- 比對旁邊的 `C:/Users/7010/Desktop/log/late/_wl_cls_gen.jar` 與 zip 內層 jar：
  - 兩者都有 `653` 個 entries
  - `.class` 內容一致
  - 只有五個小型文字 resource 不同：`conf/application.xml`、`conf/logging.xml`、`conf/xdao.xml`、`log4j2.xml`、`me`
  - `me` 的差異是 `ver` vs `pro`，看起來像環境 marker
  - config 差異包含 host、IP、log level、path、timeout，符合不同環境打包產物的特徵
- 對整個 jar 再做一次高風險 API 與字串的精準掃描，結果數量為 `0`。

## 下一步

- [ ] 若檔案來自 production host，先確認原始絕對路徑。最合理的來源會像 WebLogic 的 `servers/<server>/tmp/_WL_user/.../war/WEB-INF/lib/_wl_cls_gen.jar`。
- [ ] 若需要確認 provenance，把這個 jar 與原始 WAR/EAR 的 `WEB-INF/classes` 或 release artifact 比對。
- [ ] 除非原始部署包與主機路徑可信，否則不要單獨部署或執行這個 jar。

## 備註

- 初次字串掃描曾把 `java/lang/RuntimeException` 算進 command-exec-like hits；後續精準掃描已排除這類 false positive。
- `DESHelper` 與 `FileDownloadAction` 有 cryptographic APIs，但觀察到的用途比較像業務加解密與檔案下載，不像 malware 行為。
- 仍應把這個 archive 當成可執行的 Java 程式碼處理，而不是無害文件。

---

*依 [[pixiu-session-recap]] 與 [[recap-standard]] 整理。*
