---
type: session-recap
date: 2026-05-22
project: PEPIS
system: PEPIS
repo: pepis_ap
topic: pepis-login-announcement-priority-display
status: verified-local
tags: [recap, PEPIS, pepis_ap, announcement, login-page, priority]
source_paths:
  - C:/Users/7010/Desktop/Project/pepis_ap/src/main/java/com/tradevan/pccps/web/restful/SecurityController.java
  - C:/Users/7010/Desktop/Project/pepis_ap/view/CCPS/src/views/Login.vue
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/java/com/tradevan/isso/admin/action/AnnouncementAction.java
  - C:/Users/7010/Desktop/gravityTest/pisso_ap/src/main/java/com/tradevan/isso/admin/model/AnnouncementModel.java
summary: 本次追完 PEPIS 登入頁公告來源，確認 PISSO 維護寫入 ISSO_ANNOUNCEMENT，並已補上查詢參數 log 與前端 priority 顯示樣式。
---

# Session Recap: PEPIS 登入頁公告 priority 顯示

> 日期：2026-05-22
> 專案：PEPIS
> AI：Codex

## 觸發與背景

- 使用者在測 PISSO 公告維護，想確認「新增公告」實際寫入哪張 table，以及為什麼 PEPIS 登入頁一開始查不到公告。
- 測試畫面送出的公告 payload 包含：
  - `announcementDo.appId=EPIS`
  - `announcementDo.orgId=*`
  - `announcementDo.priority=N`
  - `announcementDo.content=20260522公告測試`
  - `announcementVo.isHighlight=true`
- 使用者後來在測試 DB 補入符合條件的資料後，PEPIS 登入頁公告已可顯示，因此接著調整前端公告呈現方式。

## 結論

- PISSO 公告維護新增資料寫入 `ISSO_ANNOUNCEMENT`。
- PEPIS 登入頁公告查詢走 `AnnouncementService.getAPPAnnouncement(appId, ISSOUser)`，實際 table 條件是 `APP_ID + ORG_ID + PRIORITY`。
- 目前 PEPIS 前端應優先依 `priority` 做顯示差異，不是依 `isHighlight`，因為後端 `AnnouncementVo` 目前有回 `priority`，但尚未回 `isHighlight`。
- 前端已調整為：
  - `priority=H`：顯示「重要」標籤、淡橘底色、左側色條。
  - `priority=N`：維持一般公告樣式。
  - `priority=T`：保留「置頂」顯示樣式，作為未來資料可能回傳時的防線。

## 證據與流程

- PISSO 新增公告流程：
  - `pages/announcement/added.jsp` submit 到 `Announcement!insert`。
  - `AnnouncementAction.insert()` 設定 `BUILD_DATE`、處理 upload，接著呼叫 `service.insert(announcementDo, buffer)`。
  - `AnnouncementService.insert()` 委派到 `AnnouncementModel.insert()`。
  - `AnnouncementModel.TABLE_NAME = "ISSO_ANNOUNCEMENT"`，insert path 使用 `session.insert(object)`。
- `ISSO_ANNOUNCEMENT` 重要欄位：
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
- PEPIS 登入頁公告查詢流程：
  - 前端 `view/CCPS/src/views/Login.vue` 呼叫 `/rest/auth/announcements`。
  - `SecurityController.queryLoginPageAnnouncements(...)` 解析公告查詢用 user 與 runtime `appId`。
  - 接著呼叫 `announcementService.getAPPAnnouncement(appId, announcementUser)`。
  - 觀察到 SQL 型態為：`SELECT * FROM ISSO_ANNOUNCEMENT WHERE APP_ID = ? AND ORG_ID = ? AND PRIORITY = ? ORDER BY BUILD_DATE DESC`。
  - `getAPPAnnouncement(...)` 會依序查四組條件：全域 org 高優先、全域 org 一般、使用者 org 高優先、使用者 org 一般。

## 已做變更

- `SecurityController.java`
  - 在呼叫 `getAPPAnnouncement(...)` 前新增 `logLoginPageAnnouncementQueryParams(appId, announcementUser)`。
  - 每次查詢前印出四組實際參數：
    - `APP_ID=<runtime appId>, ORG_ID=*, PRIORITY=H`
    - `APP_ID=<runtime appId>, ORG_ID=*, PRIORITY=N`
    - `APP_ID=<runtime appId>, ORG_ID=<userExtId>, PRIORITY=H`
    - `APP_ID=<runtime appId>, ORG_ID=<userExtId>, PRIORITY=N`
- `Login.vue`
  - 新增 priority 正規化與判斷方法：`normalizedAnnouncementPriority`、`isImportantAnnouncement`、`isTopAnnouncement`、`announcementPriorityLabel`、`announcementPriorityClass`。
  - 公告列依 priority 加上對應 class。
  - 公告標題旁新增 compact badge。
  - 補上「重要 / 置頂」badge 與 row highlight CSS。

## 驗證

- 後端 compile：
  - 在 `C:/Users/7010/Desktop/Project/pepis_ap` 執行 `mvn -q -DskipTests compile`。
  - 結果：通過。
- 前端 build：
  - 在 `C:/Users/7010/Desktop/Project/pepis_ap/view/CCPS` 執行 `npm run build`。
  - 結果：通過。
  - 只出現既有 Vue/Vuetify/Sass asset size 與 deprecated warning，沒有 template 或編譯錯誤。
- Runtime DB check：
  - 使用者在測試 DB 補入資料後，確認公告已能顯示。

## 下一步

- [ ] 若業務希望 PISSO 的 `isHighlight=true` 也影響 PEPIS 登入頁，需要後端把 `IS_HIGHLIGHT` 加到 `AnnouncementVo`，並定義 `isHighlight` 與 `priority` 的優先順序。
- [ ] 若確認 `getAPPAnnouncement(...)` 永遠不會回 `priority=T`，可保留目前前端防線，或在確認 tv-isso contract 後移除 `T` 樣式。
- [ ] 若要提交版本，先檢查 `npm run build` 產生的 `src/main/webapp/CCPS` hashed build artifacts，避免混入不想提交的舊產物刪除/新增。

## 注意事項

- 要分清楚 session identity 與公告 lookup identity。log 可能看到登入 session user，但 `getAPPAnnouncement(...)` 實際可能使用 fallback lookup user，例如 `issoadm` 與 ext id `97162640`。
- 登入頁公告測試可用 `/login?force=1&announcementPosition=right` 或其他 `announcementPosition` 參數調整版位。
- 這份 recap 已在 2026-05-22 修正為繁體中文；先前版本誤用了英文正文，原因是我只套用 recap template 形狀，漏掉 `user_rules.md` 的文件語言硬規則。

---

*依 [[pixiu-session-recap]] 與 [[recap-standard]] 產出。*
