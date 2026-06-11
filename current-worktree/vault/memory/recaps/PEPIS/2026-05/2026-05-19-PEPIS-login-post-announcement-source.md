---
type: session-recap
date: 2026-05-19
project: PEPIS
system: PEPIS
repo: pepis_ap
topic: login-post-announcement-source
status: implemented
tags: [recap, pepis_ap, ccps, login, announcement, isso, application-id]
summary: pepis_ap 新登入頁公告 API 已從登入頁公告來源改為登入後 pepis 系統公告來源，並暫時以 ISSOUser extId 97162640 查詢。
---

# 2026-05-19 PEPIS 新登入頁登入後公告來源調整 Recap

## 背景

`pepis_ap` 新登入頁原本已經有公告區塊，前端呼叫 `/rest/auth/announcements` 取得公告資料。比對 `tv-isso-api-doc`、`tv-isso-api` 與 `psaab` 後，公告來源需要分清楚：

- 登入前公告：`AnnouncementService.getLoginAnnouncement()`。
- 登入後公告：`AnnouncementService.getAnnouncement(ISSOUser user)`。
- 系統別 / app 專用登入後公告：`AnnouncementService.getAPPAnnouncement(String appId, ISSOUser user)`。

本次需求已由使用者收斂為：

- `appId` 先固定為 `pepis`。
- `ISSOUser` 先暫時寫死 `extId = 97162640`。
- 現有公告 API 的註解從「登入頁公告」改成「登入後公告」。

## 實作內容

本次只調整公告來源與註解，不重構公告系統。

- `src/main/java/com/tradevan/pccps/web/restful/SecurityController.java`
  - 新增 `POST_LOGIN_ANNOUNCEMENT_APP_ID = "pepis"`。
  - 新增暫時 helper：`createTemporaryPostLoginAnnouncementUser()`。
  - 將 `/rest/auth/announcements` 的公告來源從 `getLoginAnnouncement()` 改為 `getAPPAnnouncement("pepis", temporaryUser)`。
  - 將錯誤 log 改為 `取得登入後公告失敗`。
  - 在程式註解中明確標出 `97162640` 是暫時寫死，後續需改為實際登入者 context。

- `src/main/java/com/tradevan/pccps/web/restful/RestResourcePath.java`
  - 將公告路由註解改為登入後公告語意。

- `src/main/java/com/tradevan/pccps/domain/common/codes/CcpsApiCodes.java`
  - 將 `AUTH_ANNOUNCEMENTS` 的文字與註解由登入頁公告改為登入後公告。
  - 因目前新登入頁仍會在尚未接上真實登入者 context 前載入公告，所以暫時保留 public API，並列為待討論。

- `view/CCPS/src/views/Login.vue`
  - 將前端註解改為「後端回傳登入後公告資訊」。

- `src/main/java/com/tradevan/pccps/web/restful/vo/AnnouncementVo.java`
- `src/main/java/com/tradevan/pccps/web/restful/vo/AnnouncementResponseVo.java`
  - 將類別註解由登入頁公告改為登入後公告。

- `src/test/java/com/tradevan/pccps/web/restful/SecurityControllerAnnouncementTest.java`
  - 新增測試鎖定 `appId = pepis`。
  - 新增測試鎖定暫時 ISSOUser `extId = 97162640`。

## 驗證

- RED check：在 helper / constant 尚未存在前，先執行 `mvn -DskipTests=false -Dtest=SecurityControllerAnnouncementTest test`，測試編譯因找不到符號而失敗，符合預期。
- Maven 測試生命週期注意事項：此專案 POM 內 surefire 設定 `skipTests=true`，所以一般 Maven test 指令會編譯但跳過 JUnit 執行。
- 直接用 JUnit runner 執行新增測試，結果為 `OK (2 tests)`。
- 編譯檢查 `mvn -q -DskipTests compile` 通過。

## 新登入頁 URL 與公告位置參數

新登入頁目前可用網址：

- 本機 8080：`http://localhost:8080/APEPIS/CCPS/#/login?force=1&announcementPosition=right`
- 本機 Tomcat Maven 8233：`http://localhost:8233/APEPIS/CCPS/#/login?force=1&announcementPosition=right`
- web.xml 目前登入入口設定：`http://tepis.tradevan.com.tw:8233/APEPIS/CCPS/#/login`

公告位置可透過 `announcementPosition` query 調整。`Login.vue` 目前支援：

- `announcementPosition=right`：公告在右側，預設值。
- `announcementPosition=left`：公告在左側。
- `announcementPosition=top`：公告在上方。
- `announcementPosition=bottom`：公告在下方。

常用測試網址：

- 右側：`http://localhost:8080/APEPIS/CCPS/#/login?force=1&announcementPosition=right`
- 左側：`http://localhost:8080/APEPIS/CCPS/#/login?force=1&announcementPosition=left`
- 上方：`http://localhost:8080/APEPIS/CCPS/#/login?force=1&announcementPosition=top`
- 下方：`http://localhost:8080/APEPIS/CCPS/#/login?force=1&announcementPosition=bottom`

補充：`force=1` 是方便測試新登入頁入口的 query；公告位置實際由 `announcementPosition` 控制。

## 待討論事項

- `ISSOUser extId = 97162640` 後續要改成真正登入者 context。
- `/rest/auth/announcements` 在改成真正登入後公告後，是否應移出 public API。
- `appId = pepis` 是否繼續硬寫，或改成環境 / application 設定。
- 目前登入頁仍在 page created 時載入公告，實際上還沒有真實登入者 context；後續若要完全符合「登入後公告」，前端載入時機也要一起確認。

## 影響說明

- API path 沒有變，前端仍呼叫 `/rest/auth/announcements`。
- 公告資料來源已從登入頁 `TDIS` top 公告，改為 ISSO `getAPPAnnouncement` 對應的 pepis 系統公告。
- `pepis_ap` 沒有新增 SQL，公告查詢條件仍由 `tv-isso-api` 負責。
- 本次工作開始前 worktree 已有多個不相關本機變更，未做 revert。