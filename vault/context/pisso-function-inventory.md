---
type: inventory
date: 2026-05-13
project: PISSO
system: PISSO
repo: psaab
topic: pisso-function-inventory
status: reference
summary: 盤點 psaab 與 tv-isso-api 的函式清單，作為 PISSO tracing 的參考 inventory。
tags: [pisso, psaab, tv-isso-api, function-inventory]
---

# PISSO 雙專案函式清單

> 來源專案：`psaab` + `tv-isso-api`
> 產出時間：2026-05-13

---

## 一、psaab（僅 2 個 Java 檔）

### XssFilter.java
`com.tradevan.saab.filter.XssFilter`

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | void | `init(FilterConfig filterConfig)` | Filter 初始化（空實作） |
| public | void | `doFilter(ServletRequest, ServletResponse, FilterChain)` | 將 request 包裝為 XSSRequestWrapper 後放行 |
| public | void | `destroy()` | Filter 銷毀（空實作） |

### XSSRequestWrapper.java
`com.tradevan.saab.filter.XSSRequestWrapper`

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | — | `XSSRequestWrapper(HttpServletRequest)` | 建構子 |
| public | String[] | `getParameterValues(String name)` | 覆寫：對每個參數值做 XSS 清除 |
| public | String | `getParameter(String parameter)` | 覆寫：對參數值做 XSS 清除 |
| public | String | `getHeader(String name)` | 覆寫：對 header 值做 XSS 清除 |
| public | String | `stripXSS(String value)` | 用 regex pattern 迴圈清除 XSS 片段 |

---

## 二、tv-isso-api

### 2.1 核心基底類別

#### ApContext.java
`com.tradevan.isso.ext.ApContext`

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| static | String | `getApplicationId()` | 取得 SAAB Application ID |
| static | ApLogger | `getLogger()` | 取得 ApLogger |
| static | EventConfig | `getEventConfig()` | 取得事件設定 |
| static | EventCode | `getEventCode(String eventId, String code)` | 取得事件代碼 |
| static | ModelManager | `getModelManager()` | 取得預設 ModelManager |
| static | ModelManager | `getModelManager(String applicationId)` | 取得指定 App 的 ModelManager |
| static | ServiceManager | `getServiceManager(String applicationId)` | 取得指定 App 的 ServiceManager |
| static | ServiceManager | `getServiceManager()` | 取得預設 ServiceManager |
| static | String | `getEncryptMehtod()` | 取得登入加密方式 |
| static | FrameworkContext | `getContext()` | 取得 FrameworkContext |

#### ApLogger.java
`com.tradevan.isso.ext.ApLogger`

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | — | `ApLogger()` | 建構子 |
| public | void | `log(LogLevel level, Object logObj)` | 覆寫：自動轉換為 LogObject |
| public | void | `log(LogLevel level, Object logObj, Throwable t)` | 覆寫：附帶例外的 log |
| public | LogObject | `newLogObject(String eventId, String code)` | 用 Event.xml 的 eventId/code 建立 LogObject |
| public | LogObject | `newLogObject(Object logObj)` | 用物件訊息建立 LogObject |
| private | Object | `toLogObject(Object logObj)` | 內部轉換 |

#### Constant.java
`com.tradevan.isso.ext.Constant`

> 純常數類別，無方法。定義 i18n key、URL target、Cookie 名稱、Admin Role ID。

#### DefaultAction.java
`com.tradevan.isso.ext.DefaultAction` extends BaseAction

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | — | `DefaultAction()` | 建構子 |
| public | void | `setLogger(CommonLogger logger)` | 設定 ApLogger |

#### PageAction.java
`com.tradevan.isso.ext.PageAction` extends DefaultAction

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | — | `PageAction()` | 建構子 |
| public | DataPage | `getDataPage()` | 取得分頁物件 |
| public | List | `getDataList()` | 取得分頁資料 |
| public | int | `getCurrentPage()` | 取得當前頁碼 |
| public | void | `setCurrentPage(int)` | 設定當前頁碼 |
| public | void | `setPageSize(int)` | 設定每頁筆數 |
| public | int | `getPageSize()` | 取得每頁筆數 |

#### DefaultModel.java
`com.tradevan.isso.ext.DefaultModel<T extends DefaultDataObject>`

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | — | `DefaultModel()` | 建構子（預設連線） |
| public | — | `DefaultModel(String connectionId)` | 建構子（指定連線） |
| static | void | `beginTransaction()` | 開始交易（預設連線） |
| static | void | `beginTransaction(String connectionId)` | 開始交易（指定連線） |
| static | void | `commit()` | 提交交易 |
| static | void | `rollback()` | 回滾交易 |
| public | XdaoSession | `getXdaoSession()` | 取得 XDAO Session |
| static | XdaoFactory | `getXdaoFactory()` | 取得 XDAO Factory |
| public | XdaoConnection | `getXdaoConnection()` | 取得 XDAO 連線 |
| public | XdaoSession | `getXdaoSession(String tableName)` | 取得指定 table 的 Session |
| public | XdaoTemplate | `getXdaoTemplate()` | 取得 XDAO Template |
| static | String | `getDefaultConnectionId()` | 取得預設連線 ID |
| protected | int | `insert(T dataObject)` | 新增資料 |
| protected | int | `insert(String tableName, T dataObject)` | 新增資料（指定 table） |
| protected | List\<T\> | `query(T predicate)` | 查詢（全欄位） |
| protected | List\<T\> | `query(String selectString, T predicate)` | 查詢（指定欄位） |
| protected | List\<T\> | `query(String selectString, T predicate, int timeout)` | 查詢（含 timeout） |
| protected | List\<T\> | `query(String tableName, String selectString, T predicate, int timeout)` | 查詢（完整參數） |
| protected | List\<T\> | `queryOrder(String orderBy, T predicate)` | 排序查詢 |
| protected | int | `update(T updatedObject, T predicate)` | 更新資料 |
| protected | int | `update(String tableName, T updatedObject, T predicate)` | 更新資料（指定 table） |
| protected | int | `delete(T predicate)` | 刪除資料 |
| protected | int | `delete(String tableName, T predicate)` | 刪除資料（指定 table） |
| protected | T | `queryOne(T predicate)` | 查詢單筆 |
| protected | T | `queryOne(String selectString, T predicate)` | 查詢單筆（指定欄位） |
| protected | T | `queryOne(String selectString, T predicate, int timeout)` | 查詢單筆（含 timeout） |
| protected | List\<T\> | `templateQuery(String templateName, T predicate)` | Template 查詢 |

#### PermissionConfig.java
`com.tradevan.isso.ext.PermissionConfig`

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | — | `PermissionConfig(String conf)` | 建構子（載入設定檔） |
| public | Properties | `getSettings()` | 取得所有 setting |
| public | String[] | `getSettingNames()` | 取得所有 setting 名稱 |
| public | String | `getSetting(String settingName)` | 取得指定 setting 值 |
| public | String[] | `getSettingArray(String settingName)` | 取得 setting 值（陣列） |
| static | void | `main(String[] args)` | 測試用進入點 |

#### SysMessage.java
`com.tradevan.isso.ext.SysMessage`

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| static | String | `getMessage(Exception e)` | 取得 Exception 顯示訊息 |
| static | String | `getExceptionMsg(Exception e)` | 取得例外錯誤訊息（含 ORA- 解析） |
| static | String | `getEventMessage(String eventId, String code)` | 取得 Event.xml 設定的訊息 |

#### ApplicationUtil.java
`com.tradevan.isso.ext.util.ApplicationUtil`

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| static | String | `getProperty(String key)` | 取得 application.xml 的 property |
| static | String | `getSetting(String key)` | 取得 application.xml 的 setting |

---

### 2.2 Bean（資料物件）層

#### DefaultDataObject.java（抽象）

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| abstract | String | `getTableName()` | 提供目標 table 名稱 |
| abstract | Class | `getOriginalClass()` | 提供實作 class type |

#### ISSOUser.java extends User

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| static | String | `getDefaultId(String extId, String customId)` | 產生預設 User ID（格式：`N_extId_customId`） |
| static | ISSOUser | `createUser(String appId, String customId, String name, String passWord, String eMail, String extId, String extName, String status)` | 工廠方法：建立新使用者 |
| static | ISSOUser | `createUser(SaabUser user)` | 工廠方法：從 SaabUser 轉換 |
| public | String | `getBuildBy()` / `setBuildBy(String)` | 建立來源 getter/setter |
| public | String | `getSuspendStartDate()` / `setSuspendStartDate(String)` | 停用開始日期 getter/setter |
| public | String | `getSuspendEndDate()` / `setSuspendEndDate(String)` | 停用結束日期 getter/setter |

#### ISSOBillingInfo.java extends DataObject

| 方法 | 欄位 |
|------|------|
| `get/setBillingAppId` | BILLING_APP_ID |
| `get/setBillingSrvId` | BILLING_SRV_ID |
| `get/setBillingSrvName` | BILLING_SRV_NAME |
| `get/setAppIdMapping` | APP_ID_MAPPING |
| `get/setSrvIdMapping` | SRV_ID_MAPPING |

#### IssoAnnouncementDO.java extends DataObject

| 方法 | 欄位 |
|------|------|
| static `getPriorityName(String)` | 優先度轉中文名稱 |
| `get/setAppId` | APP_ID |
| `get/setOrgId` | ORG_ID |
| `get/setBuildDate` | BUILD_DATE |
| `get/setPriority` | PRIORITY |
| `get/setContent` | CONTENT |
| `get/setStartDate` | START_DATE |
| `get/setEndDate` | END_DATE |
| `get/setAttach` | ATTACH（Blob） |
| `get/setAttachName` | ATTACH_NAME |
| `get/setIsHighlight` | IS_HIGHLIGHT |

#### IssoBoxDataDO.java extends DataObject

| 方法 | 欄位 |
|------|------|
| `get/setOrgId` | ORG_ID |
| `get/setOrgBoxNo` | ORG_BOX_NO |
| `get/setOrgBoxSubNo` | ORG_BOX_SUB_NO |
| `get/setCustomsGate` | CUSTOMS_GATE |
| `get/setListIssoBoxDataDO` | 子清單 |

#### IssoCodeDataDO.java extends DataObject

| 方法 | 欄位 |
|------|------|
| `get/setCodeType` | CODE_TYPE |
| `get/setCodeId` | CODE_ID |
| `get/setCodeCName` | CODE_CNAME |
| `get/setCodeEName` | CODE_ENAME |
| `get/setCodeData01` ~ `get/setCodeData05` | CODE_DATA01 ~ CODE_DATA05 |
| `get/setListIssoBoxDataDO` | 子清單（命名有誤，應為 CodeData） |

#### ISSOOrgBilling.java extends DataObject

| 方法 | 欄位 |
|------|------|
| `get/setOrgId` | ORG_ID |
| `get/setBillingAppId` | BILLING_APP_ID |
| `get/setBillingSrvId` | BILLING_SRV_ID |

#### ISSOOrgExtInfo.java extends DataObject

| 方法 | 欄位 |
|------|------|
| `get/setOrgId` | ORG_ID |
| `get/setAliasName` | ALIAS_NAME |

#### ISSOOrgSRInfo.java extends DataObject

| 方法 | 欄位 |
|------|------|
| `get/setAppId` | APP_ID |
| `get/setOrgId` | ORG_ID |
| `get/setSrvId` | SRV_ID |
| `get/setCustId` | CUST_ID |
| `get/setSendId` | SEND_ID |
| `get/setRecvId` | RECV_ID |
| `get/setEffDate` | EFF_DATE |
| `get/setStopDate` | STOP_DATE |
| `get/setSRBill` | S_R_BILL |
| `get/setFtpWay` | FTP_WAY |

#### IssoDefaultDO.java extends DataObject

> 空類別，無自定義方法。

---

### 2.3 Model（資料存取）層

#### IssoDefaultModel.java extends DefaultModel

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | — | `IssoDefaultModel()` | 建構子（連線 `pdcmaConn`） |

#### IssoAnnouncementModel.java extends IssoDefaultModel

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | List\<IssoAnnouncementDO\> | `getAnnouncement(IssoAnnouncementDO obj)` | 依條件查詢公告（content 用 LIKE） |

#### IssoBillingInfoModel.java extends IssoDefaultModel

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | int | `insert(ISSOBillingInfo)` | 新增收費資訊 |
| public | List\<ISSOBillingInfo\> | `query()` | 查詢所有收費資訊 |
| public | ISSOBillingInfo | `queryByPK(ISSOBillingInfo)` | 依 PK 查詢收費資訊 |

#### IssoBoxDataModel.java extends IssoDefaultModel

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | String | `insert(IssoBoxDataDO)` | 新增報關箱號 |
| public | String | `deleteByOrgData(IssoBoxDataDO)` | 依組織+箱號刪除 |
| public | List\<IssoBoxDataDO\> | `queryByOrgId(String orgId)` | 依組織查詢箱號 |
| public | List\<IssoBoxDataDO\> | `query(IssoBoxDataDO)` | 多條件查詢箱號 |
| public | List\<IssoBoxDataDO\> | `getBoxData(String orgId)` | 依組織取得箱號 |
| public | List\<IssoBoxDataDO\> | `getOrgDataByBoxNo(String boxNo, String boxSubNo, String customsGate)` | 依箱號反查組織 |

#### IssoCodeDataModel.java extends IssoDefaultModel

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | List\<IssoCodeDataDO\> | `getSysCodeType()` | 取得所有代碼種類（CODE_TYPE=S01） |
| public | List\<IssoCodeDataDO\> | `getCodeDataByCodeType(String codeType)` | 依代碼類別查詢 |
| public | List\<IssoCodeDataDO\> | `getCodeDataByMap(HashMap<String,String> codeMap)` | 依 Map 多條件查詢 |

#### IssoOrgBillingModel.java extends IssoDefaultModel

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | int | `insert(ISSOOrgBilling)` | 新增申請服務資訊 |
| public | List\<ISSOOrgBilling\> | `query()` | 查詢所有申請服務 |
| public | ISSOOrgBilling | `queryByPK(ISSOOrgBilling)` | 依 PK 查詢 |
| public | List\<ISSOOrgBilling\> | `queryByOrgId(String orgID)` | 依組織查詢 |

#### IssoOrgExtInfoModel.java extends IssoDefaultModel

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | int | `insert(ISSOOrgExtInfo)` | 新增組織擴充資訊 |
| public | List\<ISSOOrgExtInfo\> | `query()` | 查詢所有 |
| public | ISSOOrgExtInfo | `queryByPK(ISSOOrgExtInfo)` | 依 PK 查詢 |

#### IssoOrgSRInfoModel.java extends IssoDefaultModel

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | int | `insert(ISSOOrgSRInfo)` | 新增傳送接收資訊 |
| public | ISSOOrgSRInfo | `queryByPK(ISSOOrgSRInfo)` | 依 PK 查詢 |
| public | int | `update(ISSOOrgSRInfo)` | 更新傳送接收資訊 |
| public | List\<ISSOOrgSRInfo\> | `queryByOrgId(String OrgId)` | 依組織查詢 |

---

### 2.4 Service（業務邏輯）層

#### AuthorizeService.java

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | void | `authUser(ISSOBillingInfo info, ISSOUser user)` | 授權使用者預設功能（依計費資訊） |
| public | void | `authUser(String appId, String authDef, ISSOUser user)` | 授權使用者預設功能（依 appId + 參考帳號） |
| public | ISSOUser | `createISSOMGR(String orgId, String orgName, String buildBy)` | 建立 ISSOMGR 管理帳戶 |
| public | ISSOUser | `createISSOADM(String orgId, String orgName, String buildBy)` | 建立 ISSOADM 授權設定帳戶 |

#### UserDataService.java

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | int | `addUser(String appId, String customId, String name, String passWord, String eMail, String extId, String extName)` | 新增使用者 |
| public | int | `addUser(String appId, String customId, String name, String passWord, String eMail, String extId, String extName, String authDef)` | 新增使用者（含授權） |
| public | int | `updateUser(ISSOUser updUser)` | 更新使用者 |

#### OrgDataService.java

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | — | `OrgDataService()` | 建構子（初始化 SaabContext） |
| public | SaabOrganization | `getOrgData(String orgId)` | 依 orgId 取得組織 |
| public | List\<SaabOrganization\> | `getSubOrgData(String orgId)` | 取得關聯子組織 |
| public | ISSOOrgExtInfo | `getOrgExtInfo(String orgId)` | 取得組織擴充資訊 |
| public | List\<ISSOOrgBilling\> | `getOrgBilling(String orgId)` | 取得組織服務申請 |
| public | List\<ISSOOrgSRInfo\> | `getOrgSRInfo(String orgId)` | 取得組織傳送接收資訊 |
| public | int | `addOrg(String orgId, String cName, String eName, String status, int userLimit, int edwFlg)` | 新增組織 |
| public | int | `updateOrg(SaabOrganization updOrg)` | 更新組織 |
| private | SaabOrganization | `createOrg(...)` | 建立 SaabOrganization 物件 |

#### CodeDataService.java

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | List\<IssoCodeDataDO\> | `getCodeData(String codeType)` | 依代碼類別查詢 |
| public | List\<IssoCodeDataDO\> | `getCodeType()` | 取得所有代碼類別 |
| public | List\<IssoCodeDataDO\> | `getCodeDataByKey(String codeType, String codeId, String codeData01~05)` | 多條件查詢代碼 |

#### AnnouncementService.java

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | List\<IssoAnnouncementDO\> | `getAnnouncement(IssoAnnouncementDO cond)` | 依條件取得公告 |
| public | List\<IssoAnnouncementDO\> | `getLoginAnnouncement(String orgId)` | 取得登入頁公告 |
| public | List\<IssoAnnouncementDO\> | `getLoginAnnouncement(String orgId, boolean isHighlight)` | 取得登入頁公告（醒目） |
| public | List\<IssoAnnouncementDO\> | `getLoginAnnouncement()` | 取得登入頁公告（無組織） |
| public | List\<IssoAnnouncementDO\> | `getLoginAnnouncement(boolean isHighlight)` | 取得登入頁公告（醒目，無組織） |
| public | List\<IssoAnnouncementDO\> | `getAnnouncement(ISSOUser user)` | 取得登入後公告 |
| public | List\<IssoAnnouncementDO\> | `getAPPAnnouncement(String appId, ISSOUser user)` | 取得系統公告 |
| private | List\<IssoAnnouncementDO\> | `formatBuildate(List)` | 格式化建立日期 |
| private | List\<IssoAnnouncementDO\> | `filterDataLifeCycle(List)` | 依生命週期過濾公告 |
| private | void | `sortData(List)` | 依建立日期排序 |

#### BoxDataService.java

| 修飾 | 回傳 | 方法簽章 | 說明 |
|------|------|----------|------|
| public | List\<IssoBoxDataDO\> | `getBoxData(String orgId)` | 依組織取得箱號資料 |
| public | List\<SaabOrganization\> | `getOrgDataByBoxNo(String boxNo, String boxSubNo, String customsGate)` | 依箱號反查組織 |

---

## 統計摘要

| 分層 | 類別數 | 公開方法數 | 說明 |
|------|--------|-----------|------|
| **psaab filter** | 2 | 5 | XSS 防護 |
| **基底/工具** | 7 | 40+ | Action/Model/Context/Logger/Config/Message/Util |
| **Bean (DO)** | 9 | ~60 | 以 getter/setter 為主 |
| **Model (DAO)** | 8 | 25 | CRUD + 查詢 |
| **Service** | 6 | 25 | 業務邏輯 |
| **合計** | **32** | **~155** | |
