# Code Review

Review the requested diff through four independent axes: Standards, Spec, Security, and Verification.

1. Resolve and freeze the intended base ref before review. Inspect `git diff <base>...HEAD`, staged changes, and relevant working-tree changes. If the ref is invalid or the expected diff is empty, stop and report the range problem.
2. Identify the governing source: project rules, spec/PRD, Decision IDs, Acceptance Criteria, and relevant verification commands. If there is no spec source, the Spec axis returns `NO_SPEC_SOURCE` instead of inventing requirements.
3. Review each axis independently:

**Standards:**
- Repo conventions and architecture vocabulary
- Error handling and maintainability
- Local patterns, module boundaries, and avoidable complexity

**Spec:**
- Missing required behavior
- Scope creep
- Decision/AC traceability
- Edge cases required by the source

**Security:**
- Credentials, secrets, PII leakage
- SQL injection, XSS, path traversal, auth/authz, CSRF
- Missing input validation or new trust-boundary risk

**Verification:**
- Tests or repro cover the changed public behavior
- Bug fixes reproduce the original symptom
- Expected results come from an independent authoritative source
- Build/test/query/manual evidence is present and reproducible

4. Report each finding with axis, severity, file/line, evidence, consequence, and suggested fix. Do not average axis results into one score.
5. End with an axis summary and severity summary.
6. Gate rules:
   - CRITICAL: block.
   - HIGH: block unless the user explicitly accepts the documented risk.
   - Spec P0 omission: block.
   - Verification without evidence: `INCOMPLETE_EVIDENCE`; do not claim completion.
   - Review approval never grants commit or push permission.
