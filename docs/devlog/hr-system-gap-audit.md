# HR System Gap Audit — Pre-Continuation Review

## 1. Summary
This is a **documentation-only audit** completed before any further HR implementation work continues.

- POS is currently paused for this review cycle.
- HR is being re-centered because HR remains the higher roadmap priority sequence anchor and may contain planning/coverage inconsistencies compared with newer POS planning discipline.
- This audit does **not** authorize implementation.

## 2. Audit Purpose
The purpose of this audit is to:
- identify current HR coverage (documented + implemented surfaces)
- identify missing HR planning and implementation coverage
- place each gap into the correct HR phase boundary
- prevent impulse fixes, contract drift, and scope creep
- prepare an updated HR status + master-plan alignment pass before implementation resumes

## 3. Authority / Source-of-Truth Order
This audit follows Agui hierarchy:
1. Agui Development Operating Principles
2. Roadmap
3. HR Master Plan
4. HR status/foundation docs
5. implementation files

If implementation behavior conflicts with higher-order planning/governance docs, documentation and plan alignment must be corrected first before additional implementation proceeds.

## 4. Current HR Phase Alignment
Current available docs show mixed posture:
- `docs/hr/hr-status.md` records HR as broad baseline-implemented, stability checkpoint reached, and POS unlocked (2026-03-31 UTC checkpoint framing).
- `docs/devlog/phase-transition-hr-to-pos.md` records explicit transition of active delivery to POS.
- Root governance still treats HR as the initial higher-priority phase in sequence and requires strict phase gating.

Conservative audit interpretation:
- HR is **not greenfield**, but HR planning/contract clarity appears uneven across some feature areas (especially DTR workflows, schedules depth, and approvals workflow completeness).
- HR likely requires a **renewed planning pass** (status + master-plan precision updates) before new HR implementation continues.
- Uncertainty remains where status claims “implemented baseline” but detailed per-flow contract docs are missing or incomplete.

## 5. Existing HR Coverage Inventory

### Employee records
- Existing docs: HR status, HR master plan, employee branch assignment and authorization model docs.
- Existing implementation signal: employee list/create/edit and branch-safe access are described as implemented in HR status.
- Maturity: **implemented but needs audit** (especially to ensure branch movement and lifecycle edge cases remain contract-aligned).

### Identity/person linkage
- Existing docs: frozen HR-1 identity + RPC contracts in `hr-master-plan.md`, plus identity/lookup devlogs.
- Existing implementation signal: lookup-first employee creation, deduplication guardrail, house-scoped identity handling.
- Maturity: **implemented but needs audit** (must preserve no auto-merge and weak-identifier non-uniqueness rules).

### DTR / attendance
- Existing docs: `hr-2-1-daily-dtr-review.md`, `hr-status.md`, DTR hardening devlogs.
- Existing implementation signal: DTR segment management is reported as baseline implemented.
- Maturity: **partially implemented** (core path exists; correction workflows, completeness views, and compliance-grade audit depth need explicit re-audit).

### Schedules / shifts
- Existing docs: `hr-2-2-schedules-freeze.md`, HR status summary mentions schedule support surfaces.
- Existing implementation signal: baseline schedule support is indicated, but detailed variant/assignment/conflict contracts are not consistently explicit in canonical status.
- Maturity: **partially implemented**.

### Leave / OT
- Existing docs: `hr-2-3-overtime-engine.md`, freeze docs, HR status references overtime-derived payroll inputs.
- Existing implementation signal: overtime policy surfaces and payroll preview inputs described as implemented baseline.
- Maturity: **implemented but needs audit** (approval path and dependency boundary clarity required).

### Approvals
- Existing docs: limited explicit dedicated approvals contract found in canonical HR status/master plan.
- Existing implementation signal: unclear as a full workflow family (roles, rejection reasons, audit history, per-domain approvals).
- Maturity: **missing / unclear**.

### Payroll readiness
- Existing docs: HR-3 payroll run/payslip/export docs, payroll lifecycle explainer, payroll preview references.
- Existing implementation signal: payroll run lifecycle and payslip/PDF flows documented as implemented baseline.
- Maturity: **implemented but needs audit** (dependency integrity from DTR/schedules/approvals must be made explicit).

### Reports / exports
- Existing docs: payroll export and payslip PDF docs/freeze references.
- Existing implementation signal: run PDF export + payslip PDF are reported implemented.
- Maturity: **implemented but needs audit** (confirm export inputs remain phase-safe and contract-safe).

### Audit / security / tenancy
- Existing docs: tenancy non-negotiables, scoped authorization model, route-guard audits, branch-scope audits.
- Existing implementation signal: extensive guardrail and parity hardening streams documented.
- Maturity: **implemented but needs audit** (continuous no-leak verification remains required).

## 6. DTR / Attendance Gap Audit

| Item | Current state | Class | Phase placement |
|---|---|---|---|
| DTR Today | Exists in baseline review surface; depth consistency unclear | UX improvement | HR-2 DTR |
| DTR bulk entry | Not clearly specified as canonical workflow | Feature | HR-2 DTR |
| CSV/import flow | Not clearly specified | Feature | HR-2 DTR |
| Per-employee month view | Partially implied; explicit contract unclear | Feature | HR-2 DTR |
| Per-employee custom date-range view | Unclear | Feature | HR-2 DTR |
| Show every day in selected period incl. missing/no-DTR | Not clearly guaranteed | Audit/compliance requirement | HR-2 DTR |
| Schedule vs actual comparison | Partially implied by DTR+schedule surfaces; explicit contract unclear | Feature | HR-2 DTR / HR-4 dependency |
| Missing clock-in/clock-out detection | Not clearly guaranteed | Risk | HR-2 DTR |
| DTR correction/edit flow | Unclear as complete contract | Feature | HR-2 DTR |
| Correction reason | Not explicitly guaranteed in canonical docs | Audit/compliance requirement | HR-2 DTR |
| Correction approval | Not clearly defined in approvals family | Audit/compliance requirement | HR-4 Approvals |
| Correction audit trail | Not clearly guaranteed end-to-end | Audit/compliance requirement | HR-2 DTR + HR-4 Approvals |
| Payroll-ready attendance summary | Dependency acknowledged but contract detail incomplete | Risk | HR-3 Payroll dependency boundary |

Audit note: DTR appears to have a working baseline, but compliance-grade correction, completeness, and approval-linked auditability are not yet canonically locked in one consolidated contract document set.

## 7. Schedules / Shifts Gap Audit

| Item | Current state | Class | Phase placement |
|---|---|---|---|
| Create schedule | Baseline implied | Feature | HR-4 |
| Edit existing schedule | Unclear if fully governed/audited | Risk | HR-4 |
| Delete/cancel schedule | Unclear contract wording | Feature | HR-4 |
| Schedule history/audit trail | Not clearly canonical | Audit/compliance requirement | HR-4 |
| Schedule templates | Not clearly documented | Feature | HR-4 |
| Fixed schedule type | Likely baseline | Feature | HR-4 |
| Rotating schedule type | Unclear | Feature | HR-4 |
| Split shift | Unclear | Feature | HR-4 |
| Night/overnight | Potential ambiguity risk | Risk | HR-4 |
| Rest day schedules | Partially implied | Feature | HR-4 |
| Flexible schedule | Unclear | Feature | HR-4 |
| Holiday schedule | Unclear | Feature | HR-4 / HR-3 dependency |
| Temporary override | Unclear | Feature | HR-4 |
| Assign to one employee | Likely baseline | Feature | HR-4 |
| Assign to many employees | Not clearly canonical | Feature | HR-4 |
| Assign by branch | Branch model exists; assignment contract depth unclear | Risk | HR-4 |
| Assign by date range | Unclear | Feature | HR-4 |
| Recurring weekly/monthly | Not clearly documented | Feature | HR-4 |
| Copy previous week/month | Not clearly documented | UX improvement | HR-4 |
| Conflict detection: overlap | Unclear | Risk | HR-4 |
| Conflict detection: inactive employee | Unclear | Risk | HR-4 |
| Conflict detection: branch/house mismatch | Governance exists; specific schedule guardrails need explicit contract | Audit/compliance requirement | HR-4 |
| Conflict detection: double assignment | Unclear | Risk | HR-4 |
| Conflict detection: rest-day conflict | Unclear | Risk | HR-4 |
| Conflict detection: overnight ambiguity | Unclear | Risk | HR-4 |

Audit note: schedule support appears present at baseline level, but scheduling semantics, assignment patterns, and conflict policy require canonical HR-4 planning detail before safe expansion.

## 8. Approvals Gap Audit

| Workflow | Current state | Class | Phase placement |
|---|---|---|---|
| DTR correction approval | Not clearly canonical | Audit/compliance requirement | HR-4 |
| OT approval | Partial/unclear | Feature | HR-4 |
| Leave approval | Not clearly canonical | Feature | HR-4 |
| Schedule edit approval | Not clearly canonical | Feature | HR-4 |
| Schedule override approval | Not clearly canonical | Feature | HR-4 |
| Manager/admin approval roles | Role system exists, approval authority mapping unclear | Risk | HR-4 |
| Approval audit trail | Not clearly guaranteed across workflows | Audit/compliance requirement | HR-4 |
| Rejection reason | Not clearly guaranteed | Audit/compliance requirement | HR-4 |
| Approval history | Not clearly guaranteed | Audit/compliance requirement | HR-4 |

Audit note: approvals are a major planning gap area; absent/unclear approval contracts can create silent policy drift and payroll input integrity risks.

## 9. Payroll Dependency Gap Audit
Payroll depends on HR data contract quality, including:
- payable days/hours
- late minutes
- undertime
- overtime
- rest-day work
- holiday work
- approved leave
- approved corrections
- final attendance summary

Current finding:
- Payroll run/payslip surfaces are documented as implemented baseline, but dependency contracts from DTR/schedules/approvals are not fully consolidated in one explicit boundary document.

Boundary statement:
- payroll computation should **not** be expanded by this audit.
- this audit only identifies dependencies requiring planning clarity.

## 10. Tenancy / Identity / Security Review
Foundational checks for HR continuation:
- House remains tenant boundary and must stay authoritative in HR reads/writes.
- Branch remains location scope and must not replace tenant isolation.
- Identity must not assume phone/email uniqueness.
- Identity auto-merge must remain prohibited.
- Cross-house leak prevention remains mandatory.
- Branch movement and assignment must be supported without identity ambiguity.

Risks/unknowns identified:
- Some workflow docs (especially scheduling/approvals) do not yet clearly encode tenant-safe edge-case handling.
- Approval workflow ambiguity may allow authority drift if implemented before contracts are locked.
- Payroll dependency fields may be interpreted inconsistently across modules without explicit boundary documentation.

## 11. Documentation Gaps
Likely missing or needing refresh before implementation continues:
- HR status canonical snapshot refresh (post-recent HR/POS sequencing and renewed HR review posture)
- HR Master Plan gap update (especially HR-2/HR-4 clarity)
- HR DTR detailed planning refresh
- HR scheduling/shifts planning document
- HR DTR correction workflow planning doc
- HR approvals planning doc
- HR payroll readiness/dependency boundary doc
- HR slice/phase sequencing refresh for resumed HR execution

## 12. Recommended Next Documents
Ordered next documentation tasks:
1. HR status refresh
2. HR Master Plan gap update
3. HR-2 DTR detailed planning
4. HR-4 schedules/shifts detailed planning
5. HR approvals planning
6. HR payroll dependency/readiness boundary
7. implementation approval gates per slice

## 13. Risks If We Implement Immediately
If implementation resumes before documentation correction:
- schedule logic becomes ad hoc
- DTR edits become unaudited
- payroll gets wrong or non-normalized dependency data
- branch/house scoping mistakes become harder to unwind
- identity reuse and conflict handling regressions may occur
- approval logic gets bolted on after behavior already ships
- UI behavior can become de-facto authority instead of approved contracts

## 14. Audit Outcome
Outcome:
- HR requires a renewed planning/documentation pass before more implementation.
- **No implementation is authorized by this audit.**
- Next action is documentation correction/planning, not code.

Status-doc handling note:
- `docs/hr/hr-status.md` already exists and should be refreshed in the next dedicated documentation task; this audit intentionally does not rewrite the full canonical status snapshot.
