# Pixiu Mothership Connection Protocol

> [!IMPORTANT]
> This project is governed by the Pixiu Mothership Core.
> Follow the low-token startup protocol before any task.

## Bootstrap Protocol

1. **Resolve Core Path**: Use `PIXIU_CORE`, then `PIXIU_CORE_PATH`, then `%USERPROFILE%\.pixiu-core`.
2. **Read Vault Init**: Read `%PIXIU_CORE%\vault\README.md` to confirm the mothership boundary and init sequence.
3. **Read Global Rules**: Read `%PIXIU_CORE%\user_rules.md` as the supreme directive. Keep L0 hard gates resident.
4. **Read Loading Policy**: Read `%PIXIU_CORE%\vault\context\ai-mothership-loading-policy.md` and use it to route L1-L6, skills, workflows, hooks, and agents lazily.
5. **Read Concise Identity/Memory**: Read `%PIXIU_CORE%\vault\identity\founder-profile.md`, `%PIXIU_CORE%\vault\identity\agent-persona.md`, and `%PIXIU_CORE%\vault\memory\memory-summary.md` as summaries. Do not load recap or decision full text unless triggered.
6. **State Connection**: Declare `我已連結至 Pixiu 母艦核心，套用全域治理規範。`
7. **Language Constraint**: Use Traditional Chinese for all thoughts, plans, tool reasons, and responses unless a project file explicitly requires another language.

## Low-Token Operating Rules

- Do not load all skills, workflows, hooks, agents, or recap files at session start.
- Use semantic routing: the user may say natural phrases such as `現在到哪了`, `收尾`, `看風險`, or `開 agent`; map intent to the needed skill or workflow.
- Keep `user_rules.md` L0 as the hard gate. L1-L6 details are loaded only when the current task triggers them.
- Agent team is not default. Judge whether it helps, explain why, and wait for explicit user approval before dispatch.
- Child agents get compact task packets only; they do not re-read the full mothership.

## Project Environment

- **Mothership Path**: `%PIXIU_CORE%` or fallback path from the bootstrap protocol.
- **Project Name**: PixiuCore / project-local override.

## Post-task Code Review Protocol

After implementation, before submitting:
1. Re-read modified files.
2. Confirm logic, no redundant variables, and no stale fragments.
3. Check that mothership changes remain portable across devices and paths.
4. If issues are found, fix and re-audit until verified.