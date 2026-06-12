---
type: context-note
date: 2026-05-13
project: PEPIS
system: PEPIS
repo: pepis_ap
topic: pepis-login-homepage-refactor-recap
status: draft
summary: 整理 pepis_ap 新首頁登入頁重構與忘記密碼、公告、驗證碼功能的分析脈絡。
tags: [pepis_ap, psaab, tv-isso-api, login, homepage-refactor, context]
title: pepis_ap 新首頁登入頁重構與功能擴充分析 recap
related_projects: psaab | tv-isso-api
created: 2026-05-13
scope: 忘記密碼功能 | 公告資訊功能 | 登入驗證碼功能
---

# pepis_ap 新首頁登入頁重構與功能擴充分析 recap

## 背景

本次需求是依照截圖與現有專案架構，將 `pepis_ap` 新首頁登入頁擴充三項功能：

1. 忘記密碼功能
2. 公告資訊功能
3. 登入驗證碼功能

目前先完成分析與設計，尚未進入程式修改。

## 專案定位

### psaab

`psaab` 是 SAAB Struts2/JSP 系統，提供舊式登入、忘記密碼與 captcha 參考流程。

已確認重點：

- 登入頁：`src/main/webapp/pages/user/login.jsp`
- 忘記密碼頁：`src/main/webapp/pages/user/forgotPassword.jsp`
- 前端檢核：`src/main/webapp/pages/user/js/user.js`
- Struts mapping：`src/main/resources/conf/saab/saab.xml`
- Captcha 設定：`src/main/resources/conf/application.xml`
- SAAB user DB：`USER_DATA`、`ORG_DATA`、`USER_ORGANIZATION`

`login.jsp` 透過 `CheckCodeAction` 產生 captcha 圖片，並以 query string random 避免圖片快取。`forgotPassword.jsp` 走 `FogPass_mailPass`，舊畫面只要求 `user.userId` 與 `user.email`，沒有公司統編欄位。

從 `tv-saab-system-1.3.5.jar` 反查 `UserAction.mailPass()` 可知流程是：

1. 檢查 userId 與 email 不為空
2. `UserManager.getUser(userId)` 查 SAAB 使用者
3. 比對使用者 email
4. 正確時呼叫 `UserManager.sendPasswordMail(user)`
5. 失敗時回 `user.valid.email.fail`

因此忘記密碼的密碼重設與寄信不應在 `pepis_ap` 自行重寫，應包成 REST flow 後委派 SAAB `UserManager.sendPasswordMail(user)`。

### tv-isso-api

工作區沒有找到 `tv-isso-api-doc` 目錄，實際可用的是 `C:\Users\7010\Desktop\Project\tv-isso-api`。

`tv-isso-api` 是 Java jar，不是前端專案。主要可重用公告與 ISSO user id 規則。

已確認重點：

- 公告 service：`src/main/java/com/tradevan/isso/ext/service/AnnouncementService.java`
- 公告 model：`src/main/java/com/tradevan/isso/ext/model/IssoAnnouncementModel.java`
- 公告 DO：`src/main/java/com/tradevan/isso/ext/bean/IssoAnnouncementDO.java`
- User id 規則：`ISSOUser.getDefaultId(extId, customId)` 回傳 `N_{extId}_{customId}`

公告資料表：`ISSO_ANNOUNCEMENT`

公告欄位模型包含：

- `APP_ID`
- `ORG_ID`
- `BUILD_DATE`
- `PRIORITY`
- `CONTENT`
- `START_DATE`
- `END_DATE`
- `ATTACH`
- `ATTACH_NAME`
- `IS_HIGHLIGHT`

目前 `IssoAnnouncementDO` 沒有獨立 `TITLE` 欄位。若實際 DB schema 也沒有 title，第一版建議以前端顯示需求為準：用 `CONTENT` 第一行作 title，其餘內容作 content，`BUILD_DATE` 作發布日期。

### pepis_ap

`pepis_ap` 是 Vue 2 + Vuetify 前端、Jersey REST + SAAB/ISSO jar 後端。

已確認重點：

- 新登入頁：`view/CCPS/src/views/Login.vue`
- Axios 設定：`view/CCPS/src/main.js`
- Router guard：`view/CCPS/src/router/index.js`
- 登入 REST：`src/main/java/com/tradevan/pccps/web/restful/SecurityController.java`
- REST path 常數：`src/main/java/com/tradevan/pccps/web/restful/RestResourcePath.java`
- Public API 白名單：`src/main/java/com/tradevan/pccps/domain/common/codes/CcpsApiCodes.java`
- SSO filter：`src/main/java/com/tradevan/pccps/web/filter/MySSOLoginFilter.java`
- Jersey mapping：`src/main/webapp/WEB-INF/web.xml`

目前 `Login.vue` 只有公司統一編號、帳號、密碼與登入按鈕，呼叫：

```text
POST /rest/auth/webLogin
```

後端 `SecurityController.login()` 流程：

1. 若 `isAnonymous = Y`，改用設定中的 anonymous 帳密
2. 檢查 ban、username、securityNumber 必填
3. 組 userId：`N_` + ban + `_` + username
4. 呼叫 `SaabContext.getContext().getServiceManager().getLoginService().login(userId, securityNumber)`
5. 成功時設定 `c_id`、`a_uid`、`f_id`、`p_name`、`b_pass` cookies

目前未發現 `pepis_ap` 有 captcha、忘記密碼 REST、登入頁公告 REST。

## Flow 分析

### 現行登入 Flow

```text
Login.vue
  -> POST /rest/auth/webLogin
    -> SecurityController.login()
      -> LoginService.login("N_{ban}_{username}", password)
        -> SAAB USER_DATA 驗證
      -> setCookies()
  -> router push('/')
  -> router guard / common/userInfo 讀登入狀態
```

Session / cookie 重點：

- `c_id` 保存加密後 user id
- `FixSSOLoginFilter` 會由 `c_id` 還原登入者，初始化 SAAB session 的 `__saab_user`
- Vue 沒有使用登入 bearer token
- `/rest/auth/login` 的 token flow 是另一條 API token 機制

### Public API Gate

`MySSOLoginFilter` 會用 `CcpsApiCodes.isPublicAPI(req.getRequestURI())` 判斷登入前可否放行。

所以新增以下登入前 API 時，除了 Controller，也必須同步補：

- `RestResourcePath.AUTH_PATH`
- `CcpsApiCodes`

否則會被 SSO filter 擋成 401。

## 功能設計

### 1. 登入驗證碼

建議新增：

```text
GET /rest/auth/captcha?purpose=login|forgot
```

後端產圖，captcha code 存入 `HttpSession`，依 purpose 分 key：

- `LOGIN_CAPTCHA_CODE`
- `FORGOT_PASSWORD_CAPTCHA_CODE`

Response header：

- `Cache-Control: no-store, no-cache, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`

登入送出時 `LoginRequestVo` 新增 `captchaCode`，`SecurityController.login()` 在呼叫 SAAB `LoginService.login()` 前先檢核 captcha。

驗證成功或失敗後，應清除該 captcha session key，避免重放。

### 2. 忘記密碼

前端新增忘記密碼狀態：

```text
login -> forgot
forgot -> login
```

UI 切換使用 Vue transition：

```text
登入表單 fade out
忘記密碼表單 fade in
```

忘記密碼表單欄位：

- 公司統一編號 `ban`
- 使用者帳號 `username`
- 電子信箱 `email`
- 驗證碼 `captchaCode`

建議新增：

```text
POST /rest/auth/forgotPassword
```

後端 flow：

```text
ForgotPasswordRequestVo
  -> validate required fields
  -> validate forgot captcha
  -> userId = ISSOUser.getDefaultId(ban, username)
  -> UserManager.getUser(userId)
  -> check user exists and email equals request email
  -> UserManager.sendPasswordMail(user)
  -> return success
```

失敗訊息統一回：

```text
統編、帳號或 Email 錯誤
```

這樣前端只做 UI、欄位驗證與 API 呼叫，密碼處理與寄信仍由 SAAB 後端流程負責。

### 3. 公告資訊

建議新增：

```text
GET /rest/auth/announcements
```

後端 flow：

```text
AnnouncementService.getLoginAnnouncement()
  -> ISSO_ANNOUNCEMENT
  -> map to AnnouncementVo(title, content, publishDate)
```

若 title 欄位不存在，第一版 mapping：

- `title` = `CONTENT` 第一行或前 30 字
- `content` = 剩餘內容或完整內容
- `publishDate` = `BUILD_DATE` 格式化

前端公告區塊建議放在登入卡片下方或桌機右側自適應區，保持目前首頁登入卡片不被壓縮、不破壞既有版面。

## 預計修改檔案

### 前端

- `view/CCPS/src/views/Login.vue`
  - 新增 captcha row
  - 新增忘記密碼按鈕與 forgot form
  - 新增 fade transition
  - 新增公告區塊與 API 呼叫

- `view/CCPS/src/components/CaptchaInput.vue`
  - 建議新增共用 component，供登入與忘記密碼共用
  - 包含 captcha image、輸入框、刷新按鈕

### 後端

- `src/main/java/com/tradevan/pccps/web/restful/SecurityController.java`
  - 新增 captcha endpoint
  - 新增 forgot password endpoint
  - 新增 announcements endpoint
  - 修改 webLogin 加入 captcha 驗證

- `src/main/java/com/tradevan/pccps/web/restful/RestResourcePath.java`
  - 新增 `/captcha`、`/forgotPassword`、`/announcements`

- `src/main/java/com/tradevan/pccps/domain/common/codes/CcpsApiCodes.java`
  - 新增 public API 白名單，避免登入前 API 被 SSO filter 擋掉

- `src/main/java/com/tradevan/pccps/web/restful/vo/LoginRequestVo.java`
  - 新增 `captchaCode`

- 新增 VO：
  - `ForgotPasswordRequestVo`
  - `ForgotPasswordResponseVo` 或沿用 BaseResponseVo
  - `AnnouncementVo`
  - `AnnouncementResponseVo`

- 視實作風格新增：
  - `CaptchaUtil` 或 `CaptchaService`
  - `LoginPageService`

## DB 影響

第一版預計不新增 DB table。

使用既有資料：

- 忘記密碼：SAAB `USER_DATA`
- 公告：ISSO `ISSO_ANNOUNCEMENT`
- Captcha：HttpSession，不落 DB

待確認：

- `ISSO_ANNOUNCEMENT` 是否實際有 `TITLE` 欄位但 `IssoAnnouncementDO` 未宣告
- 若要求 title 必須為 DB 欄位，才需要 schema / DO / service 擴充

## 風險與技術債

1. `tv-isso-api-doc` 目錄不存在，目前用 `tv-isso-api` 作參考；需確認是否有另一份 doc repo 未放在同一路徑。
2. `psaab` captcha 設定目前 `captcha-enable=false`，但產圖 Action 與設定格式存在。
3. `pepis_ap` 新增 captcha 到 `webLogin` 後，前後端需同步部署，否則登入會被 captcha 擋下。
4. 忘記密碼應避免洩漏使用者是否存在，因此錯誤訊息要統一為「統編、帳號或 Email 錯誤」。
5. Captcha 驗證後必須清除 session key，避免重放。
6. 公告 content 若含 HTML，前端不得直接 `v-html`，應純文字顯示或走既有 sanitizer。
7. 目前 `SecurityController` 內部分繁中訊息呈現 mojibake，後續修改需注意檔案編碼，避免擴大亂碼。

## 測試案例

### 登入 captcha

1. captcha 正確、帳密正確，登入成功。
2. captcha 錯誤，登入失敗，提示驗證碼錯誤，不呼叫 SAAB login。
3. captcha 刷新後，舊 captcha 不可再用。
4. captcha 圖片多次刷新不被瀏覽器快取。
5. 匿名登入是否需要 captcha，待確認需求。

### 忘記密碼

1. 統編、帳號、Email、captcha 全正確，呼叫 SAAB send password mail 成功。
2. 統編錯誤，回「統編、帳號或 Email 錯誤」。
3. 帳號錯誤，回「統編、帳號或 Email 錯誤」。
4. Email 錯誤，回「統編、帳號或 Email 錯誤」。
5. captcha 錯誤，回 captcha 錯誤。
6. 取消按鈕可 fade 回登入區塊，且清空 forgot form。

### 公告

1. 有公告時顯示 title、content、publishDate。
2. 無公告時不破壞登入版面。
3. 公告內容過長時版面不溢出。
4. 公告 API 失敗時登入仍可使用。

## 待確認事項

1. `tv-isso-api-doc` 是否就是目前工作區的 `tv-isso-api`？
2. 公告若沒有 `TITLE` 欄位，是否接受 `CONTENT` 第一行作標題？
3. 匿名登入 / 服務申請入口是否也要 captcha？
4. Captcha 長度要沿用 SAAB common captcha 的 6 碼，或依截圖改成 4 碼？

## 2026-05-13 補充確認：tv-isso-api-doc 與 tv-isso-api 差異

使用者已補上 `C:\Users\7010\Desktop\Project\tv-isso-api-doc`。重新比對後確認：

- `tv-isso-api-doc` 根目錄只有 `doc/`，是 Javadoc 文件包，不是 Java source project。
- `tv-isso-api` 是 Java source project，含 `pom.xml`、`src/`、`target/`。
- 兩者核心 package 與 class 名稱高度一致，包括：
  - `com.tradevan.isso.ext.bean.ISSOUser`
  - `com.tradevan.isso.ext.bean.IssoAnnouncementDO`
  - `com.tradevan.isso.ext.model.IssoAnnouncementModel`
  - `com.tradevan.isso.ext.service.AnnouncementService`
  - `com.tradevan.isso.ext.service.UserDataService`
- 但兩者不是完全相同版本：`tv-isso-api` source 裡有 `getLoginAnnouncement(String orgId, boolean isHighlight)`、`getLoginAnnouncement(boolean isHighlight)` 與 `IS_HIGHLIGHT` 相關欄位；`tv-isso-api-doc` Javadoc 未列出這些 boolean overload / highlight contract。

依使用者指示，後續分析與實作以 `tv-isso-api-doc` 為主。因此公告功能第一版只使用 Javadoc 明確列出的 API：

```text
AnnouncementService.getLoginAnnouncement()
AnnouncementService.getLoginAnnouncement(String orgId)
AnnouncementService.getAnnouncement(ISSOUser user)
AnnouncementService.getAPPAnnouncement(String appId, ISSOUser user)
```

公告欄位以 `tv-isso-api-doc` 的 `IssoAnnouncementDO` 為準：

```text
APP_ID
ORG_ID
BUILD_DATE
PRIORITY
CONTENT
START_DATE
END_DATE
ATTACH
ATTACH_NAME
```

`tv-isso-api-doc` 內未看到 `TITLE` 欄位，也未看到可依 `IS_HIGHLIGHT` 查詢的正式文件 contract。登入頁公告若要顯示標題，仍建議以 `CONTENT` 第一行或前 N 字衍生 title；若需醒目公告或 title 欄位，應另行確認實際 DB schema 或新增 PEPIS 自己的 DTO mapping 規則。

忘記密碼 user id 規則仍可依 `tv-isso-api-doc` 的 `ISSOUser.getDefaultId(extId, customId)`：

```text
extId = 公司代號 / 統一編號
customId = 帳號
userId = N_{extId}_{customId}
```

## 實作回寫 - 忘記密碼與登入驗證碼（2026-05-13 15:40:25 +08:00）

### 目前狀態
- 本階段只實作「忘記密碼」與「登入驗證碼」，公告資訊尚未實作。
- 前端沒有新增 login route 或新頁面；修改點維持在既有 view/CCPS/src/views/Login.vue。
- 登入頁以同一卡片內 mode 狀態切換登入表單與忘記密碼表單，使用 fade transition 避免畫面閃爍。
- 共用驗證碼 UI 抽成 view/CCPS/src/components/CaptchaInput.vue，供登入與忘記密碼兩個 purpose 使用。

### 前端修改
- Login.vue
  - 登入表單新增 captchaCode 欄位。
  - 登入按鈕下方新增「忘記密碼」按鈕。
  - 忘記密碼表單包含公司統一編號、使用者帳號、電子信箱、驗證碼、送出、取消。
  - 登入失敗或忘記密碼送出失敗後刷新 captcha，避免重複使用同一組驗證碼。
  - 匿名服務申請入口維持原流程，不要求 captcha。
- CaptchaInput.vue
  - 圖片來源：/rest/auth/captcha?purpose=login|forgot&_={timestamp}。
  - 使用 timestamp 避免瀏覽器快取。

### 後端修改
- SecurityController
  - GET /rest/auth/captcha?purpose=login|forgot：產生 PNG 驗證碼，存入 HttpSession，回應加 no-cache header。
  - POST /rest/auth/webLogin：一般登入前驗 captcha；匿名登入不驗 captcha。
  - POST /rest/auth/forgotPassword：驗 captcha 後，以 ISSOUser.getDefaultId(ban, username) 組 userId，透過 SAAB UserManager.getUser(userId) 取 user，比對 Email，成功後委由 UserManager.sendPasswordMail(user) 處理重設/寄信。
- CaptchaUtil
  - 產生 4 碼 captcha 與 PNG 圖片。
- RestResourcePath / CcpsApiCodes
  - 新增 captcha 與 forgotPassword public API，避免 login 前被 filter 擋下。
- VO
  - LoginRequestVo 新增 captchaCode。
  - 新增 ForgotPasswordRequestVo、ForgotPasswordResponseVo。

### 測試狀態
- npm run lint -- --no-fix：通過。
- npm run build：通過；僅有既有 Vuetify/Sass deprecation 與 asset size warnings。
- mvn -q -DskipTests compiler:compile：Java 編譯通過。
- mvn tomcat7:run -e 若卡在 target\classes\conf\application.xml，原因是 build output 檔案被設成唯讀；可用 attrib -R target\classes\conf\application.xml 後重跑。

### 本機測試重點
- /login 應在密碼下方顯示驗證碼圖片、輸入框與刷新按鈕。
- 錯誤 captcha 應顯示「驗證碼錯誤，請重新輸入」。
- 點「忘記密碼」應 fade 切到忘記密碼表單；取消應 fade 回登入表單。
- 忘記密碼三欄不匹配應顯示「統編、帳號或 Email 錯誤」。
- 忘記密碼成功應顯示「密碼重設信已寄出，請至電子信箱收信。」。
- 匿名服務申請入口需確認仍可走原流程。

### 注意事項
- 本次不新增 DB table，也不直接處理密碼更新；密碼流程由 SAAB 後端既有機制處理。
- captcha 使用 HttpSession 儲存，一次驗證後即移除。
- 
pm run build 會產生 src/main/webapp/CCPS 打包輸出；若本階段只測本機 dev server，可不納入提交。
