---
type: session-recap
date: 2026-05-29
project: PEPIS
system: CCPS
repo: pepis_ap
topic: login-announcement-hardcode-removal-preprod-recap
status: done
tags: [recap, pepis_ap, ccps, login, announcement, hardcode, preprod]
source_paths:
  - C:/Users/7010/Desktop/Project/pepis_ap/src/main/java/com/tradevan/pccps/web/restful/SecurityController.java
  - C:/Users/7010/Desktop/Project/pepis_ap/src/test/java/com/tradevan/pccps/web/restful/SecurityControllerAnnouncementTest.java
  - C:/Users/7010/Desktop/Project/tv-isso-api/src/main/java/com/tradevan/isso/ext/ApContext.java
summary: PEPIS login page announcement no longer hardcodes appId; announcement lookup user uses company extId plus issoadm, with ADMIN_BAN/fallback extId remaining as the pre-release check point.
---

# PEPIS 登入頁公告寫死值移除上線前 Recap

## 這次 session 要解的問題

登入頁公告 `/rest/auth/announcements` 原本有兩個上線風險：

1. 公告查詢的 `appId` 曾經用固定值，例如 `EPIS` 或早期 `pepis`。
2. 公告查詢 user 曾經容易帶到登入者帳號，例如 log 看到 `customId=TEST_PAYEE`，導致 `getAPPAnnouncement(appId, user)` 查詢語意不穩。

本次 session 的目標是把公告來源改成 runtime/context 決定，避免靠本機測試用寫死值撐住。

## 已完成調整

- `SecurityController.resolveLoginPageAnnouncementAppId()` 現在回傳 `ApContext.getApplicationId()`。
- `tv-isso-api` 的 `ApContext.getApplicationId()` 來源是 `FrameworkContext.getContext().getApplicationId()`，所以 appId 會跟部署環境的 framework application id 走。
- `queryLoginPageAnnouncements(...)` 會用 `resolveLoginPageAnnouncementAppId()` 得到 appId，再呼叫 `announcementService.getAPPAnnouncement(appId, announcementUser)`。
- `resolveAnnouncementUser(...)` 不再直接拿登入者 `customId` 當公告查詢帳號。
- 若可從 `SaabContext.currentUser()` 或 session `__saab_user` 取得使用者，會取該使用者的公司統編 `extId`，再建立公告查詢 user。
- 公告查詢 user 會固定使用 `issoadm` 作為 `customId`，形成 `N_<extId>_issoadm`，例如 `N_12345678_issoadm`。
- 若沒有 request/session user，才走 fallback user。

## 目前仍保留的 fallback

`SecurityController` 目前仍有：

- `ANNOUNCEMENT_FALLBACK_EXT_ID_SETTING = "ADMIN_BAN"`
- `ANNOUNCEMENT_DEFAULT_EXT_ID = "97162640"`

實際流程是先讀 `ApContext.getContext().getSetting("ADMIN_BAN")`，有值就用設定；讀不到或空值才退回 `97162640`。

所以「公告 appId 寫死值」已移除；「fallback 統編預設值」仍存在，但已被設定檔 `ADMIN_BAN` 包住。上線前要確認各環境 `application.xml` 的 `ADMIN_BAN` 正確，避免落到 Java 預設值。

## 上線前檢查清單

- 確認部署環境 framework application id 回傳為預期值，通常 log 應看到 `appId=EPIS`。
- 確認 `src/main/resources/env/*/conf/application.xml` 對應環境都有正確 `ADMIN_BAN`。
- 登入後打 `/APEPIS/rest/auth/announcements`，觀察 log：`query via getAPPAnnouncement appId=..., extId=..., customId=issoadm`。
- 若登入者統編存在，`extId` 應是登入公司統編，不應是帳號或空值。
- 若沒有 session user，才應看到 fallback 統編。
- DB 端確認 `ISSO_ANNOUNCEMENT` 有符合 `APP_ID`、`ORG_ID in ('*', extId)`、`PRIORITY in ('H','N')`、日期區間的資料。

## 當時驗證紀錄

- 針對 appId 動態化，當時用 JUnitCore 跑過 `SecurityControllerAnnouncementTest`，結果 `OK (4 tests)`。
- 後續補上 fallback lookup user 後，測試涵蓋：
  - appId 使用 `ApContext.getApplicationId()`。
  - session user 統編 `12345678` 會變成 `N_12345678_issoadm`。
  - 無 session user 時 fallback 為 `N_97162640_issoadm`。
  - `queryLoginPageAnnouncements(...)` 傳給 `getAPPAnnouncement(...)` 的 appId/user 正確。
- 本次 recap 回查目前原始碼確認上述設計仍存在；本次沒有重新跑 Maven 測試。

## 關鍵檔案

- `src/main/java/com/tradevan/pccps/web/restful/SecurityController.java`
  - `resolveAnnouncementUser(...)`
  - `queryLoginPageAnnouncements(...)`
  - `resolveLoginPageAnnouncementAppId()`
  - `createAnnouncementLookupUser(...)`
  - `resolveFallbackAnnouncementExtId()`
- `src/test/java/com/tradevan/pccps/web/restful/SecurityControllerAnnouncementTest.java`
- `../tv-isso-api/src/main/java/com/tradevan/isso/ext/ApContext.java`

## 給下一位 agent 的判斷

這段上線前重點不是再把 `EPIS` 寫回去，而是確認 runtime application id 與 `ADMIN_BAN` 設定。若正式環境公告查不到，優先看 log 的 `appId/extId/customId`，再回 DB 查 `ISSO_ANNOUNCEMENT` 的 `APP_ID/ORG_ID/PRIORITY/日期`，不要先改前端或改 Login.vue。
