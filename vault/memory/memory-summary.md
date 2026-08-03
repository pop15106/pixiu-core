---
type: memory
readAt: on-demand
lastUpdated: 2026-07-30
tags: [memory, pixiucore]
---

# Memory Summary — 最新記憶快照

> 此檔案是跨 session、跨 AI 的共用記憶。
> 每次重要決策或架構變更後請更新。
> AI 每次 session 必讀，確保不需要重新交代背景。
> 詳細 recap 見 [[🏠 Dashboard]] 或 `vault/memory/recaps/` 目錄。

---

## 目前狀態（2026-07-27）

### 進行中的工作

#### 2026-06 ～ 2026-07

> 註：2026-05-15 至 2026-07-02 期間無正式 recap（僅 auto 草稿），下表部分列標【未確認】，來源為 auto recap，狀態待正式確認。

| 日期 | 狀態 | 主題 | 摘要 | 連結 |
|---|---|---|---|---|
| 2026-07-30 | 已完成 | Side Effect Receipt Gate 完成與推送 | Side Effect Receipt Runtime P0 Gate 已完成驗證與推送，遠端 main 基線為 a486ebe，下一步接續 Key Ring Rotation 或 Artifact Evidence。 | [[vault/memory/recaps/NEED_TO_KNOW_AI/2026-07/2026-07-30-NEED_TO_KNOW_AI-side-effect-receipt-gate.md\|recap]] |
| 2026-07-28 | 部分完成 | PixiuCore AI 工作流 1 至 5 執行 | Workflow Lab 真實 Codex 角色鏈與 Agent Learning Phase 3–5 已完成；全域入口套用、受控重啟、Claude／Gemini Fresh Session 與 Git 交付仍受外部環境邊界阻擋。 | [[vault/memory/recaps/母體/2026-07/2026-07-28-母體-AI工作流1至5執行.md\|recap]] |
| 2026-07-28 | 追蹤中 | PixiuCore AI 工作流未完成盤點 | 本機核心與測試全綠；待完成全域入口套用與提交、Workflow Lab 合併與 Live smoke、受控重啟 OAuth、Agent Learning 後續與第二大腦 live 驗證。 | [[vault/memory/recaps/母體/2026-07/2026-07-28-母體-AI工作流未完成盤點.md\|recap]] |
| 2026-07-28 | 已驗證 | Crypto Market Signal Phase 2 完成驗證 | Phase 2 本機功能與安全驗證完成，Codex OAuth canary 已對齊指定模型並通過；Polymarket live canary 仍受本機 DNS 與 TLS 信任鏈攔截。 | [[vault/memory/recaps/CRYPTO_MARKET_SIGNAL/2026-07/2026-07-28-CRYPTO_MARKET_SIGNAL-Phase2完成驗證.md\|recap]] |
| 2026-07-27 | 追蹤中 | Crypto Market Signal Phase 2 完成與後續缺口 | Phase 2 新聞、Codex OAuth 分析覆核、受保護 API 與 Telegram long polling 已驗證；尚缺 Phase 1 真實資料與 V2 契約、Phase 3 前端 E2E，以及本地 commit | [[vault/memory/recaps/CRYPTO_MARKET_SIGNAL/2026-07/2026-07-27-CRYPTO_MARKET_SIGNAL-Phase2完成與後續缺口\|recap]] |
| 2026-07-27 | 追蹤中 | Bruno Telegram Live Bridge | 正式白名單、Codex CLI OAuth 回覆與真實 inbound E2E 已通過；只剩 Windows Task Scheduler 實際安裝 | [[vault/memory/recaps/BRUNO_BUTLER/2026-07/2026-07-27-BRUNO_BUTLER-Telegram-live-bridge\|recap]] |
| 2026-07-27 | 追蹤中 | Bruno Butler 離線核心驗證與提交待辦 | 離線核心、GPS／OwnTracks 與品質閘門全綠；僅剩本地 Git commit，真實外部部署維持未啟用 | [[vault/memory/recaps/BRUNO_BUTLER/2026-07/2026-07-27-BRUNO_BUTLER-離線核心驗證與提交待辦\|recap]] |
| 2026-07-27 | 已完成並推送；重啟 smoke 待維護窗口 | AI Workflow 收斂＋Web 測試控制台 | Router-first Lazy Loading、Manual Recap deterministic capture、Agent Learning Phase 1/2、OneClick no-restart state repair 已進入 master；新增 localhost Web UI，可分別執行六模組與完整整合測試。最新直接驗證：Core 16/16、Manual 41/41、Auto 6/6、Lazy 30/30、OneClick 77/77、Console 10/10、Web API integration 全綠；尚待受控 stop/start＋OAuth smoke 與跨工具 Fresh Session 矩陣 | [[docs/superpowers/specs/2026-07-27-pixiucore-test-console-design\|測試控制台設計]] |
| 2026-07-07 | 已完成 | Codex 治理對齊＋合併上 master＋日結時序修正 | Codex 端四道 guardrails 確認全註冊（走 bridge 呼叫母體同一份 js，今天修的版本自動生效）；本輪工作合併回 master（雙向分歧 6 vs 17，用 -X theirs 保住 cybersecurity 754 skills＋架構圖，可攜性閘門過）；daily-digest prompt 修時序（改掃昨天＋強制實掃＋去識別化），治掉普遍誤判「無來源」 | [[skills/INDEX\|skills 分層]] |
| 2026-07-05 | 已完成 | Governance 覆核＋hook 攔截鏈修復 | fresh-context 覆核通過；auto-recap 跨日單檔＋去識別化（測試 6/6）；guardrails 補密鑰樣式＋PowerShell、secret-scan／mothership-sync 兩個死 hook 修活（tool_response 正確欄位＋JSON decision 回饋）；實測打通 auto-mode 閘門（斷點：settings.json 副本漂移）；alignment 第 5 節新增 hook 副本對照；skills 分層完成（8 常駐＋81 參考層 disable-model-invocation）＋`skills/INDEX.md` 單一真源索引 | [[2026-07-05-PIXIUCORE-claude-code-hooks-effective-config-is-settings-json\|observation]] |
| 2026-07-03 | 已完成 | Governance 制度建立 | `vault/governance/` 九檔落地；四入口檔＋user_rules 修訂版已於 2026-07-03 回貼生效 | [[vault/governance/INDEX\|governance/INDEX]] |
| 2026-07-03 | 已修復（2026-07-05） | recaps 三目錄 I/O error | chkdsk 重開機檢查修復，三目錄可讀；復活目錄殘留 ~170 份噪音 recap 已隔離，疑似憑證檔交使用者改密／刪除（git 未曾納管） | [[vault/governance/quick-diagnosis-2026-07-03\|quick-diagnosis]] |
| 2026-07-03 | 已完成 | hook-state 遷移＋auto recap hook 修復 | 827MB 已遷出 vault（→ state/）、143 份噪音 recap 已隔離；watcher 與 auto-recap 已修 | [[vault/governance/letter-to-future-sessions\|letter]] |
| 2026-06-08 | 已完成 | gravityTest 全專案盤點 | 18 個專案 full-analysis 與 module-flow inventory 已落檔 | [[vault/projects/gravityTest/index\|gravityTest index]] |
| 2026-06-05 | 分析完成 | PCLMS decltype T balance | 「多加沒扣」根因完整分析＋SA review 已落檔 | [[2026-06-05-PCLMS-decltype-T-balance-多加-沒扣-完整分析]] |
| 2026-06-16 | 【未確認】 | 第二大腦 → kc-wiki 評估 | 評估以 kc_llm_wiki 取代／搭配第二大腦，僅 auto 草稿 | |
| 2026-06-26 | 【未確認】 | PEPIS FedEx 827 系列 | 授權通知、transcode 827、四個設定檔調整等，僅 auto 草稿，待正式 recap | |

#### 2026-05

| 日期         | 狀態  | 主題                | 摘要                                        | 連結                                                     |
| ---------- | --- | ----------------- | ----------------------------------------- | ------------------------------------------------------ |
| 2026-06-03 | 已完成 | PEPIS menu endpoint 調查 | 確認無 query 參數、tepis 舊 WAR 原因、log 加入後註解 | [[2026-06-03-PEPIS-menu-endpoint-調查與log]] |
| 2026-05-18 | 資料修正待辦 | PCLMS_BK L4 舊格式封包 | 已確認客戶使用舊格式 L4，PM 暫不修流程，改走人工資料修正 | [[2026-05-18-142719-pclms-bk-l4-t1-procedure-pending-recap]] |
| 2026-05-13 | 可測試 | 第二大腦 n8n UI workflow | Code node 版可在 UI publish | [[2026-05-13-000000-second-brain-n8n-ui-publish-workflow]] |
| 2026-05-13 | 已完成 | PISSO 架構分析 | psaab + tv-isso-api 雙專案完整分析，發現 5 項高風險 | [[2026-05-13-PISSO-psaab-tv-isso-api-架構分析]] |
| 2026-05-12 | 可推送 | 第二大腦 GitHub 部署 | 一鍵部署與 release 檢查完成 | [[2026-05-12-123000-second-brain-github-one-click-deploy]] |
| 2026-05-12 | 可用 | 第二大腦 NVIDIA API | 全量索引完成，Qdrant 204 points | [[2026-05-12-114315-second-brain-full-index-and-ops]] |
| 2026-05-11 | 待修復 | PCLMS_BK TS/L8 收訊 | 根因為 PFTZZB pool 帳密失效                      | [[2026-05-11-PCLMS-BK-TS-L8-無法收訊調查]]                   |
| 2026-05-06 | 待修正 | PCLMS_AP 庫存核銷     | 已完成唯讀清查，下一步排修交易邊界                         | [[2026-05-06-PCLMS_AP庫存核銷手動調整根因清查]]                    |
| 2026-05-05 | 待驗證 | PEPIS eDDA 3.4    | Vue bug 已修，待重啟部署驗證                        | [[2026-05-05-PEPIS-eDDA-3.4-Bug修復]]                    |
| 2026-05-04 | 已完成 | PixiuCore README  | gravityTest README 已翻修為現況入口               | [[2026-05-04-142717-PixiuCore-README更新]]               |
| 2026-05-04 | 已調查 | PCLMS 彙報孤兒表頭      | 已確認 `month` 有表頭但缺 `outdetail`             | [[2026-05-04-100000-PCLMS彙報出倉孤兒表頭與未確認報單調查]]            |
| 2026-05-04 | 已完成 | Recap 跨專案回寫       | 已強化 skill / rules，recap 必須回寫母體 vault      | [[2026-05-04-191150-PEPIS-3.4查詢修改與Recap跨專案回寫]]         |

> [!archive]- 2026-04
>
> | 日期 | 狀態 | 主題 | 摘要 | 連結 |
> |---|---|---|---|---|
> | 2026-04-29 | 已完成 | Spec Improve | 新增獨立 spec 審查技能 | [[2026-04-29-151239-Spec-Improve技能新增同步]] |
> | 2026-04-29 | 已完成 | SAST triage | MVP 加入保守 triage 規則 | [[2026-04-29-121857-Pixiu-Auto-Research-SAST-triage規則]] |
> | 2026-04-29 | 已完成 | Auto Research MVP | 建立無 API 手動評分 MVP | [[2026-04-29-112703-Pixiu-Auto-Research-MVP實作落地]] |
> | 2026-04-29 | 已完成 | Manual Scoring | 產 Markdown 給 Codex 手動評分 | [[2026-04-29-105958-Pixiu-Auto-Research-Manual-Codex-Scoring]] |
> | 2026-04-29 | 待審閱 | Auto Research Core | 完成通用核心 + plugin 方案 | [[2026-04-29-105025-Pixiu-Auto-Research-Core實作方案]] |
> | 2026-04-29 | 已完成 | Agent Team 閘門 | 需求前先判斷是否建議啟用 agent team | [[2026-04-29-102717-Agent-Team前置判斷硬閘門]] |
> | 2026-04-27 | 已完成 | CCA-F 教材 | 產出書籍化 DOCX 與 PDF 驗證 |  |
> | 2026-04-27 | 已完成 | DOCX 工具鏈 | 沉澱 `make-docx` 與中文編碼避坑 |  |
> | 2026-04-21 | 待執行 | OpenSpec 導入 | 架構設計完成，Phase 1-3 待執行 | [[2026-04-21-111300-OpenSpec導入規劃]] |
> | 2026-04-20 | 待 push | PixiuCore 母體維護 | 雙向同步完成，gravityTest 待 git push | [[2026-04-20-母體雙向同步 1]] |
> | 2026-04-20 | 已盤點 | PCLMS L1/L4/N1C | 已釐清訊息傳送規則與 N1C 實測 |  |

### 最近重要決策

#### 2026-07

| 日期 | 主題 | 摘要 | 連結 |
|---|---|---|---|
| 2026-07-27 | 本機測試控制台安全邊界 | 採 Node 內建模組、只監聽 `127.0.0.1`、固定白名單 executable/args、同源 token、單一 active run；不建立任意命令 Web Terminal、不新增 npm 依賴 | [[docs/superpowers/specs/2026-07-27-pixiucore-test-console-design\|設計]] |
| 2026-07-13 | PCLMS_AP 資料庫刪除還原 SQL 流程 | DD630/CBB2135790B097 案：先 SELECT 驗證筆數（271 筆）確認無誤才分段執行 DELETE／還原，不整段直接跑（日審升格） | [[2026-07-13-PCLMS_AP-資料庫刪除還原SQL驗證流程]] |
| 2026-07-13 | PCLMS_AP L6 移倉異常修復與回退 | 情境三/四出現保證金核扣金額異常與 IndexOutOfBoundsException；先修法加註記，複測未過前先暫停回原分支不上版（日審升格） | [[2026-07-13-PCLMS_AP-L6移倉異常修復與回退決策]] |
| 2026-07-08 | Second Brain 一鍵建立檢核規格 | 每個檢核附清楚說明、失敗時指出哪個步驟失敗（07-07 使用者指定，日審升格） | [[2026-07-08-SECOND_BRAIN-one-click-setup-check-failure-reporting]] |
| 2026-07-07 | 日結掃昨天不掃今天 | daily-digest 掃「今天」會撞時序（當天 recap 未齊）＝普遍誤判無來源；改為掃昨天＋強制先實掃列檔＋輸出去識別化 | [[scripts/scheduled/codex-daily-digest-prompt\|digest prompt]] |
| 2026-07-07 | hook-state 不納入審查 | Codex recap 成品已進 memory/recaps 被審；hook-state 是含對話原文的原料，維持排除索引（隱私＋制度） | |
| 2026-07-05 | Hook 生效點 | Claude hooks 實際生效在 `~/.claude/settings.json`，repo `hooks/hooks.json` 為本體範本；改 hook 行為兩邊都要動，月維護加雙邊對照 | [[vault/governance/entry-files-alignment\|alignment 第5節]] |
| 2026-07-03 | Governance 制度 | 制度本體集中 `vault/governance/`，入口檔只留路由；判準、派工、維護規則外化給弱模型執行 | [[vault/governance/entry-files-alignment\|entry-files-alignment]] |
| 2026-07-03 | user_rules 修訂案 | recap 檔名對齊 sop（去時間戳）、寫入豁免擴及 agent-learning／after-action、Opus 4.7 參數加版本註記；已於 2026-07-03 回貼生效 | [[vault/governance/letter-to-future-sessions\|letter]] |

#### 2026-05

| 日期 | 主題 | 摘要 | 連結 |
|---|---|---|---|
| 2026-06-03 | PEPIS menu 調查 | 取 menu 無 query 參數，tepis 打舊 endpoint 是因為 WAR 未重部署 | [[2026-06-03-PEPIS-menu-endpoint-調查與log]] |
| 2026-05-13 | PISSO 架構分析 | xdao.xml 明文密碼、DMI/OGNL RCE、log4j 1.x 為三大高風險 | [[2026-05-13-PISSO-psaab-tv-isso-api-架構分析]] |
| 2026-05-12 | 第二大腦 GitHub 化 | 採 `deploy.ps1` + 本機 `.env`，禁止寫死路徑 | [[2026-05-12-second-brain-github-one-click-deploy]] |
| 2026-05-12 | 第二大腦先查規則 | 跨 Codex / Claude / Gemini 啟用先查第二大腦 | [[2026-05-12-second-brain-first-lookup-rule]] |
| 2026-05-12 | 第二大腦 NVIDIA API | API 驗證與全量索引完成，UTF-8 已修 | [[2026-05-12-114315-second-brain-full-index-and-ops]] |
| 2026-05-11 | 第二大腦落地策略 | 先 n8n + Markdown，再接 Qdrant / NVIDIA embedding | [[2026-05-11-181044-n8n-qdrant-vault-nvidia-api-progress]] |
| 2026-05-04 | PixiuCore README | 採短版現況入口文件 | [[2026-05-04-142717-PixiuCore-README更新]] |
| 2026-05-04 | Recap 觸發規則 | User-triggered Recap 必須寫入 `vault/memory/recaps` | [[2026-05-04-191150-PEPIS-3.4查詢修改與Recap跨專案回寫]] |
| 2026-05-04 | Recap 跨專案規則 | 任一 repo / cwd 觸發 recap 都回寫 PixiuCore vault | [[2026-05-04-191150-PEPIS-3.4查詢修改與Recap跨專案回寫]] |
| 2026-05-04 | PCLMS 彙報判斷 | 區分出倉明細彙整與報單號確認 | [[2026-05-04-100000-PCLMS彙報出倉孤兒表頭與未確認報單調查]] |

> [!archive]- 2026-04
>
> | 日期 | 主題 | 摘要 | 連結 |
> |---|---|---|---|
> | 2026-04-30 | eDDA 3.4 UI | 查詢修改依狀態控欄位 | [[2026-05-05-PEPIS-eDDA-3.4-Bug修復]] |
> | 2026-04-29 | Spec Improve | 新增獨立 `spec-improve` | [[2026-04-29-151239-Spec-Improve技能新增同步]] |
> | 2026-04-29 | Auto Research SAST | 採保守規則型 triage | [[2026-04-29-121857-Pixiu-Auto-Research-SAST-triage規則]] |
> | 2026-04-29 | Auto Research MVP | 獨立子專案，先做最小閉環 | [[2026-04-29-112703-Pixiu-Auto-Research-MVP實作落地]] |
> | 2026-04-29 | Manual Codex Scoring | 無 API 階段先產 Markdown 給 Codex 手動評分 | [[2026-04-29-105958-Pixiu-Auto-Research-Manual-Codex-Scoring]] |
> | 2026-04-29 | Auto Research Core | 通用核心 + Domain Plugin | [[2026-04-29-105025-Pixiu-Auto-Research-Core實作方案]] |
> | 2026-04-29 | Agent Team 硬閘門 | 需求前先判斷是否建議啟用 agent team | [[2026-04-29-102717-Agent-Team前置判斷硬閘門]] |
> | 2026-04-27 | DOCX 驗證流程 | 改用 Word COM + PDF 檢查 |  |
> | 2026-04-27 | DOCX 書籍化標準 | 教材型文件採封面 + Word TOC + PDF 驗證 |  |
> | 2026-04-27 | DOCX 工具鏈 | 更新 `make-docx` skill 與 reusable script |  |
> | 2026-04-20 | PCLMS 訊息規則 | 完成 L1/L4/N1C 對照 |  |
> | 2026-04-20 | N1C Log 診斷 | `has not exist` 為重複搬移誤報 |  |
> | 2026-04-20 | 決策寫入流程 | 採獨立 decision 檔 + summary 索引 |  |
> | 2026-04-20 | PPOST 件數修正 | 顯示變數改為 `_DeclNoHwbDt` |  |
> | 2026-04-20 | PCLMS 彙報待確認 | 先補原進倉報單與項次 |  |
> | 2026-04-20 | 母體同步策略 | gravityTest 作為 git 版本基底 |  |
> | 2026-04-20 | Obsidian 整合 | recap 獨立檔 + Dataview Dashboard |  |
> | 2026-04-20 | PCLMS bug 修法 | 驗證 `executeUpdate` + rollback |  |
> | 2026-04-16 | Vault 架構 | PixiuCore 建 `vault/` 作共用記憶母體 |  |

### 已確認的技術約束

- PCLMS_AP 庫存核銷問題需同查交易邊界、`clearStore`、出/進倉修改、月彙報 key、加工/報廢與測試退料流程；不可只看單一 `outstatus` 或單一 servlet。
- PCLMS DB schema 不可大改
- Java 版本維持現有（非 Java 8 以上需確認）
- 分支策略：`feature/*` → `r_sit` → `r_uat` → `master`

### 踩坑紀錄

#### 2026-05

| 日期 | 坑 | 解法 |
|---|---|---|
| 2026-05-12 | PowerShell `$i:` 插值會壞 | 改用 `$($i)` |
| 2026-05-12 | Qdrant / PowerShell UTF-8 | helper 改用 UTF-8 JSON request / response |
| 2026-05-12 | Qdrant collection 已存在會讓 smoke test 失敗 | 腳本先檢查 collection，保持 idempotent |

> [!archive]- 2026-04
>
> | 日期 | 坑 | 解法 |
> |---|---|---|
> | 2026-04-29 | PATH 無 `python` 且 bundled Python 缺 `yaml` | 明確指定 runtime，必要時補 PyYAML |
> | 2026-04-29 | Node ESM path 產生 `C:\C:\...` | 用 `fileURLToPath(import.meta.url)` |
> | 2026-04-29 | sandbox 下 Node spawn 可能 EPERM | smoke test 直接呼叫核心函式 |
> | 2026-04-29 | artifact-tool / LibreOffice / PDF.js 不穩 | DOCX 驗證改用 Word COM + `pypdf` |
> | 2026-04-27 | Chrome headless PDF 截到空白 viewer | 不作為最終驗證 |
> | 2026-04-27 | DOCX 重複 Heading styleId | 用乾淨 DOCX 重建，不手改 styles.xml |
> | 2026-04-27 | PowerShell pipe 中文亂碼 | 改用 UTF-8 檔案 |
> | 2026-04-23 | AI 跳過母體連結聲明 | 新任務第一句聲明 PixiuCore 母體 |
> | 2026-04-20 | `/recap` slash command 可能被過濾 | 用純文字 `recap` 或「現在到哪了」 |
> | 2026-04-20 | `cp -r` 產生雙層路徑 | 改用 `cp -rn src/. dst/` |

---

## 更新指引

每次 session 結束前，若有以下情況請更新：
- 做了架構級決策 → 同時建立 `vault/memory/decisions/` 獨立檔案
- 發現新的技術約束
- 解決了重要 bug 或踩了新坑
- 待辦事項有重大變更

**詳細 recap 請存為獨立檔案**：`vault/memory/recaps/<專案或母體>/<YYYY-MM>/YYYY-MM-DD-專案-內容.md`（用 Templater 模板；檔名只保留日期，不加入時分秒）
## Memory Summary 格式規則

- `memory-summary.md` 是索引型摘要，不是 recap 全文；不要把完整調查、完整規劃或完整踩坑內容搬進來。
- 近期每個動作 / 決策 / 踩坑仍要保留一列，讓使用者能從 summary 看到近期每個動作。
- 表格優先保留，但每格只放短句；詳細內容用 recap / decision 連結回查。
- 當月內容展開顯示；過去月份依 Dashboard 寫法用 Obsidian callout 摺疊，例如 `> [!summary]- 📅 2026年4月 ...`。
- 若需要動態表格，優先沿用 `🏠 Dashboard.md` 的 Dataview TABLE 寫法；若手寫表格，避免長段落塞進欄位。
