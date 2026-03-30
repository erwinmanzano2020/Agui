# Codex Task — HR Read/Helper Parity Audit for Mixed Metadata + Row Payloads (Non-Payroll)

## Status
- active

## Canonical context to use
- Treat `docs/hr/hr-status.md` as the canonical HR execution snapshot for this task.
- Keep this task aligned with the hardening/consolidation posture in that snapshot.

## Locked sibling stream
- The payroll read/export sibling parity hardening stream is **locked**.
- Do not reopen or modify payroll read/export parity scope unless this task proves a new, concrete regression.
- If a concrete payroll regression is discovered incidentally, log it explicitly as out-of-scope follow-up and continue this non-payroll task.

## Task type
Hardening only. This is a parity and regression-hardening task, **not** a feature task.

## Scope
Audit existing **non-payroll** HR read endpoints/helpers that return:
- top-level metadata or summary fields, and
- row/item collections in the same response payload.

Focus on proving access/scope parity between metadata and row collections under tenancy- and branch-sensitive conditions.

## Non-negotiable constraints
- hardening only
- no feature expansion
- no schema changes
- no migration changes
- no auth/RBAC redesign
- no tenancy reinterpretation
- no middleware rewrite
- preserve HR-first phase discipline
- preserve current endpoint contracts unless a real regression is proven by tests
- if unrelated risk is found, document it without widening this task

## Goal
Prove that for existing non-payroll HR read surfaces with mixed metadata + row payloads:
- branch-limited zero-scope states do not widen metadata visibility,
- resolver-first/access-first short-circuiting remains enforced,
- deny-by-default behavior is preserved,
- forbidden/not-found responses remain no-leak.

## Primary objective
Eliminate parity drift where metadata can appear broader than rows (or vice versa) when actor scope is constrained.

## Repo-grounded target areas (non-payroll)
Audit and test existing HR read families outside payroll/export paths, prioritizing endpoints/helpers that combine summary + list payloads, such as:
- employee directory/list and related summary counters
- kiosk/admin read surfaces that return aggregate status + item rows
- other existing HR read handlers/helpers with mixed metadata and collection payload shape

Use current repository implementations as-is; do not invent new API surfaces.

## Required test-first method
1. Add or extend regression tests first to codify expected parity behavior.
2. Reproduce any true bug through failing tests.
3. Apply minimal production fix only when required to satisfy failing hardening tests.
4. Keep fixes narrowly scoped to the proven regression.

## What to prove (test matrix)

### 1) Mixed payload parity under branch-limited zero-scope
For branch-limited actors where in-scope rows resolve to zero:
- metadata/summary must not imply broader accessible data than row payloads,
- row collection remains empty (or contract-appropriate constrained value),
- metadata reflects same constrained scope (no widened counts/totals/status),
- no fallback to house-wide aggregates.

### 2) Resolver-first / access-first short-circuiting
For each audited read path where applicable:
- access resolution runs before expensive row/summary fetches,
- forbidden/not-found resolution prevents downstream data helper execution,
- missing/invalid scope context fails before broader data retrieval.

Do not impose a new universal ordering—assert and preserve each route family’s current safe contract.

### 3) Deny-by-default behavior
When scope context is missing/empty/ambiguous (per existing contract):
- response must deny safely or resolve to constrained empty scope,
- no broad metadata defaults,
- no non-empty row payload unless explicitly authorized by existing behavior.

### 4) No-leak forbidden/not-found payloads
Strengthen assertions that deny responses do not leak sensitive linkage clues (for relevant route contracts), including:
- cross-house ownership hints,
- branch membership details,
- hidden target existence signals,
- internal IDs not already contract-approved for deny payloads.

### 5) Metadata + rows consistency invariants
For each audited endpoint/helper pair, assert invariants such as:
- `total/count/summary` fields correspond to same filtered scope as returned rows,
- pagination/limit metadata does not reveal out-of-scope totals,
- empty rows caused by branch limits do not coexist with widened house-level summary values.

## Deliverables
1. Concrete test additions/expansions for non-payroll mixed-payload read parity.
2. Minimal production fix only if tests prove a real regression.
3. Brief audit note in task output listing audited endpoints/helpers and parity outcome.
4. Explicit out-of-scope note for any incidental payroll findings (without fixing payroll in this task).

## Implementation guidance
- Prefer updating existing HR test files near audited endpoints/helpers.
- Reuse existing HR assertion patterns and fixtures.
- Add targeted helper call-order/call-count assertions where short-circuiting matters.
- Keep production edits minimal and local to proven regressions.
- Avoid refactors that are not required by a failing hardening test.

## Explicit non-goals
- payroll formula or payroll export behavior changes
- payroll read/export parity pass (locked sibling stream)
- API contract redesign
- schema/migration work
- middleware architecture changes
- POS or future-phase implementation
- speculative cleanup unrelated to failing tests

## Output format required from Codex
Return:
1. **Summary**
2. **Audited non-payroll endpoints/helpers**
3. **Tests added/expanded (test-first evidence)**
4. **Regressions proven (if any)**
5. **Minimal fixes applied (if any)**
6. **No-leak and deny-by-default verification notes**
7. **Explicit non-changes**
8. **Verification run**
9. **Follow-up risks (including any incidental payroll regression note)**

## Verification
Run focused relevant tests first, then run:
- `npm run lint`
- `npm run typecheck`
- `npm run build`

If environment issues block a command, report exact failure and keep conclusions conservative.

## Final instruction
Stay strictly within hardening scope. Prove parity and safety for existing non-payroll HR mixed metadata+row read paths without contract expansion.
