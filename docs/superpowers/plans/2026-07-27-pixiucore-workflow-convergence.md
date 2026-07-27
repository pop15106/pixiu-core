# PixiuCore AI Workflow Convergence Implementation Plan

- 執行狀態：整合已進入 `master`，後續強化、Web 測試控制台與遠端交付由 `docs/superpowers/plans/2026-07-27-pixiucore-test-console.md` 追蹤
- 整合基底：`origin/master` @ `b0bb5af`
- 執行歷程：先在 DevSpace managed worktree 整合與驗證，再於 2026-07-27 收斂至 `C:\PixiuCore` 的 `master`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The user explicitly prohibited agent teams and all subagents, so every step must run inline in the current session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將遠端最新 Core Evolution Gates、Agent Learning Phase 1/2 與 PixiuCore Lazy Loading 安全收斂成單一、可驗證、可部署的整合版本。

**Architecture:** 以 `origin/master` 的 `b0bb5af` 為乾淨基底，在 DevSpace 管理的隔離 worktree 整合。記憶管線採正式 manual recap 單一入口，依序執行 recap 原件、memory summary、deterministic capture；Lazy Loading 採 Bootstrap、Capability Manifest、Router 與 Session Index，並保留 Core Evolution 與 DevSpace 現有功能。所有重疊檔案以測試契約合併，不直接覆蓋其中任一版本。

**Tech Stack:** Node.js、PowerShell 5.1、Git worktree、Markdown／Obsidian vault、DevSpace OneClick。

## Global Constraints

- 不啟用 agent team、任何子代理或平行派工。
- 不修改原始 `C:\PixiuCore` dirty checkout；只在本隔離 worktree 寫入。
- 不執行 Git push、遠端建立或部署。
- 不安裝套件或新增外部依賴。
- 保留 `origin/master` 的 Core Evolution Gates 與 DevSpace 49 項基線行為。
- 所有 secret、原始 transcript、本機敏感絕對路徑不得寫入 observation、recap、log 或 CLI error。
- Lazy Loading 啟動 payload 必須不超過 12 KB；Manifest 路徑必須存在；Skill metadata warning 必須為 0。
- Manual recap 必須 fail closed，固定採 recap → memory-summary → deterministic capture，且 observation 每次最多 0–3 筆。

---

## File Map

### Agent Learning / Recap

- `commands/recap.md`：正式 manual recap 指令入口。
- `commands/go.md`：驗證流程完成後使用 canonical recap 路徑。
- `scripts/hooks/pixiu-manual-recap.js`：原子寫 recap、同步 memory summary、觸發 deterministic capture。
- `scripts/hooks/pixiu-deterministic-capture.js`：從正式 manual recap 萃取 0–3 筆 observation。
- `scripts/hooks/pixiu-deterministic-capture.test.js`：安全、併發、冪等、路徑與 CLI 回歸測試。
- `scripts/hooks/pixiu-auto-recap.js`：維持 `draft-auto` 候選 lane，不直接升級 observation。
- `scripts/codex-bridge/pixiu-thread-watcher.js`：維持 Auto Recap 轉接職責，不直接觸發正式 deterministic capture。
- `skills/pixiu-session-recap/SKILL.md`：正式 manual recap 行為契約。
- `vault/memory/agent-learning/**`：Phase 1 目錄、三筆 observation、verifier checklist。
- `vault/templates/agent-observation-template.md`：Observation schema。

### Lazy Loading

- `vault/bootstrap/SESSION-BOOTSTRAP.md`：低 Token 常駐硬閘門。
- `vault/capabilities/capability-manifest.json`：能力與按需檔案路由。
- `scripts/router/resolve-capabilities.js`：最多三個能力的 fail-safe router。
- `scripts/skills/validate-skill-metadata.js`：Skill metadata validator。
- `scripts/performance/**`：啟動 payload 與代表性路由驗證。
- `vault/memory/SESSION-INDEX.md`：跨 Session 記憶短索引。
- `AGENTS.md`、`CLAUDE.md`、`CODEX.md`、`GEMINI.md`、`.codex/AGENTS.md`、`vault/README.md`、`user_rules.md`：入口改為 Bootstrap／Manifest 按需載入。
- `docs/architecture/pixiu-lazy-loading.md`：架構、部署與回滾說明。

### DevSpace 重疊整合

- `scripts/devspace-portable/DevSpace.OneClick.Subagents.psm1`：Skill 鏡像抑制與安全還原功能。
- `scripts/devspace-portable/DevSpace.OneClick.Core.psm1`：保留 Core Evolution 後的 tunnel／timeout 修正。
- `scripts/devspace-portable/devspace-oneclick.ps1`：同時保留最新 action 與 lazy-loading patch restore action。
- `scripts/devspace-portable/tests/run-tests.ps1`：保留原 49 項並加入鏡像抑制／還原測試。
- `scripts/devspace-portable/README.zh-TW.md`：記錄補丁與競態邊界。

---

### Task 1: Baseline and Source Contract

**Files:**
- Create: `docs/superpowers/plans/2026-07-27-pixiucore-workflow-convergence.md`

**Interfaces:**
- Consumes: `origin/master`、`perf/pixiu-lazy-loading`、`C:\PixiuCore` staged Phase 1/2、既有 Phase 2 isolated worktree。
- Produces: 明確整合順序與驗收命令。

- [x] **Step 1: Create isolated worktree from `origin/master`**
- [x] **Step 2: Verify clean Git baseline**
- [x] **Step 3: Run Core Evolution baseline**

Run: `node --test scripts/core-evolution/test/*.test.js`
Expected: `16` pass, `0` fail.

- [x] **Step 4: Run DevSpace baseline**

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/devspace-portable/tests/run-tests.ps1`
Expected: `49` pass, `0` fail.

---

### Task 2: Integrate Agent Learning Phase 1 and Manual Recap Phase 2

**Files:**
- Create/Modify: Agent Learning / Recap files listed in File Map.

**Interfaces:**
- Consumes: formal manual recap JSON `{relative_path, content}`。
- Produces: `pixiu-manual-recap.js` CLI、`captureRecap(...)`、0–3 `agent-observation` candidates。

- [x] **Step 1: Import canonical staged Phase 1/2 files from the dirty source checkout**
- [x] **Step 2: Review the older auto-recap/watcher integration and reject incompatible direct promotion**

Decision: the older isolated worktree used a broader `captureFromTranscript` path. The integrated architecture keeps Auto Recap as `draft-auto` and accepts only strict formal `recap_mode: manual` input for durable observations.

- [x] **Step 3: Run deterministic/manual recap suite**

Run: `node scripts/hooks/pixiu-deterministic-capture.test.js`
Expected: all tests pass, including fail-closed input, concurrency, secret redaction, path escape and memory-summary preservation.

- [x] **Step 4: Run auto recap suite**

Run: `node scripts/hooks/pixiu-auto-recap.test.js`
Expected: `6/6` pass.

- [x] **Step 5: Verify Auto Recap and watcher remain draft-only**

Run: static integration assertion against `pixiu-auto-recap.js` and `pixiu-thread-watcher.js`.
Expected: neither file directly imports or invokes deterministic observation promotion.

---

### Task 3: Integrate Lazy Loading on Top of Current Master

**Files:**
- Create/Modify: Lazy Loading files listed in File Map.

**Interfaces:**
- Consumes: user request text and `vault/capabilities/capability-manifest.json`。
- Produces: `{capabilities, filesToLoad, reasons, degraded}`，最多三個 capability，錯誤時不做全量 fallback。

- [x] **Step 1: Import entry files, Bootstrap, Manifest, Router, Session Index, validators and tests from `perf/pixiu-lazy-loading`**
- [x] **Step 2: Preserve current Core Evolution files and verify Manifest paths against the integrated tree**
- [x] **Step 3: Resolve DevSpace overlapping files by combining current-master behavior and lazy-loading behavior**
- [x] **Step 4: Run lazy-loading Node suites**

Run:
- `node scripts/performance/measure-core-startup.test.js`
- `node scripts/router/resolve-capabilities.test.js`
- `node scripts/skills/validate-skill-metadata.test.js`
- `node scripts/performance/lazy-loading-integration.test.js`

Expected: all tests pass.

- [x] **Step 5: Run PowerShell lazy-loading verification**

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/performance/run-lazy-loading-tests.ps1`
Expected: payload ≤ `12 KB`、Skill metadata warning `0`、representative routes pass.

---

### Task 4: Full Regression and Delivery Readiness

**Files:**
- Modify: plan checkboxes and, only if required, integration documentation.

**Interfaces:**
- Consumes: integrated worktree state。
- Produces: verified delivery candidate without push or deployment。

- [x] **Step 1: Run Core Evolution suite**

Run: `node --test scripts/core-evolution/test/*.test.js`
Expected: `16` pass, `0` fail.

- [x] **Step 2: Run complete DevSpace suite**

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/devspace-portable/tests/run-tests.ps1`
Expected: original `49` behaviors remain and new tests pass.

- [x] **Step 3: Run all targeted recap and lazy-loading suites again**
- [x] **Step 4: Run whitespace, conflict-marker and secret scans**

Run:
- `git diff --check`
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" .`
- strict credential pattern scan excluding `.git`, fixtures and documentation regex examples.

Expected: no actionable findings.

- [x] **Step 5: Review final diff against File Map and report unverified items**
- [x] **Step 6: Leave Git push and deployment pending explicit approval**

## Verification Result

2026-07-27 重新驗證的直接測試入口：

- Core Evolution：`16 / 16`。
- Deterministic／Manual Recap：`41 / 41`。
- Auto Recap：`6 / 6`。
- Lazy Loading／Router／Skill Metadata：`30 / 30`。
- DevSpace OneClick：`77 / 77`。
- Web Test Console 契約：`10 / 10`。
- Web API 真實整合：單模組與六步驟 `integration-all` 全部通過。
- Startup payload：Codex `6,705 / 8,192 bytes`、Claude `3,939 / 6,144 bytes`、Gemini `3,963 / 6,144 bytes`。
- Skill metadata：canonical `90`、portable `87`，均為 `0` warning；raw/effective collision 為 `87 / 0`。
- Scans：`git diff --check`、conflict markers、changed-file credential patterns all passed。
- Newly fixed integration defects:
  - canonical `母體/` recap paths were falsely classified as machine absolute paths by the generic sensitive-text detector; paths now use dedicated validation.
  - recent natural-language workflow phrases were not routed by the first Manifest version; progress、conversation、verification、Auto／Focus mode and impact-assessment routes now have regression coverage.
  - the initial convergence candidate omitted uncommitted current Dev Tunnel compatibility for direct tunnel objects、`portForwardingUris` and verbose HTTP JSON; these behaviors are now preserved alongside legacy fallback and the new safe patch restore.

## Remaining Delivery Boundary

- OneClick `settings.json`／`runtime.json` 已透過 no-restart repair 與現行 DevSpace／Dev Tunnel 對齊，`status` 可驗證本機與公開 MCP、tunnel ID 與兩個 PID。
- 受控 `stop → start → local health → public health → OAuth smoke` 尚未執行，因此只能證明目前服務健康與 state 可接管，不能宣告完整 restart smoke 已完成。
- Router-first 啟動與本次 DevSpace Session 已實際運作；Codex、Claude、Gemini 各自重新開啟的完整 Fresh Session 矩陣仍屬營運 smoke。
- Agent Learning 目前有 observation 與 verifier 基礎，但 consolidation、instinct promotion 與 Second Brain 索引仍是後續 Phase。
- Git commit／push 與本輪 Web 測試控制台交付由 `docs/superpowers/plans/2026-07-27-pixiucore-test-console.md` 記錄，不再由本歷史整合計畫宣告。
- Full compatibility evidence is recorded in `docs/architecture/pixiucore-merge-compatibility-assessment.md`.

## Self-Review Result

- Spec coverage: Core Evolution preservation、Agent Learning Phase 1/2、Lazy Loading、DevSpace overlap、security and regression gates all map to explicit tasks.
- Placeholder scan: no `TBD`、`TODO`、`implement later` or undefined interfaces.
- Scope: no package installation, agent dispatch, push, remote changes or direct modification of the dirty source checkout.
