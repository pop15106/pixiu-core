---
type: after-action
date: 2026-05-21
project: PISSO_AP
system: PISSO
repo: pisso_ap
topic: announcement-system-code-dropdown-data-source
status: done
summary: 調查公告維護頁面「系統代碼」下拉選單的資料來源與查詢邏輯，釐清為何下拉只顯示部分系統代碼。
tags: [after-action, pisso, announcement, saab, sql, dropdown]
---

# 公告維護「系統代碼」下拉選單 — 資料來源調查

## 問題

公告維護頁面的「系統代碼」下拉選單只顯示少數幾個系統（TDIS、ISSO、PBKIS、QRCD、SFIS、SPIS），但 SAAB 應用系統清單實際上有 13 筆，原因不明。

## 調查結果

### 資料流

```
前端 query.jsp → 綁定 userAppList
  ↓
AnnouncementAction.getUserAppList()
  ├─ 硬編碼塞入 TDIS（appId = "TDIS"，名稱 = "貿易通關整合平台"）
  └─ appModel.getUserApps("N_<公司統編>_issoadm")
       ↓
       SAAB SQL：查詢 issoadm 帳號被授權的 app_id
  ↓
Service：WHERE APP_ID IN (...) 查 ISSO_ANNOUNCEMENT 表
```

### 實際執行 SQL（saab_api_sql.xml，templateId = ApplicationModel.getUserApps）

```sql
SELECT * FROM (
   SELECT DISTINCT app_id FROM SAAB_USER_PRIVILEGE
   WHERE user_id = 'N_<公司統編>_issoadm'
   UNION
   SELECT DISTINCT app_id FROM SAAB_USER_ROLE
   WHERE user_id = 'N_<公司統編>_issoadm'
   UNION
   SELECT DISTINCT app_id FROM SAAB_USER_ORGANIZATION uo, SAAB_ORG_ROLE r
   WHERE user_id = 'N_<公司統編>_issoadm' AND uo.ORG_ID = r.ORG_ID
   UNION
   SELECT DISTINCT app_id FROM SAAB_USER_ORGANIZATION uo, SAAB_ORG_PRIVILEGE r
   WHERE user_id = 'N_<公司統編>_issoadm' AND uo.ORG_ID = r.ORG_ID
) a, SAAB_APPLICATION b
WHERE a.app_id = b.app_id
ORDER BY b.app_id
```

### 關鍵：為什麼不是 13 個？

- **查詢對象不是登入使用者本人**，而是 `issoadm` 這個特殊共用帳號
- `user_id` 格式：`N_<公司統編>_issoadm`（由 `ISSOUser.getDefaultId(extId, "issoadm")` 組成）
- 13 個是 `SAAB_APPLICATION` 全表資料，但 `issoadm` 帳號只被設定了部分系統的權限
- **不同公司的 `issoadm` 設定不同，看到的下拉選項就不同**

### 公告查詢 SQL（ISSO_ANNOUNCEMENT 表）

```sql
SELECT * FROM ISSO_ANNOUNCEMENT
WHERE APP_ID IN ('TDIS', 'ISSO', 'PBKIS', ...)   -- 由 userAppList 動態組成
  AND ORG_ID IN ('ORG001', ...)                    -- 由 userOrgList 組成，admin 包含 '*'
  AND PRIORITY IN ('N', 'H', 'T')                  -- 全選時為全部三種
  AND BUILD_DATE >= '<beginDate>'                   -- 若只填一端，兩端設為相同值
  AND BUILD_DATE <= '<endDate>'
  AND CONTENT LIKE '%<keyword>%'                   -- 有輸入時才加
  AND IS_HIGHLIGHT = 'Y'                           -- 勾選「醒目提醒」時才加
ORDER BY BUILD_DATE DESC
```

### 選「全部」vs 選特定系統代碼的差異

| 操作 | appIds 組裝 | 效果 |
|------|------------|------|
| 選「全部」 | `('TDIS','ISSO','PBKIS',...)` 全部 userAppList | 查該使用者所有有權限的系統公告 |
| 選特定代碼 | `('PBKIS')` 單一值 | 只查該系統公告 |

## 相關檔案

- `pisso_ap/.../AnnouncementAction.java` — getUserAppList()、query() 組裝 IN 條件
- `pisso_ap/.../AnnouncementService.java` — SqlWhere 條件組裝
- `psaab/.../saab_api_sql.xml` — getUserApps SQL 模板
- `tv-isso-api/.../ISSOUser.java` — getDefaultId()、USER_ISSO_ADM = "issoadm"

## 結論

下拉選單的可見系統由 **SAAB 後台中 `issoadm` 帳號的應用系統授權設定** 決定，跟登入使用者本人的權限無關。若要讓某系統出現在下拉，需在 SAAB 後台對該公司的 `issoadm` 帳號補設對應應用系統的權限。
