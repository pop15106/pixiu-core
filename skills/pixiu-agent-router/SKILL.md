---
name: pixiu-agent-router
description: Route PixiuCore agent definitions into Codex workflows. Use when the user asks for Pixiu agent routing, agent team/fleet mode, sub-agent dispatch, parallel agent work, code review agents, security/build/verification agents, or wants Codex to choose from PixiuCore agents/*.md and inject those instructions into built-in Codex explorer/worker/default subagents.
---

# Pixiu Agent Router

## Purpose

Use this skill to turn PixiuCore's `agents/*.md` files into a Codex-compatible routing layer. Codex cannot register arbitrary `agent_type` values; it can only spawn the built-in `default`, `explorer`, and `worker` subagents. This router maps Pixiu agent personas to those built-in types and tells Codex when to read each local agent file.

## Mode Selection

Use exactly one mode for the current user request.

### manual

Use `manual` when the user names a specific Pixiu agent or explicitly asks what agent would fit, but does not ask Codex to dispatch subagents.

Behavior:
- Read the named agent file from `%PIXIU_CORE%/agents/<agent>.md`.
- Apply the agent rules locally in the main Codex thread.
- Do not spawn subagents.
- Tell the user which agent rule was applied if it affects the answer.

### assisted

Use `assisted` when the task matches a routing trigger but the user did not explicitly ask for subagents, parallelism, fleet mode, or an agent team.

Behavior:
- Read `%PIXIU_CORE%/vault/governance/agent-team-mode-policy.md` before dispatch.
- If the user has not selected 平衡／省錢／品質優先／自訂模式, ask for one mode and stop; do not spawn yet.
- The user's mode reply authorizes dispatch for the current task only. If the mode was included in the trigger message, proceed without asking again.
- A question about whether Agent Team is useful stays `assisted`; it is consultation, not fleet permission.
- Read `references/agent-routing-map.md`.
- Select the strongest matching Pixiu agent.
- Read only the selected `%PIXIU_CORE%/agents/<agent>.md` files.
- Apply those instructions locally.
- Do not spawn subagents.

### fleet

Use `fleet` only when the current user message explicitly asks for one of:
- `fleet`
- `agent team`
- `multi-agent`
- `parallel agents`
- `sub-agent`
- "open agents"
- "dispatch agents"
- equivalent Chinese wording such as "多 agent", "開 agent", "平行處理", "非保守版", or "agent team"

Behavior:
- Read `references/agent-routing-map.md`.
- Select a small team, usually 2-4 Pixiu agents.
- Read the relevant `%PIXIU_CORE%/agents/<agent>.md` files.
- Spawn built-in Codex subagents only for independent work that can run in parallel.
- Map Pixiu agents to Codex types:
  - `explore-agent`, `docs-lookup`: `explorer`
  - implementation, build-fix, refactor, doc update: `worker`
  - planning/review-only/checklist tasks: keep local unless they are independent sidecar checks
- Tell each worker it is not alone in the codebase and must not revert others' edits.
- Keep write scopes disjoint across workers.
- Do not delegate the immediate critical-path task if the main thread is blocked on it.

## Workflow

1. Resolve PixiuCore path in this order:
   - `PIXIU_CORE`
   - `PIXIU_CORE_PATH`
   - `%USERPROFILE%/.pixiu-core`
2. Confirm `%PIXIU_CORE%/agents` exists.
3. Read `references/agent-routing-map.md`; for `fleet`, also read `vault/governance/agent-team-mode-policy.md`.
4. Choose `manual`, `assisted`, or `fleet`; before fleet dispatch, resolve the user's cost/quality mode and current model availability.
5. Read only the agent files needed for the selected route.
6. Execute the task under the selected mode.
7. When the task changes code, route a review/verification pass:
   - `code-reviewer` for all code changes.
   - language reviewer when a language-specific agent exists.
   - `security-reviewer` when auth, user input, SQL, filesystem, secrets, crypto, or network calls are touched.
   - `verification-agent` when claiming tests/build/lint pass.

## Routing Constraints

- Treat Pixiu agents as prompt and workflow references, not as new Codex runtime agent types.
- Do not load all 27 agent files by default. Use the routing map first, then read only selected files.
- Prefer `assisted` for normal work; use `fleet` only on explicit current-turn permission.
- Never invent a model or effort value. Apply the shared policy's capability tier and documented fallback when the requested setting is unavailable.
- For small single-file edits, keep the work local unless the user asks for a fleet.
- For legacy Java or repo tracing, prefer the `legacy-java-flow-tracing` skill when available, then use this router if agent dispatch or reviewer routing is needed.
- For second-brain or vault questions, treat second-brain as a lead only. Use local vault/repo evidence as source of truth.

## Output Contract

When routing materially affects the work, state the active mode and selected agents in one short line:

```text
Pixiu routing: assisted -> legacy-java-flow-tracing + java-reviewer
```

For fleet mode, include the dispatch shape:

```text
Pixiu routing: fleet -> explorer(explore-agent), worker(java-build-resolver), local(code-reviewer)
```

Keep final answers focused on task results, not the routing mechanism.
