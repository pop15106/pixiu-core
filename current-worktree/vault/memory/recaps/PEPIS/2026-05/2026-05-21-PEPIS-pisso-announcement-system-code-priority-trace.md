---
type: session-recap
date: 2026-05-21
project: PEPIS
system: PEPIS
repo: pepis_ap+pisso_ap
topic: pepis-pisso-announcement-system-code-priority-trace
status: verified-local
tags: [recap, pepis, pisso, announcements, login]
source_paths:
  - C:/Users/7010/Desktop/Project/pepis_ap/src/main/java/com/tradevan/pccps/web/restful/SecurityController.java
  - C:/Users/7010/Desktop/Project/pepis_ap/src/main/resources/env/pro/conf/application.xml
  - C:/Users/7010/Desktop/Project/tv-isso-api/src/main/java/com/tradevan/isso/ext/service/AnnouncementService.java
  - C:/Users/7010/Desktop/Project/tv-isso-api/src/main/java/com/tradevan/isso/ext/bean/IssoAnnouncementDO.java
  - C:/Users/7010/Desktop/Project/tv-isso-api/src/main/java/com/tradevan/isso/ext/model/IssoAnnouncementModel.java
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/java/com/tradevan/isso/action/AnnouncementAction.java
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/java/com/tradevan/isso/service/AnnouncementService.java
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/java/com/tradevan/isso/action/LoginAction.java
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/java/com/tradevan/isso/action/AppAction.java
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/webapp/pages/announcement/query.jsp
summary: PISSO_AP 公告維護畫面可查 T 優先序，但 PEPIS 新登入頁公告來源是 tv-isso-api getAPPAnnouncement("EPIS", user)，只會查 H/N，不會查 T。
---

# Session Recap: PEPIS / PISSO 公告系統代碼與 T 優先序追查

> Date: 2026-05-21
> Project: PEPIS
> AI: Codex

## Trigger And Context

- 使用者要整理截圖中 PISSO_AP「公告維護」的系統代碼來源、查詢條件與限制，目的是判斷新 PEPIS 登入頁公告資料要怎麼塞。
- 先前已確認 PEPIS 新登入頁前端呼叫 `/rest/auth/announcements`，後端在 `SecurityController` 使用 `tv-isso-api` 的 `AnnouncementService.getAPPAnnouncement(appId, user)`。
- 使用者提醒目前工作區另有 `pisso_ap` 專案資料夾，因此補追 PISSO_AP 維護畫面與舊登入公告路徑。

## Conclusion

- PISSO_AP 的公告維護畫面會顯示並查詢 `T` 優先序；若優先順序選「全部」，查詢條件會包含 `N/H/T`。
- PISSO_AP 維護畫面的系統代碼來源不是固定只有目前系統：`AnnouncementAction.getUserAppList()` 會先固定加入 `TDIS`，再加入目前管理者可維護的 app 清單。
- 但 PEPIS 新登入頁目前不走 `T`：它使用 `getAPPAnnouncement("EPIS", user)`，該 API 只查 `PRIORITY in ('H', 'N')`，且 `ORG_ID` 只查 `*` 與使用者 `extId`。
- 因此要讓 PEPIS 新登入頁顯示公告，資料應塞：`APP_ID=EPIS`、`PRIORITY=H` 或 `N`、`ORG_ID=*` 或目標使用者 `extId`。塞 `APP_ID=EPIS, PRIORITY=T` 會在 PISSO_AP 維護畫面查得到，但 PEPIS 新登入頁不會顯示。
- `T` 目前主要是 PISSO / ISSO 登入公告線路使用，該線路走 `getLoginAnnouncement(...)`，查 `APP_ID=TDIS` 與 `PRIORITY=T`。

## Evidence Or Flow

- PEPIS 新登入頁：
  - `view/CCPS/src/views/Login.vue` 呼叫 `/rest/auth/announcements`。
  - `SecurityController.announcements()` 建立 `com.tradevan.isso.ext.service.AnnouncementService`。
  - `queryLoginPageAnnouncements(...)` 呼叫 `announcementService.getAPPAnnouncement(appId, announcementUser)`。
  - `resolveLoginPageAnnouncementAppId()` 回傳 `ApContext.getApplicationId()`。
  - `application.xml` 的 `<application id="EPIS">` 使 PEPIS 端 appId 解析為 `EPIS`。
- tv-isso-api：
  - `IssoAnnouncementDO` 定義 `APP_ID_TDIS="TDIS"`、`ORG_ID_ALL="*"`、`PRIORITY_TOP="T"`、`PRIORITY_HIGH="H"`、`PRIORITY_NORMAL="N"`。
  - `AnnouncementService.getAPPAnnouncement(String appId, ISSOUser user)` 只組四組條件：
    - `APP_ID=appId, ORG_ID=*, PRIORITY=H`
    - `APP_ID=appId, ORG_ID=*, PRIORITY=N`
    - `APP_ID=appId, ORG_ID=user.extId, PRIORITY=H`
    - `APP_ID=appId, ORG_ID=user.extId, PRIORITY=N`
  - `getAPPAnnouncement(...)` 不查 `T`。
  - `getLoginAnnouncement(...)` 才查 `APP_ID=TDIS`、`ORG_ID=*` 或指定 org、`PRIORITY=T`，並可加 `IS_HIGHLIGHT=Y`。
- PISSO_AP 維護畫面：
  - `pages/announcement/query.jsp` 的系統代碼欄位綁 `announcementVo.appId` 與 `userAppList`。
  - `AnnouncementAction.getUserAppList()` 先加入 `TDIS`，再加入管理者可維護 app。
  - `AnnouncementAction.getPriorities()` 將 `N/H/T` 都放入下拉選單。
  - `AnnouncementAction.query()` 在欄位選「全部」時，會把可選 app、org、priority 全部展開成 `IN` 條件。
  - `com.tradevan.isso.service.AnnouncementService.query(...)` 對 `ISSO_ANNOUNCEMENT` 加上 `APP_ID in (...)`、`ORG_ID in (...)`、`PRIORITY in (...)`、`BUILD_DATE` 區間、`CONTENT like`、`IS_HIGHLIGHT=Y` 等條件。
- PISSO_AP 消費端：
  - `LoginAction.getLoginAnnouncement()` / `NLoginAction` / `SamlLoginAction` / `FDXSamlLoginAction` 走 login announcement 線路，會查 `T`。
  - `AppAction.getAnnouncement()` 走 `getAPPAnnouncement(defaultApplication, user)`，屬於登入後或系統公告線路，只查 `H/N`。

## Changes Made

- 沒有修改 repo 程式碼。
- 新增本 recap 作為後續塞資料與判斷公告來源的 handoff artifact。

## Verification

- 已確認 PISSO_AP 實體路徑為 `C:/Users/7010/Desktop/gravityTest/pisso_ap`。
- 已比對 PixiuCore recap SOP 與 template，frontmatter 保留 `type/date/project/system/repo/topic/status/tags/source_paths/summary`。
- 已用 repo 檔案交叉確認 PEPIS、tv-isso-api、PISSO_AP 三條線的公告查詢條件。

## Next Steps

- [ ] 若要讓 PEPIS 新登入頁也吃 `T`，需要修改 PEPIS 端公告 API 呼叫邏輯，或在 `tv-isso-api` 增加新的 app login announcement API；不建議直接改共用 `getAPPAnnouncement(...)` 行為，避免影響其他系統。
- [ ] 實際塞資料時，用 PISSO_AP 維護畫面或 DB 對 `ISSO_ANNOUNCEMENT` 建立 `APP_ID=EPIS, PRIORITY=H/N` 的資料，再從 PEPIS `/rest/auth/announcements` 驗證回傳。

## Notes

- 這次重點是區分「PISSO_AP 維護畫面查得到」與「PEPIS 新登入頁會不會顯示」。維護畫面可查 `T` 不代表 PEPIS 新登入頁會取 `T`。

---

*Generated from [[pixiu-session-recap]] and [[recap-standard]].*
