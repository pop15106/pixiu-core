---
name: legacy-java-flow-tracing
description: Use when tracing legacy Java, Servlet, Spring, Vue, PCLMS, PEPIS, PISSO, PTWCS, report, SQL, table, history-table, menu, login, validator, or stack-trace behavior across UI, controller, service, DAO, database, and report layers.
---

# Legacy Java Flow Tracing

## Core Rule

Do not answer from a single layer. Trace the active path from the user-visible entrypoint to the durable side effect, then state what was verified and what remains unverified.

## Standard Trace Shape

Use this order unless the evidence clearly demands another route:

1. UI / route / form / button / request payload.
2. Controller / servlet / REST endpoint / action.
3. Service / use case / transaction boundary.
4. DAO / mapper / XML SQL / repository / stored procedure.
5. Table / history table / report DTO / generated file / side effect.
6. Runtime evidence: log line, stack trace, query output, test, or compile result.

## When a Stack Trace Exists

- Start from the top application frame named by the trace.
- Follow the exception chain to the validator, branch condition, payload field, or SQL call that actually throws.
- Do not pivot to generic framework advice until the active code path is identified.

## When SQL or Table Source Is Requested

- Return the exact SQL or mapper location when available, not just table names.
- If a table is written, identify insert/update order, history table behavior, and commit/rollback boundary.
- If the answer involves report numbers, trace service totals, DTO assembly, and view/report template, not only the SELECT.

## Repo Boundary Guard

- For near-name sibling repos such as `pepis_ap` and `pisso_ap`, confirm cwd/repo and actual file existence before reusing memory.
- Treat second-brain and memory as leads. The repo, vault source, log, SQL, or test output is the final evidence.

## Output Contract

Prefer this concise structure:

```text
結論：
Evidence chain:
UI/route -> controller/servlet -> service/use case -> DAO/SQL -> table/history/report -> runtime evidence
影響範圍：
需要再確認：
```

If the user says `recap`, write a PixiuCore recap using the active vault rules instead of only summarizing in chat.
