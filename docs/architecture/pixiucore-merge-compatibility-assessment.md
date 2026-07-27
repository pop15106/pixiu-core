# PixiuCore 合併前現行操作相容性評估

- 日期：2026-07-27
- 整合基底：`origin/master` @ `b0bb5af`
- 整合工作區：DevSpace managed worktree
- 結論：**程式與檔案合併可行，但合併時不得重啟 DevSpace OneClick；OneClick state 漂移需另行修復後才能宣告 restart-safe。**

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

### 2. OneClick state 已在本次整合前漂移

- `runtime.json` 記錄的 PID 已失效，但實際有另一個 DevSpace process 正在監聽 7678。
- `settings.json` 指向的 persistent tunnel 已不存在。
- 實際 host 中的 tunnel 是另一個 tunnel。
- 因此現行 `devspace-oneclick.ps1 status` 在整合前即會失敗；這不是本輪變更造成。

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
- 既有 `58` 個 Command 全部保留，新增 `commands/recap.md`。
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

| 範圍 | 結果 |
|---|---:|
| Manual Recap／Deterministic Capture | 8 / 8 |
| Auto Recap | 6 / 6 |
| Lazy Loading／Router／Metadata | 25 / 25 |
| DevSpace OneClick／Dev Tunnel／Skill Patch | 62 / 62 |
| Core Evolution Gates | 16 / 16 |
| **整合 worktree 合計** | **117 / 117** |

另於原始 canonical 工作區重新執行 Deterministic／Manual Recap 完整安全與併發測試：`41 / 41` 通過。

其他驗證：

- Startup payload：`11,859 bytes / 264 lines`，低於 `12,288 bytes`。
- Skill metadata：`87` 個，`0` warning。
- 實際安裝的 DevSpace `1.0.4`：`14 / 14` patch point 相容。
- Node syntax：通過。
- PowerShell parse：通過。
- `git diff --check`：通過。
- 衝突標記掃描：通過。
- 本輪新增／修改非測試檔憑證掃描：通過。

## 風險評估

### 低風險：現行 process

**觀察事實**：現行 DevSpace 與 tunnel process 使用全域套件並持續運作。

**潛在風險**：單純 Git 合併不會重啟 process；風險主要在合併後手動執行 OneClick `start`／`install`。

**建議補強**：合併期間不要停止或重新啟動現行服務。

### 中風險：新 Session 路由

**觀察事實**：新 Session 改為按需載入。

**潛在風險**：未命中關鍵詞的隱含跨 Session 問題可能少載入舊記憶。

**建議補強**：已加入近期真實語句回歸；合併後仍需開啟新的 smoke Session 驗證一般問答、進度、Recap、PCLMS、Auto／Focus mode。

### 高風險：OneClick restart state

**觀察事實**：OneClick settings／runtime 與實際 process、tunnel 已漂移。

**潛在風險**：未修復 state 前執行 OneClick `status` 或 `start` 會失敗，且無法保證自動接管目前的手動服務與 tunnel。

**建議補強**：另開維護窗口，先保留目前可用 MCP URL，再重建或修正 OneClick settings／runtime；完成後才執行受控 stop/start 與外部 MCP smoke test。

## 合併判定

### 可以執行

- 在不重啟現行 DevSpace／Dev Tunnel 的條件下，建立整合 commit 或合併 PixiuCore repository 檔案。
- 合併後開新的 AI Session 驗證 Bootstrap／Manifest 路由。

### 暫時不可執行

- 合併後立即執行 OneClick `start`、`install`、`stop` 或宣告 restart-safe。
- 在 OneClick state 未修復前，移除目前正在運作的 DevSpace／Dev Tunnel process。

## 最終結論

**本輪程式整合不會直接中斷現行 DevSpace MCP，也沒有刪除既有功能；現行本機 Dev Tunnel 修正已完整保留。**

但目前 OneClick 管理狀態早已與實際服務漂移，因此只能判定：

- **Merge-safe：是，前提是不重啟現行服務。**
- **New-session-safe：測試通過，合併後仍需 smoke session。**
- **Restart-safe：否，需先修復 OneClick state。**
