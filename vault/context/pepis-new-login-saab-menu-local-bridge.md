---
type: context-note
date: 2026-05-19
project: PEPIS
system: PEPIS
repo: pepis_ap
topic: pepis-new-login-saab-menu-local-bridge
status: draft
summary: pepis_ap 新登入頁本機 SAAB menu 橋接與上線前移除注意事項
tags: [pepis_ap, CCPS, login, SAAB, menu, userMenu, local-only, deploy-caution]
related_projects: psaab
created: 2026-05-19
scope: local-login-bridge | SAAB-session | menu-permission
---

# pepis_ap 新登入頁 SAAB menu 本機橋接上線注意事項

## 背景

`pepis_ap` 新登入頁一開始登入成功後看不到左側 menu。前一波修正的主軸不是補 menu 資料，而是在本機啟動情境下先接起：

`新登入成功 -> cookie / SAAB session -> /userMenu -> Vue 左側 menu`

目前本機已能透過 `/userMenu` 拿到 menu，代表登入後接 SAAB menu 的橋已經通。

## 本機橋接現況

目前本機橋接點如下：

- `src/main/java/com/tradevan/pccps/web/restful/SecurityController.java`
  - `setCookies()` 會設定 `c_id`。
- `src/main/java/com/tradevan/pccps/web/filter/FixSSOLoginFilter.java`
  - 依 `c_id` 還原 SAAB session 的 `__saab_user`。
- `src/main/java/com/tradevan/pepis/action/MenuAction.java`
  - `/userMenu` 入口。
- `src/main/java/com/tradevan/pepis/util/MenuUtil.java`
  - 透過 `SaabContext.getContext().getUserContext().getMenus()` 取得 SAAB menu。

這段目前主要是為了讓本機新登入頁可以在沒有正式 SSO 全流程時取得 SAAB menu。

## 上線注意事項

這段 `SecurityController.setCookies()` 設 `c_id`，再由 `FixSSOLoginFilter` 還原 `__saab_user` 的流程，應視為本機驗證用 bridge / workaround。

正式上線前要重新確認正式環境的 SSO / SAAB session 流程：

- 正式 SSO 是否已正確建立 SAAB session。
- `/userMenu` 是否能在不依賴本機 `c_id` workaround 的情況下回傳 menu。
- `SecurityController.setCookies()` 中本機橋接用 cookie 是否要移除、改由環境設定控制，或限定 local profile。
- `FixSSOLoginFilter` 依 `c_id` 還原 `__saab_user` 的邏輯是否只保留在本機或測試環境。
- 不要把 local-only cookie/session 邏輯原樣帶到正式環境。

## 目前 menu 問題定位

目前 `/userMenu` 已可回傳：

- `CCPS600` 服務申請作業
  - `PaymentServiceApplyForm`
  - `PaymentServiceApplyQuery`
- `CCPS700` 客服審核專區
  - `PaymentServiceReviewQuery`

但 `/userMenu` 尚未回傳 EACH 授權相關 route：

- `EachAuthApplyForm`
- `EachAuthApplyQuery`
- `EachAuthReviewQuery`

因此目前 EACH 頁面直接輸入 `#/EachAuthApplyForm` 等 hash route 會被 Vue router guard 導到 `/Forbidden`，根因偏向 SAAB menu / role / resource mapping 未回傳，不是新登入流程完全拿不到 menu。

## 後續檢查方向

1. 查 `SAAB_MENU_DATA` 是否有 EACH 三個 menu URL。
2. 查 `SAAB_PRIVILEGE_DATA` 對應 privilege 是否 active。
3. 查 `SAAB_ROLE_PRIVILEGE` 是否把 menu 授給正確角色。
4. 確認 app id 使用 `CCPS`，不要誤掛到 `EPIS` 或其他 application。
5. 正式上線前，先移除或環境化本機 SAAB session bridge，再驗證 `/userMenu`。
