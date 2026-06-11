---
type: recap
date: 2026-05-04
project: PEPIS
system: PEPIS
repo: pepis_ap
topic: query-modify-and-cross-project-recap-writeback
status: done
tags: [recap, pepis, ccps, edda, pixiucore]
summary: 整理 PEPIS 3.4 查詢修改結果，並修正 recap 必須跨專案回寫 PixiuCore vault 的規則。
---

# 2026-05-04 PEPIS 3.4 查詢修改與 Recap 跨專案回寫

## 任務目標與背景

- 專案：`<workspace-root>\pepis_ap`
- 系統：CCPS 通關金流服務平台 / PEPIS eDDA 授權流程。
- 本輪主線是修正 `EachAuthApplyQuery`、`EachAuthReviewQuery` 對「修改」與「申請類別」的 3.4 規格行為，並暫時打開授權身份限制以便本機測試。
- 使用者另要求修正 PixiuCore 技能規則：只要下達 `recap`，不論目前在哪個專案，都必須回寫 Pixiu vault。

## 本次已完成

- 已暫時打開授權身份限制，方便本機所有身份都能測授權。
  - 前端：`view/CCPS/src/views/AuthApplyQueryBasic.vue`
  - 後端：`src/main/java/com/tradevan/pccps/web/restful/AuthorizationController.java`
  - 已加 TODO 註記，提醒部署 server 前必須還原。
- 已依 Core Logic 3.4 修正查詢結果清單的「修改」按鈕啟用規則。
  - `審查駁回(2)`：可修改。
  - `授權駁回(5)`：可修改。
  - `授權通過(4)`：可修改。
  - 其餘狀態停用。
- 已修正 `queryModify` 編輯頁的申請類別矩陣。
  - 原申請類別 `授權`，駁回時固定授權；授權通過時可選修改授權 / 終止授權。
  - 原申請類別 `修改授權`，駁回時固定修改授權；授權通過時可選修改授權 / 終止授權。
  - 原申請類別 `終止授權`，駁回時固定終止授權；授權通過時可選授權。
- 已修正欄位編輯權限聯動。
  - 選 `授權`：業務欄位可編輯。
  - 選 `修改授權`：僅付款限額可編輯。
  - 選 `終止授權`：全部業務欄位唯讀。
- 已修正 `AuthApplyQueryBasic.vue` runtime error。
  - 原錯誤：`TypeError: this.syncPayerNo is not a function`
  - 原警告：`applyNo is not defined on the instance`
  - 已補 `applyNo` data 與 `syncPayerNo()` method。
- 已修正 `v-select` 顯示 raw code 的問題。
  - 透過 comparator 與 selection/item slot，讓申請類別顯示中文而不是 `1`。
- 已強化 PixiuCore recap 規則。
  - `%PIXIU_CORE%\skills\pixiu-session-recap\SKILL.md`
  - `%PIXIU_CORE%\user_rules.md`
  - 規則已改為跨專案強制回寫，不可因 cwd/repo 不是 PixiuCore 而只輸出文字 recap。

## 已驗證

- `npm run lint -- --no-fix`：通過。
- `npm run build`：通過，僅有既有 asset size 與 Sass deprecation warnings。
- build 輸出已寫入 `src/main/webapp/CCPS`。
- `mvn -q -DskipTests compile`：先前已通過。

## 尚待驗證 / 下一步

- 本機需重啟或重新部署 Tomcat，並在瀏覽器 Ctrl+F5 清快取。
- 若畫面仍舊，檢查 Network 是否載入新 bundle，例如 `app.a3ea7bf9.js`。
- 若使用的是 `target\tomcat` 或外部 Tomcat，需確認 `src/main/webapp/CCPS` 的新 build 已實際被部署到執行中的 server。
- 實測兩個入口：
  - `EachAuthApplyQuery`
  - `EachAuthReviewQuery`
- 測試資料需覆蓋狀態 `2/4/5` 與原申請類別 `授權/修改授權/終止授權`。

## 重要提醒

- 目前授權身份限制是測試用暫時打開。
- 部署到正式 server 前，必須回頭還原 `AuthorizationController.java` 與 `AuthApplyQueryBasic.vue` 內有 TODO 標記的授權限制。
- 這次前端修正是最小翻修：先把規格要求的可點擊、選單矩陣與欄位唯讀打通，不做大規模重構。

## 回寫決策

- 已將「recap 跨專案強制回寫 PixiuCore vault」寫入 memory summary。
- 已新增 decision：[[2026-05-04-Recap跨專案強制回寫PixiuCore]]

