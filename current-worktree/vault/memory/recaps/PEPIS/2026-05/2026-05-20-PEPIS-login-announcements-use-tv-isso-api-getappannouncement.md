---
type: session-recap
date: 2026-05-20
project: PEPIS
system: PEPIS
repo: pepis_ap
topic: pepis-login-announcements-use-tv-isso-api-getappannouncement
status: verified-local
tags: [recap, pepis, announcements]
source_paths:
  - C:/Users/7010/Desktop/Project/pepis_ap/src/main/java/com/tradevan/pccps/web/restful/SecurityController.java
  - C:/Users/7010/Desktop/Project/pepis_ap/src/test/java/com/tradevan/pccps/web/restful/SecurityControllerAnnouncementTest.java
  - C:/Users/7010/Desktop/Project/tv-isso-api/src/main/java/com/tradevan/isso/ext/service/AnnouncementService.java
  - C:/Users/7010/Desktop/Project/tv-isso-api/src/main/java/com/tradevan/isso/ext/model/IssoAnnouncementModel.java
summary: pepis_ap 登入頁公告已改走 tv-isso-api 的 getAPPAnnouncement("EPIS", user)，對齊 ISSO 既有四組 H/N 公告查詢規則，不再自行手寫 PEPIS 專屬 SQL。
---

# 會話回顧：pepis_ap 登入頁公告改用 tv-isso-api getAPPAnnouncement

> 日期：2026-05-20 16:56
> 專案：PEPIS
> AI: Codex

## 觸發背景

- 使用者要求重新檢查 `ISSO_ANNOUNCEMENT` 在 `tv-isso-api` 與 `pepis_ap` 的實際查詢路徑。
- 前一輪 `pepis_ap` 登入頁公告採用手寫查詢條件，方向是 `APP_ID=EPIS`、`ORG_ID=* / 97162640`、`PRIORITY=T`，但現場仍查不到資料。
- 這輪改成對齊 `tv-isso-api` 既有 API：`AnnouncementService.getAPPAnnouncement(String appId, ISSOUser user)`，讓登入頁公告沿用 ISSO 的正式查詢 contract。

## 結論

- `pepis_ap` 的 `GET /auth/announcements` 已改走 `AnnouncementService.getAPPAnnouncement("EPIS", user)`。
- 新邏輯不再手寫 `TOP/T` 公告查詢，而是使用 `tv-isso-api` 內建的 app announcement 規則。
- `getAPPAnnouncement(...)` 會查四組條件：`appId=EPIS`、`orgId in ('*', user.getExtId())`、`priority in ('H', 'N')`，並依 `BUILD_DATE DESC` 排序。
- PEPIS 端仍會把 `AnnouncementVo` 轉成前端 DTO；`title` 暫以 `CONTENT` 前段文字承接，`publishDate` 使用 `BUILD_DATE`。

## 證據與流程

- `pepis_ap` 入口：`SecurityController.announcements()` 會呼叫 `queryLoginPageAnnouncements(announcementService)`。
- `queryLoginPageAnnouncements(...)` 建立臨時公告 user：
  - `appId = EPIS`
  - `customId = ISSOUser.USER_ISSO_ADM`
  - `extId = 97162640`
- 實際呼叫：`announcementService.getAPPAnnouncement(LOGIN_PAGE_ANNOUNCEMENT_APP_ID, announcementUser)`。
- `tv-isso-api` contract：
  - `AnnouncementService.getAPPAnnouncement(String appId, ISSOUser user)`
  - 內部呼叫四次 `getAnnouncement(cond)`
  - `APP_ID = appId, ORG_ID = '*', PRIORITY = 'H'`
  - `APP_ID = appId, ORG_ID = '*', PRIORITY = 'N'`
  - `APP_ID = appId, ORG_ID = user.getExtId(), PRIORITY = 'H'`
  - `APP_ID = appId, ORG_ID = user.getExtId(), PRIORITY = 'N'`
  - 最後由 `IssoAnnouncementModel.getAnnouncement(...)` 查 `ISSO_ANNOUNCEMENT`

## 已修改內容

- 更新 `pepis_ap/src/main/java/com/tradevan/pccps/web/restful/SecurityController.java`。
- 將 `announcements()` 的 helper 從 `queryLoginPageTopAnnouncements(...)` 改成 `queryLoginPageAnnouncements(...)`。
- 移除 PEPIS 端自行組 `TOP` 查詢條件的 helper，改成直接呼叫 `getAPPAnnouncement(...)`。
- 保留臨時公告 user 的建立邏輯，並留下 `97162640` context，後續仍需改成正式登入使用者解析。
- 更新 `pepis_ap/src/test/java/com/tradevan/pccps/web/restful/SecurityControllerAnnouncementTest.java`。
- 測試改為驗證 `queryLoginPageAnnouncements(...)` 會呼叫 `getAPPAnnouncement("EPIS", user)`，而不是自行送 `TOP` condition。

## 驗證

- `mvn -q -Dtest=SecurityControllerAnnouncementTest test`
  - exit code `0`
  - stdout 仍有 `Access is denied.`，但 surefire report 顯示測試有跑完；判斷是 Maven 或 sandbox 輸出層訊息，不是 Java 測試失敗。
- `mvn -q -DskipTests test-compile`
  - exit code `0`
  - stdout 仍可見 `Access is denied.`
- `mvn -q -Dtest=SecurityControllerAnnouncementTest clean test`
  - 失敗點在 `target/tomcat/logs/access_log.2026-05-20` 權限與 clean 階段，不是公告 API 程式邏輯。
- code diff 已確認 helper 與測試都改到目標路徑：
  - `SecurityController.queryLoginPageAnnouncements(...)` 會呼叫 `getAPPAnnouncement(...)`
  - 測試 double 改為 override `getAPPAnnouncement(...)`

## 下一步

- [ ] 將臨時 `extId = 97162640` 改成正式登入使用者解析；優先從 `SaabContext` 或 session `__saab_user` 取得目前使用者。
- [ ] 若要重跑 clean test，先處理 `target/tomcat/logs/access_log.2026-05-20` 權限或刪除鎖定來源。
- [ ] 與使用者確認登入頁公告是否應該使用 `H/N` 的 app announcement 規則；若業務真的要 `T` 頂端公告，需另開一條明確規格，而不是混在 `getAPPAnnouncement(...)` 內。

## 備註

- 這輪的重點是讓 `pepis_ap` 回到 `tv-isso-api` 的 API contract，不再維護 PEPIS 端自寫 SQL。
- `tv-isso-api` 的 `getAPPAnnouncement(...)` 本身不是 `TOP/T` 查詢；它查的是 `H/N`。若使用者要的是登入頁「頂端公告」，仍需要釐清 `T` 與 `H/N` 在 ISSO 的業務語意差異。

---

*依 [[pixiu-session-recap]] 與 [[recap-standard]] 整理。*
