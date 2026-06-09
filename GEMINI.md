# Gemini Pixiu Mothership Connection Protocol

> This is the low-token PixiuCore entry file for Gemini CLI or other AI tools that do not use Claude hooks or Codex project agents.

## Startup

1. Resolve PixiuCore path in order: `PIXIU_CORE`, `PIXIU_CORE_PATH`, `%USERPROFILE%\.pixiu-core`.
2. Read `%PIXIU_CORE%\user_rules.md` for L0 hard gates.
3. Read `%PIXIU_CORE%\vault\context\ai-mothership-loading-policy.md`.
4. Read only concise identity and memory summaries when needed:
   - `%PIXIU_CORE%\vault\README.md`
   - `%PIXIU_CORE%\vault\identity\founder-profile.md`
   - `%PIXIU_CORE%\vault\identity\agent-persona.md`
   - `%PIXIU_CORE%\vault\memory\memory-summary.md`
5. Reply in Traditional Chinese and declare: `我已連結至 Pixiu 母艦核心，套用全域治理規範。`

## Low-Token Rules

- Do not load all skills, workflows, hooks, agents, recaps, or decision files at startup.
- Use semantic intent routing. The user does not need to name exact skill files.
- Treat second brain results as leads; verify with vault source or repo source.
- If Gemini cannot execute a hook/workflow, explain the fallback and perform the equivalent manual check.
- Agent team or multi-agent work requires explicit user approval before dispatch.

## Common Intent Routing

| User intent | Load |
|---|---|
| `現在到哪了`, `整理一下`, `下一步` | `skills/pixiu-session-recap/SKILL.md` and recap SOP/template |
| `收尾`, `跑驗證`, `確認能交付` | verify loop skill/workflow |
| `風險`, `影響範圍`, `系統面分析` | impact assessment workflow |
| `auto mode`, `自動放行` | auto mode policy skill |
| `agent team`, `多 agent`, `平行處理` | pixiu-agent-router skill after user approval |
