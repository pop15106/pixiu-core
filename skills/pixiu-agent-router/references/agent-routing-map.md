# Pixiu Agent Routing Map

This map routes PixiuCore `agents/*.md` definitions into Codex's built-in execution types.

Codex runtime types:
- `local`: main Codex thread reads and applies the agent file.
- `explorer`: spawned Codex explorer subagent for read-only codebase questions.
- `worker`: spawned Codex worker subagent for bounded implementation or repair.

Default mode:
- `manual`: named agent only, no spawn.
- `assisted`: auto-select agent instructions, no spawn.
- `fleet`: explicit user request only, may spawn `explorer`/`worker`.

## Primary Routes

| Trigger | Pixiu agent | Codex type | Use |
|---|---|---:|---|
| architecture, design, scalability, technical decision | `architect` | local | System design and architecture review. |
| plan, implementation plan, refactor plan, feature breakdown | `planner` | local | Requirements and phased implementation plan. |
| code review, review diff, after code changes | `code-reviewer` | local | General code review findings. |
| security, auth, authorization, user input, SQL injection, secrets, SSRF, crypto | `security-reviewer` | local | Security review and escalation. |
| explore, trace, find path, where defined, call chain, repo map | `explore-agent` | explorer | Read-only repo exploration. |
| build failed, compile failed, TypeScript error, module resolution | `build-error-resolver` | worker | Minimal build/type fixes. |
| verify, test pass, lint, build proof, claim done | `verification-agent` | local | Verification discipline before completion. |
| TDD, tests first, bugfix with tests | `tdd-guide` | local | Red-green-refactor guidance. |
| docs, README, codemap, documentation update | `doc-updater` | worker | Update project documentation. |
| library docs, API docs, framework docs, current examples | `docs-lookup` | explorer | Documentation lookup. |

## Language Routes

| Trigger | Review agent | Build resolver | Codex type |
|---|---|---|---:|
| Java, Spring, Maven, Gradle, Servlet | `java-reviewer` | `java-build-resolver` | local / worker |
| Python, pytest, typing | `python-reviewer` | `build-error-resolver` | local / worker |
| Go, go test, go vet | `go-reviewer` | `go-build-resolver` | local / worker |
| Rust, cargo, borrow checker | `rust-reviewer` | `rust-build-resolver` | local / worker |
| C++, CMake, linker, templates | `cpp-reviewer` | `cpp-build-resolver` | local / worker |
| Kotlin, Android, KMP, Gradle Kotlin | `kotlin-reviewer` | `kotlin-build-resolver` | local / worker |

Use reviewer agents locally for review-only tasks. Use build resolver agents as `worker` only when the user explicitly permits fleet/sub-agent dispatch or the current request explicitly asks for an agent to fix the build.

## Domain Routes

| Trigger | Pixiu agent | Codex type | Use |
|---|---|---:|---|
| SQL, migration, schema, query optimization, DB performance | `database-reviewer` | local | Database risk review. |
| E2E, browser test, Playwright, user journey | `e2e-runner` | worker | E2E test creation or execution. |
| refactor, dead code, cleanup, consolidation | `refactor-cleaner` | worker | Bounded cleanup with minimal risk. |
| harness, agent harness, throughput, cost, reliability | `harness-optimizer` | local | Harness tuning plan. |
| autonomous loop, monitor loop, stalled loop | `loop-operator` | local | Loop control and intervention. |
| email, Slack, LINE, Messenger, inbox triage | `chief-of-staff` | local | Communication workflow. |

## Fleet Patterns

### Root Cause Tracing

Use when the user asks for root cause across layers or a hard investigation.

Recommended team:
- `explore-agent` as `explorer` for route/call-chain/source mapping.
- Language/domain reviewer locally for risk lens.
- `verification-agent` locally for evidence requirements.

Legacy Java systems should also trigger `legacy-java-flow-tracing` if installed.

### Feature Implementation

Use when the user explicitly asks for fleet/agent team on a feature.

Recommended team:
- `planner` locally to split phases.
- One `worker` for the implementation slice.
- Optional `explorer` for non-blocking context discovery.
- `code-reviewer` locally after patch.
- `verification-agent` locally before completion.

### Build Repair

Use when build/test/lint is failing and user asks for agent help.

Recommended team:
- Language-specific build resolver as `worker`.
- `explore-agent` as `explorer` only if error ownership is unclear.
- `verification-agent` locally to rerun the failing command.

### Security-Sensitive Change

Use when code touches auth, authorization, input validation, SQL, files, secrets, crypto, or network.

Recommended team:
- `security-reviewer` locally.
- Language reviewer locally.
- Implementation worker only if the fix scope is clear and disjoint.

## Full Agent Inventory

| Agent | Default route |
|---|---:|
| `architect` | local |
| `build-error-resolver` | worker |
| `chief-of-staff` | local |
| `code-reviewer` | local |
| `cpp-build-resolver` | worker |
| `cpp-reviewer` | local |
| `database-reviewer` | local |
| `docs-lookup` | explorer |
| `doc-updater` | worker |
| `e2e-runner` | worker |
| `explore-agent` | explorer |
| `go-build-resolver` | worker |
| `go-reviewer` | local |
| `harness-optimizer` | local |
| `java-build-resolver` | worker |
| `java-reviewer` | local |
| `kotlin-build-resolver` | worker |
| `kotlin-reviewer` | local |
| `loop-operator` | local |
| `planner` | local |
| `python-reviewer` | local |
| `refactor-cleaner` | worker |
| `rust-build-resolver` | worker |
| `rust-reviewer` | local |
| `security-reviewer` | local |
| `tdd-guide` | local |
| `verification-agent` | local |

## Dispatch Prompt Template

When spawning a worker or explorer, include:

```text
Use the PixiuCore agent instructions from <absolute agent path>.
You are not alone in the codebase; do not revert edits made by others.
Stay within this ownership scope: <files/modules>.
Return changed file paths, evidence gathered, and verification status.
```

For explorer:

```text
Answer this specific codebase question only: <question>.
Do not edit files.
Use source references and return the smallest useful evidence chain.
```
