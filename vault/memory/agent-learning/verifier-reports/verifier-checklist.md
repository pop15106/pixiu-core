# Verifier Checklist

Use this checklist before an observation is marked verified or promoted.

## Evidence

- [ ] Every material claim points to repo or vault evidence.
- [ ] `source_paths` only uses repo or vault relative paths.
- [ ] Evidence can be read back without using `vault/memory/hook-state/`.

## Facts Vs Inference

- [ ] Verifiable facts are separated from inference.
- [ ] Inference is labeled as tentative and not stated as fact.

## Scope

- [ ] The note stays within the observed project and session scope.
- [ ] Recommendation does not over-generalize into a global rule.

## Governance Conflicts

- [ ] The note does not conflict with `vault/governance/` or `user_rules.md`.
- [ ] If entry files disagree, the higher-precedence governance source is named.

## Sensitive Information

- [ ] No secrets, tokens, full transcript, personal data, or machine-sensitive absolute paths are included.
- [ ] No raw tool payload or copied chat transcript is stored.

## Promotion Destination

- [ ] The note names a promotion destination: keep as candidate, promote to instinct, promote to decision or SOP, or reject.
- [ ] The promotion destination is justified by evidence and verifier result.

## Verifier Result

- [ ] `verified` matches the actual review state.
- [ ] The verifier result is recorded as `pass`, `needs-review`, or `reject`.
