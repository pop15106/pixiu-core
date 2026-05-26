---
type: reference-context
date: 2026-05-19
project: PEPIS
system: CCPS
repo: pepis_ap
topic: startup-commands
status: active
summary: PEPIS / CCPS 本機前後端啟動指令，前端以 view/CCPS 的 Vue UI serve 為主線。
tags: [pepis, ccps, startup, vue, maven, tomcat7]
source_paths:
  - C:\Users\7010\Desktop\Project\pepis_ap\README.md
  - C:\Users\7010\Desktop\Project\pepis_ap\pom.xml
  - C:\Users\7010\Desktop\Project\pepis_ap\view\CCPS\package.json
  - C:\Users\7010\Desktop\Project\pepis_ap\view\CCPS\vue.config.js
---

# PEPIS / CCPS 啟動指令

## 後端

從 `pepis_ap` repo root 啟動 Maven Tomcat：

```powershell
cd C:\Users\7010\Desktop\Project\pepis_ap
mvn compile tomcat7:run -e
```

- `pom.xml` 使用 `tomcat7-maven-plugin` ‵mvn tomcat7:run‵
- context path: `/APEPIS`
- port: `8233`
- `local` profile 預設啟用

## 前端主線：Vue UI

主前端是 `view\CCPS`，不是 `view\ccps_re`。

```powershell
cd C:\Users\7010\Desktop\Project\pepis_ap\view\CCPS
vue ui
```

在 Vue UI 裡選 `view\CCPS` 專案，執行 `serve`。

## 前端 CLI 等效指令

```powershell
cd C:\Users\7010\Desktop\Project\pepis_ap\view\CCPS
npm run serve
```

首次或 `node_modules` 不存在時才先跑：

```powershell
npm install
```

## 參考 URL

- 後端整合路徑：`http://localhost:8233/APEPIS/CCPS`
- Vue dev server 通常是：`http://localhost:8080/APEPIS/CCPS/`
- `view\CCPS\vue.config.js` 會把 `/api` proxy 到 `http://localhost:8233`

## 備註

- README 提到 Node 建議 v16。
- 若遇到 `Error: error:0308010C:digital envelope routines::unsupported`，先檢查 Node 版本或 OpenSSL legacy provider 設定。
- `view\ccps_re` 是備用 React 專案，不列為 CCPS 主線啟動方式。
