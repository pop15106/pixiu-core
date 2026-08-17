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
4. Convert review gaps into Decision Ledger nodes and use `decision-grilling` to resolve them. Prefer blockers and ambiguities over nice-to-have questions.
5. Default to one visible question at a time; the internal Frontier may contain multiple nodes. Only explicit `--batch` can show multiple independent questions.
6. Keep the original `spec` skill's contract: `spec.md` is requirements, `plan.md` is implementation approach, `tasks.md` is executable checklist.

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
| Test strategy | 10 | Automated or manual verification maps back to acceptance criteria, names a test seam, and uses an independent expected source. |
| Task readiness | 10 | Tasks are actionable, ordered, small enough to complete and verify, and traceable to AC/Decision IDs. |

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

## Clarifying Questions（Decision Frontier）

Review 後先把缺口分類成 Decision nodes，再使用 `decision-grilling`：

1. Scope blockers: what is included, excluded, or allowed to change?
2. Acceptance blockers: how can the result be verified?
3. Data blockers: what inputs, outputs, formats, or examples are authoritative?
4. Dependency blockers: what upstream modules, APIs, specs, or constraints apply?
5. UX or operational details: wording, display, manual steps, deployment, rollback.

規則：

- Repo、spec、`DESIGN.md`、ADR 或 project files 可回答者標為 `FACT` 並自行查證，不問 user。
- 真正需要 user 拍板者標 `USER_DECISION`。
- 需 prototype 才能回答者標 `EXPERIENTIAL`。
- 需 SA／PM／外部 domain owner 回答者標 `EXTERNAL_EXPERT`，轉 `to-questionnaire`。
- 預設每輪只顯示 Frontier 第一題，不再用「最多 5 題」當詢問上限。
- 已有來源回答的問題不得重問；需要時引用來源作為 evidence。

## After The User Answers

When the user answers clarification questions:

1. 更新對應 Decision resolution、rationale 與 evidence；新答案推翻舊決策時 reopen branch。
2. Summarize the new facts and re-score only the affected categories.
3. Frontier 清空後執行 Shared Understanding Gate，再 propose one of these next actions:
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
