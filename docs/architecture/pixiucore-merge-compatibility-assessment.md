# PixiuCore 合併與現行操作相容性評估

- 日期：2026-07-27
- 整合基底：`origin/master` @ `b0bb5af`
- 整合工作區：先於 DevSpace managed worktree 驗證，後收斂至 `C:\PixiuCore` 的 `master`
- 結論：**程式整合、現行服務與 no-restart state repair 已驗證；受控 stop/start 與外部 OAuth smoke 尚未執行，因此仍不宣告完整 restart smoke 完成。**

## 評估範圍

本評估確認下列整合是否會破壞現行操作或既有功能：

1. PixiuCore Lazy Loading 與 Capability Router。
2. Agent Learning Phase 1／Manual Recap Phase 2。
3. Core Evolution Gates。
4. DevSpace OneClick 與 Dev Tunnel 相容性。
5. 既有 Command、Agent、Skill 與 Hook 清單。
6. 目前正在運作的 DevSpace MCP 與 tunnel process。

## 觀察事實

### 1. 現行服務狀態

- `127.0.0.1:7678` 仍由 `node.exe` 監聽。
- 對 `/mcp` 發出未授權請求時回傳 HTTP `401`，表示 MCP 服務與認證層正常運作。
- Dev Tunnel host process 仍在運作。
- 執行整合與測試期間，現行 listener PID 未中斷。

### 2. OneClick state 漂移已由 no-restart repair 修復

- 整合前 `runtime.json` 的 PID 與 `settings.json` 的 tunnel 已和現行服務漂移。
- 新增的 `repair-state` 只在本機／公開 health、listener 身分、launcher parent、tunnel ID 與 region 全部一致時接管。
- 修復不停止也不重啟現行服務，寫回前會備份，read-back 失敗則恢復舊內容。
- 2026-07-27 最新 `status` 已驗證本機 MCP、公開 MCP、tunnel ID、DevSpace PID 與 Dev Tunnel PID。

### 3. 合併檔案不會直接中斷現行服務

- 現行 DevSpace process 執行的是全域安裝的 `@waishnav/devspace` 套件，不是直接執行 worktree 或 `C:\PixiuCore` 內的 Node 程式。
- Git 合併只會更新 PixiuCore repository 檔案，不會自動終止、重啟或重新載入正在運作的 Node／Dev Tunnel process。
- DevSpace package patch 只會在未來執行 OneClick `install` 或 `start` 時套用。

### 4. 新 Session 會有刻意的行為變更

- `%USERPROFILE%\.pixiu-core` 是指向 `C:\PixiuCore` 的 junction。
- 合併後，新 Session 會由全量啟動改為 `SESSION-BOOTSTRAP.md` + Capability Manifest 按需載入。
- 目前 Session 與正在執行的 MCP process 不會因此自動重啟；重新開啟或重新讀取 workspace 的 Session 才會使用新版入口。

### 5. 既有功能沒有被刪除

- 沒有刪除或重新命名既有 tracked file。
- 目前 `59` 個 Command 全部保留，包含新增的 `commands/recap.md`。
- 既有 `27` 個 Agent 全部保留。
- 既有 Auto Recap 程式未修改。
- Core Evolution Gates 程式未修改。
- 新增三個 capture 相關檔案：manual helper、deterministic capture、測試。

### 6. 現行未提交 Dev Tunnel 修正已保留

整合前 `C:\PixiuCore` 存在未提交的現行修正：

- 同時支援 legacy `{ tunnel: ... }` 與目前直接 tunnel object 回應。
- 支援 `portForwardingUris`。
- 支援 Dev Tunnel `show -j -v` 的 raw HTTP JSON 擷取。

本輪已把這些修正合併進整合 worktree，並保留：

- 舊版 `portUri`。
- 缺少 URL 時由 tunnel ID 推導的 fallback。
- label 參數驗證。
- Skill 鏡像抑制。
- SHA-256 patch manifest 與安全還原。

### 7. Capability 相容性補強

原始 Lazy Loading Manifest 無法識別下列常用語句：

- `確認目前進度`
- `你看一下這個專案的對話`
- `幫我收尾，跑驗證`
- `auto mode 自動放行`
- `focus mode 只看結果`
- `確認不會影響現行操作跟功能`

已補上回歸測試與路由：

- 進度／對話 → `recap-memory`
- 收尾／驗證 → `code-review` + Pixiu verify loop
- Auto／Focus mode → `runtime-control`
- 影響評估 → `architecture-analysis` + impact assessment workflow

Manifest 的 Skill 路徑也已由可能過期的 `.agents/skills` 鏡像改為 canonical `skills/`。

### 8. 核心互動習慣仍常駐

雖然完整 founder／persona 不再每次全文載入，Bootstrap 仍保留：

- Pixiu Fleet 資深 Tech Lead 顧問定位。
- 架構級決策提供 2–3 個選項與優缺點。
- 不替使用者拍板。
- 繁體中文。
- 寫入與高風險審批。
- 最小修改。
- Agent Team 需明確同意。
- 完成前驗證。

## 驗證結果

| 範圍 | 2026-07-27 最新結果 |
|---|---:|
| Manual Recap／Deterministic Capture | 41 / 41 |
| Auto Recap | 6 / 6 |
| Lazy Loading／Router／Metadata | 30 / 30 |
| DevSpace OneClick／Dev Tunnel／Skill Patch | 77 / 77 |
| Core Evolution Gates | 16 / 16 |
| Web Test Console 契約 | 10 / 10 |
| Web API 單模組＋完整整合 | 1 / 1，六步驟全綠 |

其他驗證：

- Startup payload：Codex `6,705 / 8,192 bytes`、Claude `3,939 / 6,144 bytes`、Gemini `3,963 / 6,144 bytes`。
- Skill metadata：canonical `90`、portable `87`，均為 `0` warning。
- Skill raw/effective collision：`87 / 0`。
- OneClick `status`：本機與公開 MCP、tunnel ID、DevSpace PID、Dev Tunnel PID 全部 verified。
- Node syntax、PowerShell parse、`git diff --check`、衝突標記與變更檔憑證樣式掃描：通過。

## 風險評估

### 低風險：現行 process

**觀察事實**：現行 DevSpace 與 tunnel process 使用全域套件並持續運作。

**潛在風險**：單純 Git 合併不會重啟 process；風險主要在合併後手動執行 OneClick `start`／`install`。

**建議補強**：合併期間不要停止或重新啟動現行服務。

### 中風險：新 Session 路由

**觀察事實**：新 Session 改為按需載入。

**潛在風險**：未命中關鍵詞的隱含跨 Session 問題可能少載入舊記憶。

**建議補強**：已加入近期真實語句回歸；合併後仍需開啟新的 smoke Session 驗證一般問答、進度、Recap、PCLMS、Auto／Focus mode。

### 中風險：OneClick 受控重啟尚未 smoke

**觀察事實**：OneClick settings／runtime 已與現行 process、tunnel 對齊，`status` 可正常驗證。

**潛在風險**：目前證據來自 no-restart 接管與健康檢查，尚未證明停止後能以相同設定完整啟動並通過外部 OAuth。

**建議補強**：另開維護窗口，保留目前 MCP URL 與 state 備份，執行受控 `stop → start → local health → public health → OAuth smoke`。

## 合併判定

### 可以執行

- 建立、提交與推送 PixiuCore repository 變更；Git 操作本身不會重啟現行 DevSpace／Dev Tunnel。
- 使用 Web Test Console 執行各模組與完整整合測試。
- 開啟新的 AI Session 驗證 Bootstrap／Manifest 路由。

### 需維護窗口

- 執行 OneClick `stop`／`start`／`install` 或移除目前正在運作的 process。
- 宣告完整 restart-safe 前，必須完成外部 MCP OAuth smoke。

## 最終結論

**本輪程式整合不會直接中斷現行 DevSpace MCP，也沒有刪除既有功能；現行本機 Dev Tunnel 修正已完整保留。**

目前判定：

- **Merge-safe：是。**
- **Current-service-safe：是，現行本機與公開 MCP 及兩個 PID 已驗證。**
- **New-session-safe：Router 與本次 Session 已通過；跨 Codex／Claude／Gemini 的完整矩陣仍建議 smoke。**
- **Restart-state-ready：是，state 已修復並可被 OneClick 辨識。**
- **Restart-smoke-complete：否，尚未執行受控 stop/start 與外部 OAuth。**
