# UI Reconstruction

本檔只處理「既有系統畫面」的忠實呈現。目標是重現，不是重新設計。

## 1. 先判斷畫面來源層

常見情況：

- Portal / E-HUB / SSO 外框屬於 A 系統。
- iframe / frame / embedded app 屬於 B 系統。
- 功能頁面又引用共用 CSS、channel CSS、圖片資源。

不要把不同 ownership 的 UI 混成一套新設計。

## 2. Source Walk

依序追：

1. Route / Struts / Controller mapping。
2. 目標 JSP / HTML / template。
3. `<%@ include %>`、`<jsp:include>`、template partial、component。
4. `<link>` 引用的 CSS。
5. inline style / style attribute。
6. JavaScript / jQuery 動態 DOM 操作。
7. GIF / PNG / JPG / background image / sprite。
8. Frame / iframe / parent page。
9. Server-side taglib、Session、Role、Feature flag 對畫面的影響。
10. Dynamic list / code table / DB-driven option。

只有全部走完，才開始做「忠實重建」。

## 3. Reconstruction Levels

### Level A — Actual Screenshot

直接使用實際系統畫面。需遮罩敏感資料。

標示：`實際系統畫面`。

### Level B — Runtime Render

以實際程式、實際 CSS/asset 在可控環境 Render；動態資料可以測試資料替代。

標示：`測試/驗證環境畫面`，並寫環境。

### Level C — Code-backed Reconstruction

無法啟動系統時，依 JSP/HTML/CSS/JS/asset 還原。

要求：

- CSS 尺寸、顏色、字型、border、background 取自來源。
- 原始圖片直接使用；不要「看起來差不多」就重畫。
- Legacy fixed width / table layout / frame 要保留。
- 動態資料使用合法虛構值。
- 無法確認的清單只放「範例」，不可冒充實際資料。

標示：`依程式碼還原畫面`。

### Level D — Illustrative Mockup

只有使用者明確接受時才使用。

標示：`示意圖，非系統實際畫面`。

## 4. Fidelity Checklist

重建前逐項勾：

- [ ] 頁面寬度與主要區塊比例。
- [ ] Banner / top bar / logo。
- [ ] 左側 Menu / tree / icon。
- [ ] 主內容 title bar。
- [ ] 表格 header、border、cell background。
- [ ] Button 原文字與視覺。
- [ ] Required 標記。
- [ ] Tab 顯示/隱藏條件。
- [ ] readonly / disabled 狀態。
- [ ] JavaScript 計算或連動。
- [ ] 圖片尺寸與格式限制提示。
- [ ] Runtime status label。

## 5. Annotation Rule

操作手冊可在截圖上加：

- ①②③ 步驟編號。
- 箭頭。
- 外框。
- 半透明標記。

Annotation 必須在「原畫面上疊加」，不能把原元件移位後再標。

## 6. Actual Screenshot vs Code Screenshot

文件需清楚區分：

- `實際系統畫面`：Runtime 直接取得。
- `依程式碼還原畫面`：由來源程式重建。
- `示意圖`：沒有足夠來源，只做概念說明。

若使用者明確要求「實際畫面」，而手上只有 Level C，應告知限制，不能偷換概念。

## 7. Legacy Web 特別注意

- IE 時代 CSS hack、table layout、fixed 980/1024 width 可能就是正確外觀。
- GIF Banner、背景圖、spacer image 可能直接控制 layout。
- `frameset` / `frame` 會造成外框與內頁 repo 分離。
- Channel CSS 可能覆蓋 global CSS；需看 cascade 順序。
- server tag 可能改 class/style 或直接不 render 元件。

不要用現代瀏覽器常識把這些「修正掉」。
