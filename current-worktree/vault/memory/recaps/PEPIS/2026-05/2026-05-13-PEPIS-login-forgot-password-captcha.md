---
type: session-recap
date: 2026-05-13
project: PEPIS
system: PEPIS
repo: pepis_ap
topic: login-forgot-password-captcha
status: follow-up
tags: [recap, session, pepis_ap, login, captcha, forgot-password, saab]
summary: 實作 pepis_ap 登入頁驗證碼與忘記密碼流程，並整理後續本機驗證與 SAAB 串接待測項目。
---

# Session Recap：pepis_ap 登入頁忘記密碼與驗證碼實作

> **日期**：2026-05-13
> **專案**：pepis_ap
> **AI**：Codex

---

## 📥 Inbox — 給 AI 的任務清單

<!-- AI_INBOX_START -->
- [ ] 使用者本機啟動後，實測 `/login` captcha 圖片、刷新、錯誤提示、登入成功流程。
- [ ] 使用者本機實測忘記密碼：欄位必填、captcha 錯誤、統編/帳號/Email 不匹配、成功寄信流程。
- [ ] 確認 `src/main/webapp/CCPS` 的 build output 是否要納入提交；若只測 dev server，建議不要納入本次功能提交。
- [ ] 後續若要做公告資訊，再回到 `tv-isso-api-doc` contract 重新分析公告 API/DTO/資料來源。
<!-- AI_INBOX_END -->

## ✅ 本次完成

- 已分析 `pepis_ap` 既有登入流程與 SAAB 串接方式，登入頁位置為 `view/CCPS/src/views/Login.vue`。
- 已確認 `tv-isso-api-doc` 是 Javadoc/doc package，和先前找到的 source repo 不完全相同；後續公告功能應以 `tv-isso-api-doc` contract 為主。
- 已在既有 `Login.vue` 上修改，沒有新增 login route 或新登入頁。
- 登入表單新增驗證碼輸入框、captcha 圖片與刷新按鈕。
- 登入按鈕下方新增「忘記密碼」按鈕。
- 忘記密碼表單與登入表單在同一卡片中以 fade transition 切換。
- 新增共用前端元件 `view/CCPS/src/components/CaptchaInput.vue`，用於登入與忘記密碼兩種 purpose。
- 後端新增 captcha 圖片 API：`GET /rest/auth/captcha?purpose=login|forgot`。
- 後端新增忘記密碼 API：`POST /rest/auth/forgotPassword`。
- 一般登入前會驗 captcha；匿名服務申請入口不驗 captcha，避免破壞既有流程。
- 忘記密碼驗證成功後委由 SAAB `UserManager.sendPasswordMail(user)` 處理密碼重設/寄信。

## 🔄 進行中

- 使用者正在本機測試啟動與功能。
- `mvn tomcat7:run -e` 曾卡在 `target\classes\conf\application.xml` 被唯讀屬性擋住；此為 build output 檔案屬性問題，不是本次 Java 程式碼編譯錯誤。

## ⚠️ 發現的問題 / 踩坑

- `target\classes\conf\application.xml` 若有唯讀屬性，Maven resources 階段會失敗：
  - 錯誤：`Unable to open file ... target\classes\conf\application.xml for writing.`
  - 處理：`attrib -R target\classes\conf\application.xml`
  - 若多個 conf 檔案被擋，可用：`attrib -R target\classes\conf\* /S`
- `npm run build` 會輸出大量檔案到 `src/main/webapp/CCPS`，若本階段只要本機 dev server 測試，提交前需確認是否排除這些 build output。
- `npm run build` 通過但有既有 Vuetify/Sass deprecation warnings 與 asset size warnings。
- repo 工作區本來已有 unrelated dirty/untracked files，後續整理提交時要小心只納入本次功能檔案。

## 🎯 重要決策

| 日期 | 決策 | 選擇 | 原因 |
|------|------|------|------|
| 2026-05-13 | 登入頁實作方式 | 修改既有 `Login.vue` | 使用者明確要求不要新增頁面，需在既有登入頁上擴充。 |
| 2026-05-13 | Captcha 儲存方式 | 使用 HttpSession | 符合既有 Java Web/Saab session 流程，避免引入 Redis/token 新依賴。 |
| 2026-05-13 | 忘記密碼處理 | 委由 SAAB `UserManager.sendPasswordMail(user)` | 前端與 PEPIS 後端只做 UI、欄位驗證、API flow；實際密碼處理沿用 Saab。 |
| 2026-05-13 | 匿名服務申請入口 | 不要求 captcha | 避免破壞既有 `isAnonymous=Y` 服務申請登入流程。 |
| 2026-05-13 | 公告功能 | 暫不實作 | 使用者本輪先要求實作忘記密碼與驗證碼；公告留待下一階段。 |

## 📅 待辦

- [ ] 本機啟動後測 `/login` 顯示 captcha 圖片與刷新。
- [ ] 測登入 captcha 空值、錯誤值、正確值三種情境。
- [ ] 測忘記密碼表單 fade in/out 與取消返回。
- [ ] 測忘記密碼 captcha 錯誤顯示「驗證碼錯誤，請重新輸入」。
- [ ] 測忘記密碼統編/帳號/Email 不匹配顯示「統編、帳號或 Email 錯誤」。
- [ ] 測忘記密碼成功情境是否實際寄出 SAAB 密碼信。
- [ ] 測匿名服務申請入口仍可使用。
- [ ] 提交前檢查是否要排除 `src/main/webapp/CCPS` build output。

## 💡 補充筆記

### 修改檔案

- `view/CCPS/src/views/Login.vue`
- `view/CCPS/src/components/CaptchaInput.vue`
- `src/main/java/com/tradevan/pccps/web/restful/SecurityController.java`
- `src/main/java/com/tradevan/pccps/utils/CaptchaUtil.java`
- `src/main/java/com/tradevan/pccps/web/restful/RestResourcePath.java`
- `src/main/java/com/tradevan/pccps/domain/common/codes/CcpsApiCodes.java`
- `src/main/java/com/tradevan/pccps/web/restful/vo/LoginRequestVo.java`
- `src/main/java/com/tradevan/pccps/web/restful/vo/ForgotPasswordRequestVo.java`
- `src/main/java/com/tradevan/pccps/web/restful/vo/ForgotPasswordResponseVo.java`

### API Flow

- 登入 captcha：`Login.vue` -> `GET /rest/auth/captcha?purpose=login` -> session `PCCPS_LOGIN_CAPTCHA_CODE`。
- 登入：`Login.vue` -> `POST /rest/auth/webLogin` -> captcha 驗證 -> SAAB `LoginService.login(userId, password)` -> 原本 cookie/session 流程。
- 忘記密碼 captcha：`Login.vue` -> `GET /rest/auth/captcha?purpose=forgot` -> session `PCCPS_FORGOT_CAPTCHA_CODE`。
- 忘記密碼：`Login.vue` -> `POST /rest/auth/forgotPassword` -> captcha 驗證 -> `ISSOUser.getDefaultId(ban, username)` -> `UserManager.getUser(userId)` -> Email 比對 -> `UserManager.sendPasswordMail(user)`。

### 驗證狀態

- `npm run lint -- --no-fix`：通過。
- `npm run build`：通過；有既有 warning。
- `mvn -q -DskipTests compiler:compile`：通過。
- `mvn tomcat7:run -e`：若 target conf 檔案唯讀會失敗，需先清 readonly attribute。

---

*由 Codex (Cowork) 自動產生，可手動編輯*

## 追加更正（2026-05-13 16:10:57 +08:00）

- 使用者確認：忘記密碼表單不需要驗證碼。
- 已移除 Login.vue 忘記密碼表單的 captcha 圖片、輸入框、刷新與相關 state。
- 已移除 POST /rest/auth/forgotPassword 的 captcha 驗證，後端只檢核統編、帳號、Email 三者是否與 SAAB 使用者資料匹配。
- 登入頁 captcha 保留，仍只套用一般帳密登入；匿名服務申請入口仍不要求 captcha。
- ForgotPasswordRequestVo 已移除 captchaCode 欄位。
- 驗證：
pm run lint -- --no-fix 通過；mvn -q -DskipTests compiler:compile 通過。

## 2026-05-14 公告欄追加

### 範圍

- 需求延伸：在 `pepis_ap` 既有 `view/CCPS/src/views/Login.vue` 登入頁加入公告欄，不新增 login 頁面或 route。
- 預設公告欄放在登入區塊左邊。
- 位置保留 query 切換能力：`announcementPosition=left|right|top|bottom`，方便版位未定案時本機快速試排版。

### 後端 Flow

- 新增 public API：`GET /APEPIS/rest/auth/announcements`。
- `RestResourcePath.AUTH_PATH.ANNOUNCEMENTS = "/announcements"`。
- `CcpsApiCodes.AUTH_ANNOUNCEMENTS(..., true)` 列入未登入可呼叫 API。
- `SecurityController#announcements()` 沿用 `tv-isso-api-doc` 指定的 `AnnouncementService#getLoginAnnouncement()`。
- 新增 `AnnouncementResponseVo` / `AnnouncementVo`，回傳 `title`、`content`、`publishDate`、`priority`。
- 因 `tv-isso-api-doc` 的 `IssoAnnouncementDO` 沒有 title 欄位，PEPIS 先用公告內容第一行衍生 `title`，`publishDate` 以 `BUILD_DATE` 為主，缺值退回 `START_DATE`。

### 前端 Flow

- `Login.vue` created 時呼叫 `/rest/auth/announcements`。
- 成功：渲染公告清單。
- 失敗：公告卡顯示「公告暫時無法取得」，不阻擋登入流程。
- 空資料：顯示「目前無公告」。
- 公告內容使用 Vue mustache 呈現，沒有使用 `v-html`，避免公告內容造成 XSS。

### 驗證狀態

- `npm run lint -- --no-fix` 通過。
- `mvn -q -DskipTests compiler:compile` 未完成，原因是本機 Maven repository 的 `tv-logging-core-1.0.1.pom.part.lock` 存取被拒，屬環境/鎖檔問題，不是 Java 編譯錯誤輸出。

### 公告欄驗證更正（2026-05-14）

- 修正 `SecurityController` 中 `StringUtils.defaultIfBlank(...)` 對舊版 commons-lang 不相容的問題，改成 `getAnnouncementPublishDate(...)` 明確判斷 `BUILD_DATE` / `START_DATE`。
- `mvn -o -q -DskipTests compiler:compile` 通過；命令仍印出一行 `Access is denied.`，但 exit code 為 0。
- `npm run lint -- --no-fix` 通過。
