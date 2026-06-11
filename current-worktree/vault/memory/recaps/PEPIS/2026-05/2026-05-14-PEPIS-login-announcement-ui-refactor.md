---
type: session-recap
date: 2026-05-14
project: PEPIS
system: PEPIS
repo: pepis_ap
topic: login-announcement-ui-refactor
status: paused
tags: [recap, pepis_ap, ccps, login, announcement, vue, ui]
summary: 重構 pepis_ap 登入頁公告資訊 UI，改成 table-like 清單並保留 loading、empty 與展開互動。
---

# 2026-05-14 PEPIS 登入頁公告資訊 UI 重構 Recap

## 任務目標

針對 `pepis_ap` 的 CCPS 登入頁「公告資訊」區塊做局部 UI 重構，目標是讓公告區塊接近企業系統常見資訊看板：尺寸接近登入卡片、內容改為表格式清單、保留 loading/error/empty 狀態與大量公告滾動能力，不改登入 API 規格。

## 分析結論

- 元件位置：`view/CCPS/src/views/Login.vue`。
- Layout：登入卡片與公告卡片共用 `.login-layout` flex 容器。
- 原限制：公告卡片原本約 `360px` 寬，公告清單內層 `max-height: 360px`，造成視覺上比登入區塊短且窄。
- 公告資料來源：前端呼叫 `/rest/auth/announcements`，後端回傳 `publishDate/title/content/priority`，前端只做呈現。
- Table reuse：專案其他頁多使用 `v-data-table`，但登入公告沒有分頁、排序、選取需求，因此採輕量原生 table，避免登入頁過重。

## 本次實作

- `Login.vue` 公告內容由卡片式 article 列表改成 table-like 清單。
- 欄位包含日期、標題、內容摘要。
- 摘要預設單行省略，點擊公告列後展開全文並保留換行。
- 新增 `expandedAnnouncementKeys` 狀態與 `announcementKey` / `toggleAnnouncement` / `announcementSummary` helper。
- `.login-layout` 改為 `align-items: stretch`，公告卡片可跟登入卡片等高。
- 公告卡片寬度從 360px 調整為接近登入卡片的 450px，桌面版左右更平衡。
- 預設公告位置改為右側，維持「左登入、右公告」畫面語意；原本 query 切換仍保留。
- 新增 sticky table header、hover/focus、scrollbar、loading、empty、RWD 小螢幕堆疊樣式。

## 受影響檔案

- `view/CCPS/src/views/Login.vue`
- `src/main/webapp/CCPS/` build 產物由 `npm run build` 重新產生，包含新的 `app.359fad07.js` 與對應 index 引用。

## 驗證

- `npm run lint -- --no-fix`：通過，無 lint errors。
- `npm run build`：通過，僅有既有 asset size warning 與 Vuetify/Sass deprecation warnings。
- 已啟動本機 Vue dev server，使用者表示畫面已看得到。

## 暫停點

目前先做到公告 UI 重構與基本驗證。尚未做更進一步的視覺截圖比對或 E2E 操作測試；若後續要收斂，可再補瀏覽器畫面驗證與必要的 deployment build 產物整理。
## 踩坑修正

- Recap 應先沿用 `vault/memory/recaps` 目前的根層平鋪規則；未明確換月或整理月份前，不要自行建立 `YYYY-MM` 子資料夾。
- Recap 檔名必須使用 `YYYY-MM-DD-HHMMSS-主題.md`，時間要到時分秒；本檔已由 `2026-05-14-1025-...` 修正為 `2026-05-14-102604-...`。
