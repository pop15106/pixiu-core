---
type: session-recap
date: 2026-05-21
project: PISSO
system: PISSO
repo: pisso_ap
topic: pisso-system-code-source-sql-trace
status: verified-local
tags: [recap, pisso, pisso_ap, saab, system-code, sql]
source_paths:
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/resources/conf/saab/saab_api_sql.xml
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/resources/conf/saab/saab_context.xml
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/resources/conf/application.xml
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/java/com/tradevan/isso/action/AnnouncementAction.java
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/webapp/pages/announcement/query.jsp
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/java/com/tradevan/isso/action/LoginAction.java
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/java/com/tradevan/isso/rest/appService.java
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/java/com/tradevan/isso/rest/model/AppSysModel.java
summary: PISSO 後台畫面上的系統代碼來自 SAAB_APPLICATION 與使用者權限關聯表的 APP_ID union，不是 conf/application.xml 的 ISSO framework id；另有 APP_SYS 供 /appService/getAppList 使用。
---

# Session Recap: PISSO 系統代碼資料來源與 SQL 追查

> Date: 2026-05-21 16:00
> Project: PISSO
> AI: Codex

## Trigger And Context

- 使用者原先問 `pisso_ap` 裡面的系統代碼資料來源與查法；中途明確要求先不要看 `pepis_ap`，改聚焦 `pisso_ap`。
- 本次定位的 repo 是 `C:/Users/7010/Desktop/gravityTest/pisso_ap`。
- 使用者後續要求提供完整 SQL，已回覆 `SaabApplicationModel.getUserApps` 與 `getUserOrgApps` 兩段 SQL。

## Conclusion

- `pisso_ap` 內要分清兩種代碼：
  - `conf/application.xml` 的 `<application id="ISSO">` 與 `<application id="SAAB_EXT">` 是 framework / runtime app id。
  - 後台畫面上的「系統代碼 / 應用系統」下拉主要來自 SAAB 權限資料：`SAAB_APPLICATION` 以及使用者在 `SAAB_USER_PRIVILEGE`、`SAAB_USER_ROLE`、`SAAB_USER_ORGANIZATION`、`SAAB_ORG_ROLE`、`SAAB_ORG_PRIVILEGE` 取得的 `APP_ID`。
- `AnnouncementAction.getUserAppList()` 會額外手動加入 `TDIS`，再呼叫 `SaabApplicationModel.getUserApps(...)` 查使用者可見 application。
- 另有一條 REST `/appService/getAppList` 走 `APP_SYS`，欄位是 `SYS_CODE/SYS_NAME/FUNC_CODE/FUNC_NAME/URL/PUSH_STATUS`；這是另一個 APP 功能清單來源，不是 announcement 後台的 SAAB application 下拉。

## Evidence Or Flow

- UI 下拉：`src/main/webapp/pages/announcement/query.jsp`
  - `<s:select name="announcementVo.appId" id="appId" list="userAppList" listKey="appId" listValue="%{'[' +appId + ']' + CName }">`
- Action：`src/main/java/com/tradevan/isso/action/AnnouncementAction.java`
  - `getUserAppList()` 建立 `userAppList`。
  - 先手動加入 `IssoAnnouncementDO.APP_ID_TDIS`。
  - 再用 `ApContext.getModelManager().getApplicationModel()` 取得 `SaabApplicationModel`。
  - 呼叫 `appModel.getUserApps(ISSOUser.getDefaultId(user.getExtId(), ISSOUser.USER_ISSO_ADM))`。
- SAAB model binding：`src/main/resources/conf/saab/saab_context.xml`
  - `SaabApplicationModel` 綁 `ApplicationModelImpl`。
  - `tableName` 是 `application`。
  - `table_prefix` 是 `SAAB_`，因此實表是 `SAAB_APPLICATION`。
- SQL template：`src/main/resources/conf/saab/saab_api_sql.xml`
  - `PREFIX` template 是 `SAAB_`。
  - `SaabApplicationModel.getUserApps` 透過四條權限來源 union 出 `app_id`，再 join `SAAB_APPLICATION`。

## SQL

### SaabApplicationModel.getUserApps

```sql
SELECT *
FROM (
    SELECT DISTINCT app_id
    FROM SAAB_user_privilege
    WHERE user_id = ${USER_ID}

    UNION

    SELECT DISTINCT app_id
    FROM SAAB_user_role
    WHERE user_id = ${USER_ID}

    UNION

    SELECT DISTINCT app_id
    FROM SAAB_user_organization uo, SAAB_org_role r
    WHERE user_id = ${USER_ID}
      AND uo.ORG_ID = r.ORG_ID

    UNION

    SELECT DISTINCT app_id
    FROM SAAB_user_organization uo, SAAB_org_privilege r
    WHERE user_id = ${USER_ID}
      AND uo.ORG_ID = r.ORG_ID
) a,
SAAB_APPLICATION b
WHERE a.app_id = b.app_id
ORDER BY b.app_id;
```

### SaabApplicationModel.getUserOrgApps

```sql
SELECT *
FROM (
    SELECT DISTINCT app_id
    FROM SAAB_user_organization uo, SAAB_org_role r
    WHERE user_id = ${USER_ID}
      AND uo.ORG_ID = r.ORG_ID
) a,
SAAB_APPLICATION b
WHERE a.app_id = b.app_id
ORDER BY b.app_id;
```

### REST APP_SYS route

```sql
SELECT *
FROM APP_SYS
ORDER BY SYS_CODE;
```

- 來源：`AppSysModel.getAPPList()`。
- API：`GET /appService/getAppList`。

## Changes Made

- No repo code was changed.
- Wrote this recap into PixiuCore vault for future handoff.

## Verification

- Confirmed `pisso_ap` exists at `C:/Users/7010/Desktop/gravityTest/pisso_ap`.
- Read the relevant source files directly:
  - `conf/application.xml`
  - `conf/saab/saab_context.xml`
  - `conf/saab/saab_api_sql.xml`
  - `AnnouncementAction.java`
  - `query.jsp`
  - `LoginAction.java`
  - `appService.java`
  - `AppSysModel.java`
- Verified the SQL text from `saab_api_sql.xml`, then expanded `#{PREFIX}` to `SAAB_` for readability.

## Next Steps

- [ ] 若要查某個登入帳號實際看到哪些系統代碼，用該帳號的完整 `USER_ID` 代入 `${USER_ID}` 跑 `SaabApplicationModel.getUserApps` SQL。
- [ ] 若要查畫面某個系統代碼名稱或 URL，直接查 `SAAB_APPLICATION` 的對應 `APP_ID`。
- [ ] 若題目是手機/推播 APP 清單，改查 `APP_SYS`，不要跟 SAAB application 下拉混用。

## Notes

- 本次答案特意排除 `pepis_ap` 線路，只保留 `pisso_ap` source truth。
- `application.appId` 的中文 label 在 properties 中是「系統代碼」，但畫面資料流仍是 SAAB application model。

---

*Generated from [[pixiu-session-recap]] and [[recap-standard]].*
