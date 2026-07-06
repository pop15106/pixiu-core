---
type: governance-index
date: 2026-07-03
project: PIXIUCORE
system: PIXIUCORE
topic: governance-index
status: active
tags: [pixiucore, governance, index, routing]
summary: 制度總路由：什麼情境讀哪份制度檔。所有 AI 入口檔只需指向本檔。
---

# Governance INDEX — 制度總路由

> Session 開始讀完 `vault/README.md` 後讀本檔（不到 80 行）。其餘制度檔**按情境載入，不要全部讀完**。

## 位階

位階表與衝突處理只有一個版本：`entry-files-alignment.md` 第 3 節。最上位是使用者本次指令與母體 `user_rules.md`（L0），本 governance 位階在其下。

## 情境路由表

| 你正要做的事 | 讀這份 |
|---|---|
| 派工給 subagent、選模型、定驗收 | `model-dispatch-rules.md`＋`delegation-templates.md`（套模板） |
| 拿不準：要不要問使用者／算不算完成／要不要升級／方向對不對 | `judgment-rubrics.md` |
| 踩坑了、想記東西、想改 vault 檔案 | `maintenance-protocol.md`（第 1 節權限分級、第 2 節教訓迴路） |
| 每月首次 session、或使用者說「做月維護」 | `maintenance-protocol.md` 第 6 節 |
| 要動任何 AI 入口檔（CLAUDE/CODEX/GEMINI/AGENTS.md） | `entry-files-alignment.md` |
| 寫程式、修 bug、重構前判斷要做到多大／是否新增依賴、檔案、agent team | `minimal-implementation-ladder.md` |
| 接手上一個 session 的工作、或 context 快用完 | `letter-to-future-sessions.md` |
| 想知道這套制度為什麼長這樣 | `quick-diagnosis-2026-07-03.md`（背景，非必讀） |
| 載入政策、L1-L6 語意路由、agent team 閘門 | `../context/ai-mothership-loading-policy.md`（既有政策，仍有效） |
| 需要專案背景（PCLMS、技術棧） | 照 `vault/README.md` init 序列讀 `../context/pclms-overview.md`、`../context/tech-stack.md`——專案背景歸 context，行為制度歸 governance |

## 五條常駐提醒（操作細節仍在對應制度檔，這裡只是防忘）

1. 搜尋與索引一律排除 `vault/memory/hook-state/`。
2. 刪檔、DB 寫入、git push、改 `user_rules.md`／`identity/`／入口檔／hook：必先取得使用者授權。
3. 讀不到的檔案標【未確認】，不憑印象編造；讀到 I/O error 只記錄跳過，禁止重建同名目錄。
4. 長產物落檔傳路徑，主對話只留結論、決策、風險、下一步。
5. 正式 recap 的最後一步＝更新 `memory-summary.md`（怎麼更新：`maintenance-protocol.md` 第 7 節）。

## 檔案清單

| 檔案 | 內容 | 更新頻率 |
|---|---|---|
| `INDEX.md` | 本檔，總路由 | 新增制度檔時 |
| `quick-diagnosis-2026-07-03.md` | 2026-07-03 vault 健檢快照 | 不更新（下次健檢開新檔） |
| `full-repo-audit-2026-07-03.md` | 2026-07-03 全 repo 審查（skills/agents/hooks 等） | 不更新（下次審查開新檔） |
| `entry-files-alignment.md` | 入口檔路由制度＋各檔最小路由文字 | 低 |
| `minimal-implementation-ladder.md` | 實作前最小化梯：反過度工程、少依賴、少 token，但不覆蓋安全與驗證 | 低 |
| `model-dispatch-rules.md` | 派工、模型、回報、升降級、驗證 | 型號對照節常更新，其餘低 |
| `judgment-rubrics.md` | 七類判斷的判準/正例/反例/動作 | 低 |
| `delegation-templates.md` | 五型派工模板＋失敗軌跡格式 | 低 |
| `maintenance-protocol.md` | 權限分級、教訓迴路、衛生、月維護 | 低 |
| `letter-to-future-sessions.md` | 交接信：未完成項目與退化預防 | 交接時 |
| `backups/` | 修改既有檔前的備份 | 每次修改前 |

## 本檔維護

新增／移除制度檔時同步更新上表（先備份再改級別）。本檔上限 80 行，超過表示路由做錯了——內容應該在制度檔裡，不在這裡。
