---
disable-model-invocation: true
name: spec-improve
description: Review and improve existing spec-driven development artifacts. Use when the user asks to optimize, review, score, audit, strengthen, renovate, or fill gaps in an existing spec, especially files under specs/active or specs/completed such as spec.md, plan.md, and tasks.md. This skill scores the spec first, explains strengths and weaknesses, recommends missing details, then asks the user focused clarification questions before any rewrite or file change.
---

# Spec Improve

Use this skill to renovate an existing spec without changing it prematurely. The goal is to turn a vague or fragile spec into one that is clear, testable, bounded, and ready for implementation.

This skill only handles spec quality. Do not use DOCX generation workflows here.

## Hard Rules

1. Read first, edit later. Never rewrite or modify spec files until the user explicitly approves.
2. Review the current spec as written. Do not invent business rules, file paths, acceptance criteria, or exclusions.
3. Score before suggesting changes. The user needs the diagnosis before the renovation plan.
4. Ask focused questions after the review. Prefer blockers and ambiguities over nice-to-have questions.
5. Keep the original `spec` skill's contract: `spec.md` is requirements, `plan.md` is implementation approach, `tasks.md` is executable checklist.

## Stage Detection

Decide which stage applies:

1. **Target specified**
   - User provides a path, spec name, or folder like `specs/active/03-export-report`.
   - Read available `spec.md`, `plan.md`, and `tasks.md`.

2. **No target specified**
   - Scan `specs/active/` first.
   - If only one active spec exists, ask whether to review it.
   - If multiple active specs exist, list them and ask the user to choose.
   - If no active spec exists, check `specs/completed/` and ask whether the review is for a completed spec.

3. **Raw spec pasted in chat**
   - Review the pasted content directly.
   - Do not assume missing project context unless the user provides it.

## Inputs To Inspect

Load only what is needed:

- `spec.md`: primary source for requirements, scope, boundaries, dependencies, and acceptance criteria.
- `plan.md`: inspect when judging technical feasibility, risk, and implementation order.
- `tasks.md`: inspect when judging task granularity and traceability.
- `docs/DESIGN.md`: inspect only when the spec references it or the feature depends on broader architecture.
- Nearby completed specs: inspect only when checking overlap or conflict.

## Scoring Rubric

Score out of 100. Give each category a number and one sentence of evidence.

| Category | Points | Look For |
|---|---:|---|
| Goal clarity | 15 | The user problem, target outcome, and success meaning are explicit. |
| Scope and boundaries | 15 | In-scope paths, out-of-scope items, dependencies, and exclusions are concrete. |
| Acceptance criteria | 20 | AC items are observable, testable, and not phrased as vague quality wishes. |
| Inputs and outputs | 10 | Data, commands, APIs, files, or UI flows are named clearly. |
| Edge cases and failure paths | 10 | Empty input, invalid format, missing dependency, large input, and permission issues are covered when relevant. |
| Technical feasibility | 10 | Plan fits the repo's stack, architecture, and constraints. |
| Test strategy | 10 | Automated or manual verification maps back to acceptance criteria. |
| Task readiness | 10 | Tasks are actionable, ordered, and small enough to complete and verify. |

Quality bands:

- **90-100 Ready**: safe to implement after minor cleanup.
- **75-89 Usable**: implementable, but several details should be clarified first.
- **60-74 Risky**: likely to cause rework; clarify blockers before coding.
- **0-59 Not ready**: spec is structurally incomplete; return to spec drafting.

## Review Output

Respond in Traditional Chinese using this structure:

```markdown
## Spec 評分

總分：__/100（品質帶：Ready/Usable/Risky/Not ready）

| 構面 | 分數 | 依據 |
|---|---:|---|
| Goal clarity | __/15 | ... |

## 優點

- ...

## 缺點 / 風險

- ...

## 建議補強

| 優先級 | 補強項 | 為什麼需要 | 建議補法 |
|---|---|---|---|
| P0 | ... | ... | ... |

## 需要你確認的問題

1. ...
```

Keep the review blunt and useful. If the spec is weak, say so directly and explain the consequence.

## Clarifying Questions

Ask at most 5 questions per turn. Order them by implementation risk:

1. Scope blockers: what is included, excluded, or allowed to change?
2. Acceptance blockers: how can the result be verified?
3. Data blockers: what inputs, outputs, formats, or examples are authoritative?
4. Dependency blockers: what upstream modules, APIs, specs, or constraints apply?
5. UX or operational details: wording, display, manual steps, deployment, rollback.

Do not ask questions already answered by the spec, `DESIGN.md`, or project files. Quote the source if the answer is already present.

## After The User Answers

When the user answers clarification questions:

1. Summarize the new facts.
2. Re-score only the affected categories.
3. Propose one of these next actions:
   - **Patch proposal only**: show exact sections to change, no file writes.
   - **Rewrite draft**: produce a revised `spec.md` in chat.
   - **Apply changes**: update the approved files only after explicit confirmation.

If applying changes, touch only the specified spec folder and preserve unrelated content.

## Self-Review Checklist

Before finishing, verify:

- The score has evidence, not vibes.
- Every P0/P1 recommendation maps to a real risk.
- Questions are necessary and answerable by the user.
- No business rule was invented.
- No file edit was made without explicit approval.
