---
type: session-recap
date: 2026-05-20
project: PEPIS
system: PEPIS
repo: pepis_ap
topic: pepis-login-announcement-empty-result
status: follow-up
tags: [recap, pepis_ap, pepis, login, announcement, isso, empty-result]
source_paths:
  - C:/Users/7010/Desktop/Project/pepis_ap/src/main/java/com/tradevan/pccps/web/restful/SecurityController.java
  - C:/Users/7010/Desktop/Project/pepis_ap/src/test/java/com/tradevan/pccps/web/restful/SecurityControllerAnnouncementTest.java
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/java/com/tradevan/isso/action/AnnouncementAction.java
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/java/com/tradevan/isso/service/AnnouncementService.java
  - C:/Users/7010/Desktop/gravityTest/psaab/src/main/resources/conf/saab/saab_system_sql.xml
  - C:/Users/7010/Desktop/Project/tv-isso-api/src/main/java/com/tradevan/isso/ext/service/AnnouncementService.java
summary: pepis_ap 登入頁公告已改查 EPIS 來源，但目前 API 對 ISSO_ANNOUNCEMENT 查詢仍回 0 筆；下一步要回 DB 確認 APP_ID、ORG_ID、PRIORITY 與有效日期條件。
---

# 會話回顧：PEPIS 登入頁公告查無資料

> 日期：2026-05-20 16:15
> 專案：PEPIS
> AI: Codex

## 觸發背景

- 這輪追查 `pepis_ap` 登入頁公告來源，並對照 `psaab`、`pisso_ap`、`tv-isso-api-doc`、`tv-isso-api` 的公告查詢流程。
- 使用者要確認登入頁公告應該看 `PEPIS/EPIS` 哪一個 app id，以及是否能用 `issoadm` 身分取得資料。
- 現場呼叫 `/APEPIS/rest/auth/announcements` 後，log 顯示對 `ISSO_ANNOUNCEMENT` 的查詢結果仍是 0 筆。

## 目前狀態

- 前端登入頁會呼叫 `GET /APEPIS/rest/auth/announcements`。
- 後端入口是 `SecurityController.announcements()`。
- 這輪先讓後端改查登入頁頂端公告條件：`APP_ID = EPIS`、`PRIORITY = T`、`ORG_ID = *` 或 `97162640`。
- 已加入 `[LoginPageAnnouncement]` log，用來輸出 `appId`、`orgId`、`priority`、raw query size 與 filtered size。
- 使用者提供的 runtime log 顯示兩次查詢都回 `DataList size: 0`，包含 `EPIS/*/T` 與 `EPIS/97162640/T`。

## 證據與流程

### pepis_ap 登入頁公告 API flow

```text
Login.vue
-> GET /APEPIS/rest/auth/announcements
-> SecurityController.announcements()
-> SecurityController.queryLoginPageTopAnnouncements()
-> tv-isso-api AnnouncementService.getAnnouncement(cond)
-> tv-isso-api IssoAnnouncementModel.getAnnouncement(cond)
-> DB ISSO_ANNOUNCEMENT
```

目前 API 對應 SQL：

```sql
SELECT *
FROM ISSO_ANNOUNCEMENT
WHERE APP_ID = 'EPIS'
  AND ORG_ID = '*'
  AND PRIORITY = 'T'
ORDER BY BUILD_DATE DESC;
```

```sql
SELECT *
FROM ISSO_ANNOUNCEMENT
WHERE APP_ID = 'EPIS'
  AND ORG_ID = '97162640'
  AND PRIORITY = 'T'
ORDER BY BUILD_DATE DESC;
```

### pisso_ap 公告管理查詢 flow

```text
/pages/announcement/query.jsp
-> Announcement!query
-> AnnouncementAction.query()
-> com.tradevan.isso.service.AnnouncementService.query()
-> com.tradevan.isso.model.AnnouncementModel
-> DB ISSO_ANNOUNCEMENT
```

`pisso_ap` 公告管理的查詢條件來源：

- JSP 欄位：`announcementVo.appId`
- app 清單：`userAppList`
- `AnnouncementAction.getUserAppList()` 會排除 `TDIS`，並透過 `SaabApplicationModel.getUserApps(ISSOUser.getDefaultId(user.getExtId(), ISSOUser.USER_ISSO_ADM))` 取得 `N_<extId>_issoadm` 可使用的 app。
- `getUserApps(...)` 的 SQL 會從 `SAAB_USER_PRIVILEGE`、`SAAB_USER_ROLE`、`SAAB_USER_ORGANIZATION + SAAB_ORG_ROLE`、`SAAB_USER_ORGANIZATION + SAAB_ORG_PRIVILEGE` 推出 app，並 join `SAAB_APPLICATION`。

可用來比對的管理端查詢方向：

```sql
SELECT *
FROM ISSO_ANNOUNCEMENT
WHERE APP_ID IN ('TDIS', '<userAppList 可見的 APP_ID>')
  AND ORG_ID IN ('<userOrgList 可見的 ORG_ID>', '*')
  AND PRIORITY IN ('T', 'H', 'N')
ORDER BY BUILD_DATE DESC;
```

若要聚焦登入頁公告，可先縮小為：

```sql
SELECT *
FROM ISSO_ANNOUNCEMENT
WHERE APP_ID IN ('EPIS')
  AND ORG_ID IN ('<userOrgList 可見的 ORG_ID>', '*')
  AND PRIORITY IN ('T')
ORDER BY BUILD_DATE DESC;
```

## 已修改內容

- `SecurityController`：登入頁公告 app id 改為 `EPIS`。
- `SecurityController`：臨時公告 user 使用 `ISSOUser.USER_ISSO_ADM`，並設定 `extId = 97162640`。
- `SecurityController`：登入頁公告先走 `AnnouncementService.getAnnouncement(cond)` 搭配 `PRIORITY_TOP/T`，還沒切到 `getAPPAnnouncement(...)` 的 `H/N` app announcement contract。
- `SecurityController`：新增 `[LoginPageAnnouncement]` log，輸出 query params、raw query size、filtered size。
- `SecurityControllerAnnouncementTest`：補測 `EPIS`、`issoadm`、`ORG_ID=* / 97162640`、`PRIORITY=T` 的查詢行為。

## 驗證

- `mvn test-compile`：通過。
- 針對 `SecurityControllerAnnouncementTest` 的 JUnit 測試：`OK (3 tests)`。
- 注意：`pom.xml` 的 `maven-surefire-plugin` 設了 `<skipTests>true</skipTests>`，所以 `mvn test` 不會真的跑測試。
- log4j 嘗試寫入 `/PEPIS/logs/...` 時會有 access denied；這不是這輪公告 API 的主要失敗點。

## 現場症狀

使用者提供的 runtime log：

```text
Prepare SQL (timeout: 30) SELECT * FROM ISSO_ANNOUNCEMENT WHERE APP_ID = ? AND ORG_ID = ? AND PRIORITY = ? ORDER BY BUILD_DATE DESC
DataList size: 0
Prepare SQL (timeout: 30) SELECT * FROM ISSO_ANNOUNCEMENT WHERE APP_ID = ? AND ORG_ID = ? AND PRIORITY = ? ORDER BY BUILD_DATE DESC
DataList size: 0
```

對應到新增 log 應該會看到：

```text
[LoginPageAnnouncement] query params appId=EPIS, orgId=*, priority=T
[LoginPageAnnouncement] raw query result size=0, appId=EPIS, orgId=*, priority=T
[LoginPageAnnouncement] query params appId=EPIS, orgId=97162640, priority=T
[LoginPageAnnouncement] raw query result size=0, appId=EPIS, orgId=97162640, priority=T
[LoginPageAnnouncement] filtered query result size=0, appId=EPIS, orgIds=[*,97162640], priority=T
```

## 初步缺口

- 目前查詢條件已經落到 DB，但 DB 似乎沒有符合 `APP_ID='EPIS' AND ORG_ID IN ('*','97162640') AND PRIORITY='T'` 的資料。
- `pisso_ap` 公告管理頁的查詢條件不只看 `*` 或 `97162640`，還會吃 `userOrgList`。
- 需要確認公告管理頁實際建立的資料，是 `APP_ID=EPIS` 還是 `APP_ID=PEPIS`，以及 `PRIORITY` 是否真的是 `T`。

## 下一步

<!-- AI_INBOX_START -->
- [ ] 查 DB：`SELECT APP_ID, ORG_ID, PRIORITY, BUILD_DATE, START_DATE, END_DATE, CONTENT FROM ISSO_ANNOUNCEMENT WHERE APP_ID IN ('EPIS','PEPIS','TDIS') ORDER BY BUILD_DATE DESC`，確認實際公告資料使用哪個 app id。
- [ ] 查 DB：`SELECT APP_ID, ORG_ID, PRIORITY, BUILD_DATE, START_DATE, END_DATE, CONTENT FROM ISSO_ANNOUNCEMENT WHERE PRIORITY = 'T' ORDER BY BUILD_DATE DESC`，確認登入頁頂端公告是否真的使用 `T`。
- [ ] 確認資料的 `ORG_ID` 是否為 `*` 或 `97162640`；若不是，要回到 SAAB user org list 取得正式可見 org。
- [ ] 若資料其實是 `APP_ID=PEPIS`，再評估把 `LOGIN_PAGE_ANNOUNCEMENT_APP_ID` 從 `EPIS` 改成 `PEPIS`，並補測試。
- [ ] root cause 收斂後，移除或降級 `[LoginPageAnnouncement]` debug log，避免正式環境過度輸出。
<!-- AI_INBOX_END -->

## 備註

- 這份 recap 只保留當時 debug state，尚未代表正式 deploy 解法。
- `pisso_ap` 的 `AnnouncementAction.getUserAppList()` 顯示公告管理端的可見 app 不是硬編碼 enum，而是從 SAAB 權限資料推得。

---

*依 [[pixiu-session-recap]] 與 [[recap-standard]] 整理。*
