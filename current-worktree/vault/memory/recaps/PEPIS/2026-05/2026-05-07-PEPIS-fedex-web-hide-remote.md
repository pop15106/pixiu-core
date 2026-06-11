---
type: recap
date: 2026-05-07
project: PEPIS
system: PEPIS
repo: pepis_ap
topic: fedex-web-hide-remote
status: done
tags: [recap, pepis, ccps, fedex, git-remote, branch-merge]
summary: 整理 PEPIS FedEx Web hide remote 相關調整，補記 git remote、branch 與 merge 判斷脈絡。
---

# 2026-05-07 PEPIS FedEx Web 隱藏與 Git Remote 切換

## 工作區

- Repo：`C:\Users\7010\Desktop\Project\pepis_ap`
- Remote 已改成新位置：
  - `origin ssh://git@intragitlab.tradevan.com.tw:10022/PEPIS/pepis_ap.git`
- 最後一次 recap 前查到的目前分支：
  - `feature/tv_7010_授權書修改_付款限額調整`
- 工作區仍有既存 untracked：
  - `.claude/`
  - `.vscode/`
  - `scripts/`
  - `src/main/resources/report/.settings/`

## Web 隱藏調整

- 主要調整分支：`feature/tv_7010_隱藏非FedEx的選項`
- 需求：只做 web 畫面上的業者選項隱藏，不動表單報表。
- 修改範圍：
  - `view/CCPS/src/views/AuthApply.vue`
  - `view/CCPS/src/views/AuthApplyQuery.vue`
  - `view/CCPS/src/views/AuthApplyQueryBasic.vue`

## 實作口徑

- `AuthApply.vue`
  - 保留完整 `partnerList` bit 順序。
  - 新增 `visiblePartnerIndices: [3, 4]`。
  - `displayPartnerList()` 只用 `visiblePartnerIndices` 決定 template checkbox 顯示項目。
  - 補註解：`僅控制畫面顯示的業者選項，不改 partnerList bit 順序與送出 payload。`
  - 不修改 `parseCoopIndustryToCheckbox()`。
  - 不修改 `calculateCoopInfoFromCheckbox()`。
  - 不新增或保留 `isVisiblePartnerIndex()`。

- `AuthApplyQuery.vue` / `AuthApplyQueryBasic.vue`
  - `decodeCoopIndustry()` 的 bit 定義加上 `visible`。
  - `順豐`、`UPS`、`DHL` 設為 `visible: false`。
  - `FedEx`、`其他` 設為 `visible: true`。
  - 顯示文字只列出可見業者。

## 驗證

- 在 `view/CCPS` 執行 `npm run lint`：通過。
- `git diff` 檢查只涉及三支 Vue。
- `src/main/resources/report` 報表檔未納入本次修改。

## Merge / Push 狀態

- 使用者後續把變更 merge 回：
  - `feature/CCPS-6581_亞拓及光德測試`
- GUI push 時出現：
  - `[rejected] ... (fetch first)`
  - 遠端分支已有本機沒有的 commit，需要先整合遠端更新。
- 當時我確認過：
  - push rejected 發生時，目標是 `feature/CCPS-6581_亞拓及光德測試`。
  - 本機顯示曾是 ahead 1，但 remote tracking 可能尚未 fetch 到最新。
- 我準備執行 `git fetch origin feature/CCPS-6581_亞拓及光德測試` 來確認遠端差異，但使用者中斷，因此沒有繼續拉取或整合。

## 下一步建議

- 若要完成 `feature/CCPS-6581_亞拓及光德測試` 的 push，先確認目前分支是否已切回該分支。
- 再執行 fetch 檢查遠端最新狀態。
- 若遠端真的有新 commit，建議用 rebase 或 merge 整合後再 push，避免覆蓋同事的更新。
