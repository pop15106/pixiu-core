# Everything Claude Code (ECC) — Agent Instructions

This is a **production-ready AI coding plugin** providing 25 specialized agents, 108 skills, 57 commands, and automated hook workflows for software development.

## Pixiu Mothership Loading Policy

<!-- HERMES_GLOBAL_ROUTER_START -->

## Hermes Global Task Router

When the user explicitly asks to use Hermes, route the request through Hermes instead of directly implementing in the current folder.

Trigger phrases include:
- `請幫我用 Hermes`
- `用 Hermes`
- `透過 Hermes`
- `交給 Hermes`
- `Hermes gate`
- `Hermes 分配 AI`

On trigger:
1. Resolve Hermes home: use `$env:HERMES_HOME` if set; otherwise use `C:\Users\7010\Documents\hermes 多AI 工作流`.
2. Do not treat the current folder being empty or not a git repo as permission to bypass Hermes.
3. Submit and immediately run the Hermes task with:

```powershell
$hermes = if ($env:HERMES_HOME) { $env:HERMES_HOME } else { 'C:\Users\7010\Documents\hermes 多AI 工作流' }
powershell -ExecutionPolicy Bypass -File "$hermes\scripts\hermes-submit-and-run.ps1" -Text "<verbatim user request>" -SourceEntrance "codex"
```

4. Report `taskId`, run status, state path, and report path to the user.
5. If the script fails, report the exact error and stop. Do not silently implement the task directly unless the user explicitly says not to use Hermes.

For approval-only actions, use:

```powershell
$hermes = if ($env:HERMES_HOME) { $env:HERMES_HOME } else { 'C:\Users\7010\Documents\hermes 多AI 工作流' }
powershell -ExecutionPolicy Bypass -File "$hermes\scripts\hermes-gate.ps1" -TaskId "<taskId>" -Decision approve -By "<user>" -Comment "<reason>"
```

<!-- HERMES_GLOBAL_ROUTER_END -->

This repository is governed by PixiuCore. Before using agents, skills, workflows, or hooks, follow `vault/context/ai-mothership-loading-policy.md`.

Key rules:
- At session start, read `vault/README.md` (init sequence) and `vault/governance/INDEX.md` (governance routing hub). Governance rule bodies live under `vault/governance/`; this file does not carry them.
- Entry-file precedence and conflict handling: `vault/governance/entry-files-alignment.md` section 3.
- Keep L0 hard gates resident; keep L1-L6 as a short routing summary and load details only when triggered.
- Use semantic routing as well as keywords. The user should not need to name exact skills or workflows.
- Agent team is not default. Judge whether it is useful, explain why, and wait for explicit user approval before dispatch.
- Child agents receive a compact task packet only: goal, allowed paths, relevant L0 constraints, evidence files, and verification criteria.
- Resolve the mothership path through `PIXIU_CORE`, then `PIXIU_CORE_PATH`, then `%USERPROFILE%\.pixiu-core`; do not require one machine-specific path.

## Core Principles

1. **Agent-Aware** — Judge whether specialized agents are useful, then ask for approval before dispatching
2. **Test-Driven** — Write tests before implementation, 80%+ coverage required
3. **Security-First** — Never compromise on security; validate all inputs
4. **Immutability** — Always create new objects, never mutate existing ones
5. **Plan Before Execute** — Plan complex features before writing code

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| planner | Implementation planning | Complex features, refactoring |
| architect | System design and scalability | Architectural decisions |
| tdd-guide | Test-driven development | New features, bug fixes |
| code-reviewer | Code quality and maintainability | After writing/modifying code |
| security-reviewer | Vulnerability detection | Before commits, sensitive code |
| build-error-resolver | Fix build/type errors | When build fails |
| e2e-runner | End-to-end Playwright testing | Critical user flows |
| refactor-cleaner | Dead code cleanup | Code maintenance |
| doc-updater | Documentation and codemaps | Updating docs |
| go-reviewer | Go code review | Go projects |
| go-build-resolver | Go build errors | Go build failures |
| kotlin-reviewer | Kotlin code review | Kotlin/Android/KMP projects |
| kotlin-build-resolver | Kotlin/Gradle build errors | Kotlin build failures |
| database-reviewer | PostgreSQL/Supabase specialist | Schema design, query optimization |
| python-reviewer | Python code review | Python projects |
| java-reviewer | Java and Spring Boot code review | Java/Spring Boot projects |
| java-build-resolver | Java/Maven/Gradle build errors | Java build failures |
| chief-of-staff | Communication triage and drafts | Multi-channel email, Slack, LINE, Messenger |
| loop-operator | Autonomous loop execution | Run loops safely, monitor stalls, intervene |
| harness-optimizer | Harness config tuning | Reliability, cost, throughput |
| rust-reviewer | Rust code review | Rust projects |
| rust-build-resolver | Rust build errors | Rust build failures |

## Agent Orchestration

Judge agent fit proactively, but do not dispatch agents without explicit user approval:
- Complex feature requests → **planner**
- Code just written/modified → **code-reviewer**
- Bug fix or new feature → **tdd-guide**
- Architectural decision → **architect**
- Security-sensitive code → **security-reviewer**
- Multi-channel communication triage → **chief-of-staff**
- Autonomous loops / loop monitoring → **loop-operator**
- Harness config reliability and cost → **harness-optimizer**

Use parallel execution only after approval and only for independent operations with disjoint scopes. Dispatch packets and reporting contracts follow `vault/governance/model-dispatch-rules.md` and `vault/governance/delegation-templates.md`.

## Security Guidelines

**Before ANY commit:**
- No hardcoded secrets (API keys, passwords, tokens)
- All user inputs validated
- SQL injection prevention (parameterized queries)
- XSS prevention (sanitized HTML)
- CSRF protection enabled
- Authentication/authorization verified
- Rate limiting on all endpoints
- Error messages don't leak sensitive data

**Secret management:** NEVER hardcode secrets. Use environment variables or a secret manager. Validate required secrets at startup. Rotate any exposed secrets immediately.

**If security issue found:** STOP → use security-reviewer agent → fix CRITICAL issues → rotate exposed secrets → review codebase for similar issues.

## Coding Style

**Immutability (CRITICAL):** Always create new objects, never mutate. Return new copies with changes applied.

**File organization:** Many small files over few large ones. 200-400 lines typical, 800 max. Organize by feature/domain, not by type. High cohesion, low coupling.

**Error handling:** Handle errors at every level. Provide user-friendly messages in UI code. Log detailed context server-side. Never silently swallow errors.

**Input validation:** Validate all user input at system boundaries. Use schema-based validation. Fail fast with clear messages. Never trust external data.

**Code quality checklist:**
- Functions small (<50 lines), files focused (<800 lines)
- No deep nesting (>4 levels)
- Proper error handling, no hardcoded values
- Readable, well-named identifiers

## Testing Requirements

**Minimum coverage: 80%**

Test types (all required):
1. **Unit tests** — Individual functions, utilities, components
2. **Integration tests** — API endpoints, database operations
3. **E2E tests** — Critical user flows

**TDD workflow (mandatory):**
1. Write test first (RED) — test should FAIL
2. Write minimal implementation (GREEN) — test should PASS
3. Refactor (IMPROVE) — verify coverage 80%+

Troubleshoot failures: check test isolation → verify mocks → fix implementation (not tests, unless tests are wrong).

> Legacy-project scope note: for legacy systems without test infrastructure (e.g., PCLMS-era Java), apply `vault/governance/judgment-rubrics.md` section 5 minimum verification (compile + relevant tests where they exist + main-path run) instead of blocking on the 80% target; do not add test frameworks without user approval.

## Development Workflow

1. **Plan** — Use planner agent, identify dependencies and risks, break into phases
2. **TDD** — Use tdd-guide agent, write tests first, implement, refactor
3. **Review** — Use code-reviewer agent immediately, address CRITICAL/HIGH issues
4. **Capture knowledge in the right place**
   - Personal debugging notes, preferences, and temporary context → auto memory
   - Team/project knowledge (architecture decisions, API changes, runbooks) → the project's existing docs structure
   - If the current task already produces the relevant docs or code comments, do not duplicate the same information elsewhere
   - If there is no obvious project doc location, ask before creating a new top-level file
5. **Commit** — Conventional commits format, comprehensive PR summaries

## Git Workflow

**Commit format:** `<type>: <description>` — Types: feat, fix, refactor, docs, test, chore, perf, ci

**PR workflow:** Analyze full commit history → draft comprehensive summary → include test plan → push with `-u` flag.

## Architecture Patterns

**API response format:** Consistent envelope with success indicator, data payload, error message, and pagination metadata.

**Repository pattern:** Encapsulate data access behind standard interface (findAll, findById, create, update, delete). Business logic depends on abstract interface, not storage mechanism.

**Skeleton projects:** Search for battle-tested templates, evaluate with parallel agents (security, extensibility, relevance), clone best match, iterate within proven structure.

## Performance

**Context management:** Avoid last 20% of context window for large refactoring and multi-file features. Lower-sensitivity tasks (single edits, docs, simple fixes) tolerate higher utilization.

**Build troubleshooting:** Use build-error-resolver agent → analyze errors → fix incrementally → verify after each fix.

## Project Structure

```
agents/          — 25 specialized subagents
skills/          — 102 workflow skills and domain knowledge
commands/        — 57 slash commands
hooks/           — Trigger-based automations
rules/           — Always-follow guidelines (common + per-language)
scripts/         — Cross-platform Node.js utilities
mcp-configs/     — 14 MCP server configurations
tests/           — Test suite
```

## Success Metrics

- All tests pass with 80%+ coverage
- No security vulnerabilities
- Code is readable and maintainable
- Performance is acceptable
- User requirements are met
