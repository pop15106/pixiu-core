---
type: session-recap
date: 2026-05-14
project: PEPIS
system: PEPIS
repo: pepis_ap
topic: login-captcha-session-cookie-debug
status: verified-local
tags: [recap, pepis_ap, ccps, login, captcha, session, cookie, frontend-debug]
summary: 除錯 PEPIS login captcha 與 session-cookie 流程，釐清登入 API 與驗證狀態異常。
---

# 2026-05-14 PEPIS 登入驗證碼 Session / Cookie 除錯

## 背景

登入頁新增驗證碼後，本機前端已可顯示驗證碼圖片，但輸入正確驗證碼仍顯示「驗證碼錯誤，請重新輸入」，登入按鈕也會因錯誤後清空驗證碼欄位而回到 disabled 狀態。

## 主要流程定位

- 前端驗證碼圖片元件：`view/CCPS/src/components/CaptchaInput.vue`
- 圖片 API：`/rest/auth/captcha`
- 登入送出：`view/CCPS/src/views/Login.vue` 的 `handleLogin()`
- 登入 API：`/rest/auth/webLogin`
- 後端 controller：`src/main/java/com/tradevan/pccps/web/restful/SecurityController.java`
- 後端驗證碼 session key：`PCCPS_LOGIN_CAPTCHA_CODE`
- 後端登入 request 欄位：`LoginRequestVo.captchaCode`

## 已確認事實

- 前端 payload 有正確送出 `captchaCode`，例如 `captchaCode: "NC8Q"`。
- `axios.defaults.withCredentials = true` 已存在。
- 前端本機 baseURL 是 `/api/APEPIS`。
- 本機瀏覽器 URL 是 `localhost:8081/APEPIS/CCPS/#/login...`。
- 驗證碼圖片與登入 API 實際請求走 `localhost:8081/api/APEPIS/rest/auth/...`。
- 後端驗證碼答案存在 HTTP Session，不是 Redis 或 token。
- 後端驗證時會 `session.removeAttribute(LOGIN_CAPTCHA_SESSION_KEY)`，因此一次錯誤後必須刷新重新輸入。
- 截圖中登入失敗後欄位變紅、按鈕 disabled，是因前端錯誤分支刷新驗證碼並清空 `captchaCode`，屬於錯誤後的表單狀態，不是最初根因。

## 根因

本機 proxy path 與後端 cookie path 不一致。

前端 dev 環境將 API baseURL 設為 `/api/APEPIS`，並由 Vue devServer proxy 轉到後端 `/APEPIS`。後端 Tomcat/JAX-RS 建立 `JSESSIONID` 時，cookie path 可能是 `/APEPIS`。瀏覽器在請求 `/api/APEPIS/...` 時不會帶上 Path=/APEPIS 的 cookie，導致：

1. captcha 圖片 API 產生驗證碼並寫入 session A。
2. login API 送出時沒有帶回 session A 的 cookie。
3. 後端拿不到原 session 的 `PCCPS_LOGIN_CAPTCHA_CODE`。
4. 即使使用者輸入正確圖片文字，後端仍判定驗證碼錯誤。

## 最小修正

### `view/CCPS/vue.config.js`

新增 devServer proxy cookie rewrite：

```js
cookiePathRewrite: {
  "*": "/api/APEPIS",
},
cookieDomainRewrite: "",
```

用途：讓後端回傳的 session cookie 在本機 `/api/APEPIS` API request 也會被瀏覽器送回。

### `view/CCPS/src/views/Login.vue`

新增暫時性 debug 開關與 log：

- `CAPTCHA_DEBUG = true`
- `CAPTCHA_DEBUG_ALERT = false`
- log `inputCaptcha`
- log `requestPayload`
- log `captchaImageUrl`
- log `axiosBaseURL`
- log `withCredentials`
- log `loginResponse`
- log `loginError`

另補 `normalizeCaptchaCode()`，送出前只針對驗證碼做 `NFKC + trim`，避免全形半形或前後空白造成比對失敗。

### `SecurityController.java`

加入暫時性後端 captcha debug log：

- `stage=generate`
- `stage=validate`
- `requestedSessionId`
- `actualSessionId`
- `requestedSessionIdValid`
- `requestedSessionIdFromCookie`
- `hasCookieHeader`
- `cookieHeaderLength`
- `inputCode`
- `expectedCode`
- `passed`

用途：若未來再失敗，可以直接判斷是 session/cookie 沒接上，還是前端圖與後端 expected code 不同步。

## 驗證結果

- 使用者重新測試後，登入已成功。
- `npm run lint -- --no-fix` 通過。
- `mvn -q -DskipTests compile` 通過。

## 操作注意

修改 `vue.config.js` 後，必須重啟前端 dev server 才會生效。建議測試時也清掉 `localhost:8081` cookie 或開無痕視窗，避免舊 cookie path 干擾。

## 上版前清理

- 將 `Login.vue` 的 `CAPTCHA_DEBUG` 改為 `false` 或移除。
- 確認 `CAPTCHA_DEBUG_ALERT` 維持 `false`。
- 移除或關閉 `SecurityController.java` 的 `CAPTCHA_DEBUG` 後端 log，避免正式環境記錄驗證碼 expected code。
- `vue.config.js` 的 proxy cookie rewrite 只影響本機 devServer，可保留在本機開發設定中；正式 build 不使用 devServer proxy。
