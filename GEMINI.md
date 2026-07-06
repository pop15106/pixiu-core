# Gemini Pixiu Mothership Connection Protocol

> This is the low-token PixiuCore entry file for Gemini CLI or other AI tools that do not use Claude hooks or Codex project agents.

## Startup

1. Resolve PixiuCore path in order: `PIXIU_CORE`, `PIXIU_CORE_PATH`, `%USERPROFILE%\.pixiu-core`.
2. Read `%PIXIU_CORE%\user_rules.md` for L0 hard gates.
3. Read `%PIXIU_CORE%\vault\README.md` (init sequence) and `%PIXIU_CORE%\vault\governance\INDEX.md` (governance routing).
4. Read `%PIXIU_CORE%\vault\context\ai-mothership-loading-policy.md`.
5. Read the concise identity and memory summaries (mandatory, summaries only — never recap/decision full text at startup):
   - `%PIXIU_CORE%\vault\identity\founder-profile.md`
   - `%PIXIU_CORE%\vault\identity\agent-persona.md`
   - `%PIXIU_CORE%\vault\memory\memory-summary.md`
6. Reply in Traditional Chinese and declare: `我已連結至 Pixiu 母艦核心，套用全域治理規範。`

## Low-Token Rules

- Do not load all skills, workflows, hooks, agents, recaps, or decision files at startup.
- Use semantic intent routing. The user does not need to name exact skill files.
- Treat second brain results as leads; verify with vault source or repo source.
- If Gemini cannot execute a hook/workflow, explain the fallback and perform the equivalent manual check.
- Agent team or multi-agent work requires explicit user approval before dispatch.

## Common Intent Routing

| User intent | Load |
|---|---|
| `recap`, `現在到哪了`, `整理一下`, `下一步` | **[HARD] Mandatory**: read `vault/sop/recap-standard.md` + `vault/templates/session-recap.md`, produce the recap, then **write it back** to `%PIXIU_CORE%\vault\memory\recaps\<專案或母體>\<YYYY-MM>\`（naming per recap-standard; this write-back is pre-authorized by `user_rules.md` — do not skip it, do not ask again）|
| `收尾`, `跑驗證`, `確認能交付` | verify loop skill/workflow |
| `風險`, `影響範圍`, `系統面分析` | impact assessment workflow |
| `auto mode`, `自動放行` | auto mode policy skill |
| `agent team`, `多 agent`, `平行處理` | pixiu-agent-router skill after user approval |

## PixiuCore 母體路由（governance）

1. 解析母體路徑：`PIXIU_CORE` → `PIXIU_CORE_PATH` → `%USERPROFILE%\.pixiu-core`。
2. Session 開始依序讀 `vault/README.md`、`vault/governance/INDEX.md`。
3. 無 subagent / hooks 能力時的退化模式：不派工，改用 `vault/governance/model-dispatch-rules.md` 第 7 節「單體模式」——自己分段執行＋每段用檢查清單自驗。
4. 制度本體在 `vault/governance/`；本檔只做路由。
