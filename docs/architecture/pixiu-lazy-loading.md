# PixiuCore 按需載入架構

## 目標

降低每個 Session 的固定 Context 成本，同時保留 L0 治理、安全閘門、記憶路由與能力擴充性。

## 啟動路徑

```text
入口檔
  ↓
vault/bootstrap/SESSION-BOOTSTRAP.md
  ↓
執行 scripts/router/resolve-capabilities.js
  ↓
最多 3 個 Capability 與 filesToLoad
  ↓
命中的 Skill / Context / Governance

Router 無法執行時，才以 `vault/capabilities/capability-manifest.json` 作降級索引。Manifest 是磁碟資料源，不列入正常 Session 常駐內容。
```

一般 Session 不再自動全文載入：

- `user_rules.md`
- `vault/identity/*`
- `vault/memory/memory-summary.md`
- recap 與 decisions
- `vault/governance/*` 全部制度
- 所有 Skills、Workflows、Hooks 與 Agents
- `skills/opus-behavior-core/SKILL.md`

完整 `user_rules.md` 仍是 L0 憲法唯一來源。Bootstrap 只保留高頻硬閘門摘要；遇到衝突、高風險操作、審批例外或特殊 Hook 時，再讀對應原文。

## Capability Router

命令：

```powershell
node scripts/router/resolve-capabilities.js "確認 PCLMS L1 排程碰到 CL998 會怎麼做"
```

輸出包含：

- `capabilities`：本次命中的能力，最多 3 個
- `filesToLoad`：實際需要讀取的檔案
- `reasons`：命中的關鍵字
- `degraded`：Manifest 是否無法使用

Manifest 缺失或損壞時，路由器只回傳空能力與錯誤訊息，不會退回全量掃描。

## Skill Discovery 與 Collision

PixiuCore 目前保留兩個 Skill 發佈層：

- `skills/`：Pixiu／共用來源
- `.agents/skills/`：OpenAI／Codex 可攜發佈層

兩層有大量同名 Skill。量測器將其標為 `skillNameCollisions`，用來揭露 package duplication。

DevSpace 在「直接開啟 PixiuCore repository」時，也會同時發現：

- 使用者全域 `~/.agents/skills`
- worktree 內 `.agents/skills`

未套用補丁時，DevSpace 的 workspace metadata 會出現同名 collision；這是宿主 discovery 行為，不等於 Skill 全文進入 LLM Context。套用 Pixiu canonical suppression 後，主 checkout 的 raw collision 仍可量測為 87，但有效 discovery collision 為 0。一般業務專案不含 PixiuCore 的 `.agents/skills`，只會使用全域入口。

DevSpace 1.0.4 的實際 discovery 實作位於 `dist/skills.js`。預設固定合併：

1. `~/.agents/skills`
2. `<workspace>/.agents/skills`
3. DevSpace 自有 skills
4. Agent directory skills
5. `DEVSPACE_SKILL_PATHS` 額外路徑

`DEVSPACE_SKILL_PATHS` 只有追加語意；DevSpace 1.0.4 沒有 project skill exclude 或覆寫預設 roots 的設定。

OneClick 安裝器已加入版本鎖定補丁：一般專案只有在 `<workspace>/.agents/skills` 內每個 Skill 的名稱與 SHA-256 內容都被較早來源完整涵蓋時，才略過 project-local 鏡像；若有獨有 Skill、同名不同內容或讀取失敗，均 fail-open 保留專案能力。

PixiuCore 本體另有嚴格特例：workspace 必須存在 `vault/bootstrap/SESSION-BOOTSTRAP.md`，較早的全域 Skill root 實體路徑必須正是該 workspace 的 `skills/`，且 canonical 名稱全集涵蓋 `.agents/skills`。只有三項都成立，才把 `.agents/skills` 視為 portable 發佈層並略過，即使發佈內容有漂移也以 canonical `skills/` 為準。一般專案與非 canonical worktree 不套用此特例。

## 記憶策略

Session 啟動只在需要跨 Session 資訊時讀：

```text
vault/memory/SESSION-INDEX.md
  ↓
命中的 recap / decision / memory-summary 原文
```

Repo 原始碼與正式文件仍是事實來源；第二大腦與 Session Index 只負責定位。

## 驗證

```powershell
powershell -ExecutionPolicy Bypass -File scripts/performance/run-lazy-loading-tests.ps1
```

驗收門檻：

- 啟動常駐內容不超過 8 KB；目前主 checkout 為 `6,705 bytes / 124 lines`
- 報告同時顯示 raw collision 與套用 canonical suppression 後的 effective collision；目前為 `87 / 0`
- Manifest 引用路徑全部存在
- Skill YAML 警告為 0
- 普通需求未命中時不載入 Skill
- PCLMS、Recap、Security 等代表性需求可正確路由

## 部署

1. 合併分支後重新開啟 Codex／Claude／Gemini Session。
2. 若全域入口是 junction，母體更新會直接生效；若是複製安裝，需重新執行對應 setup script。
3. 執行完整驗證腳本。
4. 開啟五類 smoke session：一般問答、PCLMS、實作、Recap、Agent Team。

## 回滾

Lazy Loading 變更均集中在入口檔、Bootstrap、Manifest、Router 與 Memory Index。若部署後發生不相容：

1. 回滾本分支相關 commits，或將入口檔恢復到合併前版本。
2. 保留 `scripts/performance/` 與 metadata validator，不影響 runtime。
3. 重新開啟 Session，確認舊 init sequence 恢復。
4. 不刪除 Skills、Vault、recap 或 decisions。
