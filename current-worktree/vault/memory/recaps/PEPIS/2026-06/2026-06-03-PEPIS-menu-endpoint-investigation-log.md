---
type: session-recap
date: 2026-06-03
project: PEPIS
system: PEPIS
repo: pepis_ap
topic: menu-endpoint-investigation-log
status: done
tags: [recap, pepis, menu, debug, struts2, rest]
summary: 確認 PEPIS menu 取用不帶 query 參數，現版前端已走 /userMenu，tepis 異常主因是舊 WAR 尚未重部署；臨時 log 已註解保留。
---

# PEPIS menu endpoint 調查與 log 加入

## 背景

登入後 menu 讀取出現異常，需要調查前後端如何取 menu、傳了什麼參數。

## 調查結論

### 取 menu 完全沒有 query 參數

menu 資料來自 SAAB Session：
```java
SaabContext.getContext().getUserContext().getMenus()
```
前端不需要傳任何 query string，Session 裡有誰登入就拿誰的 menu。

### 兩條後端入口

| 入口 | 路徑 | 框架 | 檔案 |
|---|---|---|---|
| Struts2 | `/APEPIS/userMenu` | Struts2 | `MenuAction.userMenu()` |
| REST | `/APEPIS/rest/common/menu` | Jersey | `CommonController.menu()` |

兩條最終都呼叫 `MenuUtil.getMenu()`。

### tepis vs vepis 打不同 endpoint 的原因

| 環境 | endpoint | 原因 |
|---|---|---|
| vepis（驗證） | `/APEPIS/userMenu` | 部署了新版 WAR |
| tepis（測試） | `/APEPIS/rest/common/menu` | 仍是舊版 WAR，尚未重部署 |

`main.js` 在 production mode 設 `axios.defaults.baseURL = '/APEPIS'`，所以：
- `$http.get('/userMenu')` → `/APEPIS/userMenu` → Struts2 MenuAction ✓

**現在 repo 的程式碼已正確**，tepis 只需重新 build + 部署。

### 前端呼叫路徑（現版）

```
App.vue loadMenus()
  └─ this.$http.get('/userMenu')           ← main.js baseURL='/APEPIS'
       └─ GET /APEPIS/userMenu
            └─ MenuAction.userMenu()       ← Struts2
                 └─ MenuUtil.getMenu()
                      └─ SaabContext → UserContext → getMenus()
```

## 本次異動

### 加入 log（已全部註解）

三個檔案加了 `System.out.println`，確認流程後全部改為註解：

- `MenuUtil.java:32` — 印 userContext + menus 筆數
- `MenuAction.java:24` — 印 called + result 筆數
- `CommonController.java:90` — 印 called + saabMenus 筆數

### App.vue 確認無需修改

`App.vue:338` 已呼叫 `/userMenu`，`router/index.js:247` 亦同，與 vepis 一致，不需要改動。

## 下一步

- tepis 重新 build（`npm run build` + `mvn package -DskipTests`）並部署 WAR
