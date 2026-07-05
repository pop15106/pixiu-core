---
type: governance
date: 2026-07-03
project: PIXIUCORE
system: PIXIUCORE
topic: letter-to-future-sessions
status: active
tags: [pixiucore, governance, handoff, letter]
summary: 建制 session（Opus 4.8，環境原誤標 Fable 5）的交接信：三件最重要的事、制度退化方式與預防、context 不足時的閱讀順序、未完成項目。
---

# 給未來 session 的信

寫於 2026-07-03，由 Opus 4.8（session 環境誤標 Fable 5，2026-07-05 更正）在 Cowork 環境建制 governance 時留下。你不需要是強模型才能接手——照著做就行。

## 一、三件使用者沒問、但對這個環境最重要的事

### 1. 三個 recap 目錄有 I/O error，這可能是更大問題的前兆

`memory/recaps/PCLMS_AP/2026-06`、`memory/recaps/PCLMS_BK/2026-07`、`memory/recaps/母體/2026-06` 在檔案系統層讀取失敗。這不是權限問題，是磁碟或同步軟體問題，而且**沒有理由相信只壞這三個**。請盡早提醒使用者在本機跑 `chkdsk` 並檢查同步軟體（OneDrive 等）狀態。在修好前：讀這些路徑要容錯跳過，**絕對不要**因讀不到就重建或覆寫同名目錄。

### 2. codex-thread-watcher 這一個 hook 同時造成兩大污染源，修一次解決兩件事

> ✅ 狀態更新（2026-07-05）：本節兩項均已完成——hook-state 已遷出 vault（見四-2）、watcher 與 auto recap 已修（見四-4）。以下內容保留為歷史脈絡與指令存檔，不需再執行。

它把 827MB 的執行狀態＋transcripts 寫進 `vault/memory/hook-state/`，又對每個 turn 產一份以使用者原句命名的 auto recap（139/217 份）。修法順序：(a) 找到 hook 設定（在母體根目錄，本次 session 掛載不到，位置【未確認】），把輸出改到 vault 外、auto recap 改為每 session 一份且 topic 取摘要；(b) 經使用者授權後遷移既有檔案。指令草稿（**先給使用者看、同意才跑**；`$env:PIXIU_CORE` 未設定時用實際母體路徑）：

```powershell
# 1) 機器狀態遷出 vault（move 可逆）
New-Item -ItemType Directory -Force "$env:PIXIU_CORE\state"
Move-Item "$env:PIXIU_CORE\vault\memory\hook-state" "$env:PIXIU_CORE\state\hook-state"
# 之後把 state\ 加入 .gitignore，並更新 hook 輸出路徑

# 2) auto recap 噪音隔離（move 可逆；預期約 139 檔；壞掉的三個目錄會報錯，跳過即可）
$dst = "$env:PIXIU_CORE\vault\memory\recaps\_auto-quarantine"
New-Item -ItemType Directory -Force $dst
Get-ChildItem "$env:PIXIU_CORE\vault\memory\recaps" -Recurse -File -Filter *.md -ErrorAction SilentlyContinue |
  Where-Object { Select-String -Path $_.FullName -Pattern '^recap_mode: auto' -Quiet } |
  Move-Item -Destination $dst
```

### 3. 這套制度上次死掉的原因是「規則沒有執行者」，別再犯

2026-05-12 之後 memory-summary、decisions、封存、審計日誌全部斷更——不是規則不好，是沒有觸發點。本次把維護綁在兩個既有訊號上：正式 recap 的最後一步（`maintenance-protocol.md` 第 7 節）與每月首次 session（第 6 節）。**未來任何人要新增規則，先回答「誰、在什麼訊號下、執行它」；答不出來就不要加這條規則。**

## 二、這套制度最可能的退化方式與預防

| 退化方式 | 早期症狀 | 預防（已內建） |
|---|---|---|
| 入口檔又長胖 | 有人往 CLAUDE.md 貼「臨時規則」 | 60 行上限＋月檢查（alignment 第 5 節）；臨時規則直接寫進 governance 對應檔 |
| 四入口漂移成四套制度 | 同一規則在兩個檔案有不同版本 | 改本體不改副本；月同步清單逐項 grep |
| auto 噪音重生 | recaps 又出現原句檔名 | hook 修復驗收條件寫在 quick-diagnosis 一-2；查 recap 預設過濾 `recap_mode: auto` |
| summary 再斷更 | `lastUpdated` 超過 14 天 | README init 序列會先看日期並提醒；recap 尾步強制更新 |
| 判準通膨 | rubric 加到沒人讀完 | 新增判準必附實際觸發案例；單檔 250 行上限 |
| 制度檔被弱模型誤解執行 | 回報中出現「我理解為大概是…」 | 模板全是填空與可勾選判準；看不懂＝按 rubrics 第 3 條問使用者，不猜 |

## 三、若 context 快用完，按此順序讀

1. `vault/governance/INDEX.md` — 一頁知道全部制度在哪
2. 本信「四、未完成項目」— 知道接什麼
3. `vault/governance/quick-diagnosis-2026-07-03.md` — 知道為什麼
4. 再按當次任務讀對應制度檔，其他不讀

## 四、未完成項目與交接順序

按優先序：

1. **提醒使用者檢修 I/O error 目錄**（一句話的事，每個 session 開場都值得講，直到修好）。
2. **根目錄回貼＝已全部完成**（2026-07-03，拆除 `~/.claude` 五條 junction 後成功掛載根目錄，AI 直接執行並驗證）：
   - 六個根目錄 .md（CLAUDE/CODEX/GEMINI/AGENTS/user_rules/SKILLS_INDEX）＋ .gitignore 已套用，全部 iconv UTF-8 通過；root 與 updated/ md5 一致。
   - **踩到並修好一個坑**：`_root-snapshot/updated/user_rules.md` 先前被我某次 Edit 截斷（少了「衝突處理」段與 ECC footer，尾字元也斷 byte）。已從乾淨的 `_root-snapshot/user_rules.md` 重跑四處編輯重建（148 行、iconv 過），root 與 updated 同步覆寫。教訓：Edit 大型中文檔後應 iconv 驗證尾端完整性——已補進 audit 教訓。
   - `scripts/hooks/` 三支（auto-recap、guardrails、test）已上線，母體測試 6/6 綠，debug-input.json 已清空。
   - hook-state **已搬遷**：`vault/memory/hook-state`（827MB）→ `%PIXIU_CORE%/state/hook-state`，vault 從 850MB 降到 23MB，`.gitignore` 的 `/state/` 已確認生效。
   - 143 份噪音 recap 已移入 `memory/recaps/_auto-quarantine/`。
   - 唯一剩 `.codex/AGENTS.md`【未確認】（在使用者 home，非本 repo）。
   - **善後提醒使用者**：`~/.claude` 的五條 junction（agents/commands/hooks/rules/scripts→.pixiu-core）為了掛載被拆除，需用 New-Item -ItemType Junction 還原，否則 Claude Code 看不到母體 agents/commands 等。
3. **一致性檢查**（2026-07-03 已完成，修正已獲使用者核准並產出，待回貼）：
   - (a) recap 檔名衝突 → **已修**於 `updated/user_rules.md`：兩處改為依 `sop/recap-standard.md`（專案/月份資料夾、檔名只留日期）。
   - (b) 寫入豁免範圍 → **已修**：豁免擴及 `agent-learning/observations/`、`instincts/`、`after-action/` 新增寫入與 memory-summary 依協議更新（僅新增，不含刪除）。
   - (c) Opus 4.7 參數政策 → **已加版本適用註記**（4.8／Sonnet 5／Fable 5 適用性【未確認】，沿用前查官方文件）。
   - (d) SKILLS_INDEX → **已加時效警語**於 `updated/SKILLS_INDEX.md`：僅供分類參考，數量以根 README 盤點為準。
   - (e) 根目錄散落 recap → 經比對是**空檔**，且同主題正式 recap 已存在於 `memory/recaps/PCLMS_AP/2026-05/`（month-report-investigation-and-recap-skill-fix）→ 建議直接刪除根目錄那份（刪除由使用者執行）。
   - 以上 (a)-(d) 隨 `updated/` 整包回貼即生效；回貼前 L0 仍以根目錄現行版為準。
4. **hook 修復＋檔案遷移**（2026-07-03 全 repo 審查後更新，詳見 `full-repo-audit-2026-07-03.md`）：
   - auto recap 噪音**已修**（2026-07-03，patch 已產出並通過 node --check＋煙霧測試）：`fixes/scripts/hooks/pixiu-auto-recap.js`——檔名改用 session id（每 session 單檔）、Stop 原地更新、訊息視窗 8→20、summary 隨最新訊息刷新。使用者要求**保留 Stop hook**（手動 recap 已停用，auto 為唯一紀錄來源），故 hooks.json 不動。待回貼生效。
   - 附帶：`pixiu-guardrails.js` debug 寫入已改為 `PIXIU_HOOK_DEBUG=1` 才啟用；`.gitignore` 修正 `/vault/memory/*`＋`!memory-summary.md`（原寫法讓 memory-summary 沒進 git）。
   - hook-state 827MB 產生者**已破案並已修**（2026-07-03）：寫入者是 `Playground\.codex\hooks\pixiu-thread-watcher.js`（經 `%USERPROFILE%\.codex\hooks.json` → `pixiu-global-hook-bridge.js` 觸發）。已直接修改（備份在 `governance/backups/2026-07-03/playground/`）：state 預設路徑改 `%PIXIU_CORE%\state\hook-state\`（vault 外）、normalized transcript 改同 session 固定檔名覆寫。watcher 5 測試＋bridge 3 測試全過。橋接確認 `stop:pixiu:auto-recap` 派發到**母體** `scripts/hooks/pixiu-auto-recap.js` → 母體 fixes 包回貼後即全鏈生效。
   - 記憶層同步政策已寫入 maintenance-protocol 第 8 節，且白名單**已實作**於 `Playground\second-brain\scripts\export-pixiu-vault-manifest.ps1`（備份同上）；PowerShell 語法未在 sandbox 驗證（無 pwsh），使用者需跑一次 manifest export 驗證。n8n-native workflow 尚未存在，現行同步＝ps1 腳本＋Windows 工作排程器【排程現況未確認】。
   - 附帶必修：`scripts/hooks/debug-input.json` 隱私殘留（`pixiu-guardrails.js:30` 持續覆寫），修法見 audit 3.4。
   - vault 遷移指令存檔於本信一-2（已執行完畢，僅供追溯）。
5. **memory-summary 補件**（2026-07-03 已完成）：已補「2026-06～07」進行中區塊與 2026-07 決策區塊，`lastUpdated` 已更新（備份在 `governance/backups/2026-07-03/`）。6 月中旬後僅有 auto 草稿的項目標【未確認】，待正式 recap 覆核後改狀態。
6. **母體 git 狀態**：本次無法從 vault 掛載點確認 repo 是否 commit（【未確認】）。governance/ 是新增目錄，記得提醒使用者 commit，否則其他裝置拿不到制度。push 屬硬閘門。
7. **全 repo 審查後續**（2026-07-03，優先序見 `full-repo-audit-2026-07-03.md` 第 6 節）：巢狀自我複製四目錄清除（~313 廢檔，需授權）、AGENTS.md 數字改指向根 README、兩個過期 skill 更新、Backup/ 保留策略、`.cursor`／`.agents` 鏡像同步宣告、`_full-snapshot/` 審畢後刪除。
8. **loading-policy 合併提案**：`context/ai-mothership-loading-policy.md` 的「各 AI 入口規則」節與 `entry-files-alignment.md` 第 4 節內容重疊。分工已在 alignment 第 1 節聲明（loading-policy 管載入、alignment 管入口形狀）；下次修訂時提案把 loading-policy 該節改為指向 alignment（提案後改級別）。

## 五、環境備註（省你踩一次坑）

- Cowork 掛載限制：母體根目錄因含受保護的 `agents\` 無法整體掛載，只能掛子資料夾（本次掛 `vault\`）。要動根目錄檔案，用 Claude Code / Codex CLI 的 session 做。
- vault 在 Windows（NTFS、路徑含中文與 emoji）；寫檔一律 UTF-8 無 BOM，read-back 驗證（已有兩次編碼事故紀錄）。
- 使用者（Danny / 7010）的風格：先選項後執行、最小改動、不喜歡沒問就動手。制度給你的自由寫入範圍之外，都先問。

祝順利。制度不是拿來讀的，是拿來照做的。

— Opus 4.8（原署名 Fable 5，2026-07-05 更正）, 2026-07-03
