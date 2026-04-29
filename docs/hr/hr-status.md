# HR Status (Canonical Repo Re-Audit Snapshot)

## 1. Purpose
This document is the **canonical execution snapshot** for HR delivery based on a conservative repository re-audit completed on **2026-03-28 (UTC)**. It is a planning/status tracker and **does not replace** the roadmap, operating principles, HR master plan, or freeze declarations.

## 2. Current HR Focus
Based on active-phase rules and current implementation, live HR focus remains:
- tenancy-safe HR access and branch-aware authorization enforcement
- employee lifecycle and identity-safe employee operations
- DTR + schedules + overtime-derived payroll preview inputs
- payroll run lifecycle + payslip review + PDF export operations
- kiosk device administration, kiosk setup/onboarding, and employee ID issuance/output hardening
- read-path parity hardening (ensuring metadata, filters, and row payloads remain scope-consistent under branch-limited access)

**Overall:** HR now has broad implemented coverage across planned MVP surfaces, but delivery mode remains **hardening and consolidation**, not feature expansion.

## 3. Status Summary
| Status | Snapshot |
|---|---|
| Completed (implemented baseline) | Core HR shell, access gates, employee management, DTR/schedules/overtime policy surfaces, payroll preview + run lifecycle, payslip review/PDF exports, kiosk devices admin, public kiosk setup/scan flow, and employee ID issuance/download are implemented and usable. |
| In Progress | Consolidation hardening remains active across UX consistency, runtime confidence, guardrail regression depth, and read-path parity (metadata vs row scope consistency across routes, helpers, and page-level compositions). |
| Partial | Some capabilities are intentionally limited by contract (no government deductions/payout rails; employee photo pipeline and ID output remain v1-constrained). |
| Blocked / Dependency | Deferred contract items (government deductions, payout/payment integrations, broader accounting integration) remain out of scope. |
| Not Started | No additional in-scope HR MVP surface is newly identified as completely unimplemented in this re-audit; remaining work is mostly hardening/consolidation or explicitly deferred scope. |

## 4. HR Phase Mapping (Conservative Audit View)
- **HR-1:** implemented and frozen-contract sensitive; identity and tenancy boundaries must remain strict.
- **HR-2:** implemented baseline (DTR/schedules/overtime/preview paths), with continued hardening expected.
- **HR-3:** implemented baseline (run lifecycle + payslip + export surfaces), still treated as hardening-active rather than “fully stable.”
- **HR-3.5:** implemented baseline for kiosk/admin/ID + setup flow; operational hardening and regression expansion remain appropriate.

## 5. Completed (Implemented Baseline, Not Automatic Stability)
The following are clearly implemented in code and/or tests and usable for current HR execution:
- HR workspace shell and tabbed navigation with auth checks.
- HR access enforcement (`requireHrAccess`, `requireHrAccessWithBranch`) across pages, server paths, and APIs.
- Employee list/create/edit + identity lookup flows.
- DTR segment management and overtime/schedule support surfaces.
- Payroll preview computation and payroll run lifecycle (draft/finalize/post/paid/adjustment) with snapshot semantics.
- Payslip review path in payroll-run detail and `/hr/payslips`.
- Payslip PDF route and merged payroll-run PDF export route.
- Kiosk devices admin (provision/enable/disable/rotate/events).
- Public kiosk route (`/company/[slug]/kiosk`) with multi-step setup wizard baseline (welcome → token verify/continue offline → confirm/PIN → setup complete), guarded Settings access, queue management, and reset controls.
- Employee ID listing/print flow and per-employee ID card PDF route.
- Broad HR automated coverage across access, employees, kiosk, payroll-run/payslip, PDF, and photo-route boundaries.

## 6. In Progress
- Hardening continues on operator guidance consistency across payroll and payslip surfaces to prevent wording/behavior drift.
- Employee detail still includes minor placeholder UX (“Shortcuts coming soon”), signaling ongoing UX consolidation.
- Tenancy/auth guardrail regression depth should continue to expand around high-risk route combinations and runtime-sensitive behavior.
- Read-path parity hardening is active across HR surfaces (routes, helpers, and pages) to eliminate scope drift between metadata and row payloads, especially under branch-limited access.

## 7. Partial / Needs Hardening
- Payroll and payslip behavior is implemented and documented, but still requires ongoing contract-safe wording/lock semantics discipline. See [`payroll-lifecycle-explainer.md`](./payroll-lifecycle-explainer.md).
- Kiosk setup flow now exists, but still belongs to hardening mode (operational guidance robustness, edge-case regression confidence, and deployment playbook maturity).
- Employee photo + ID output remain under constrained v1 contract/hardening posture. See [`employee-photo-pipeline-hardening.md`](./employee-photo-pipeline-hardening.md).
- Runtime guarantees that depend on deploy-state DB objects (RLS/grants/triggers/migrations applied consistently) still need environment-level validation beyond mocked/unit boundaries.
- Some HR page-level surfaces combining metadata (e.g. branch lists, filters) with row payloads have required parity hardening to ensure metadata does not imply broader scope than returned rows. This is being actively audited and stabilized.

## 8. Blocked / Dependencies
Intentionally deferred by approved HR boundaries:
- government deduction engines
- payment/payout rails and settlement integrations
- non-HR phase expansion (POS+ future systems)

Dependency-shaped follow-ups (hardening, not scope expansion):
- deeper kiosk operational rollout confidence (field/deployment checklist and regression depth)
- richer ID card/photo output behavior only when explicitly approved by HR freeze discipline

## 9. Not Started Yet
Conservative re-audit result:
- No additional approved in-scope HR MVP surface is clearly “not started.”
- Remaining unimplemented items are deferred by contract (government deductions, payout/payment integrations, broader accounting integration).

## 10. Current Definition of Done (HR MVP Guidance)
Treat HR MVP as complete only when all are simultaneously true:
- employee lifecycle is identity-safe and stable under frozen HR-1 constraints
- DTR/schedule/overtime behavior is operationally reliable and explainable
- payroll run and payslip behavior is stable, lock-safe, and contract-aligned
- kiosk onboarding and daily kiosk operation are branch-usable with predictable recovery flows
- employee ID and photo-output path are clear and operationally safe within approved contract limits
- tenancy/auth boundaries (`house_id` + branch-scoped authorization) remain enforced end-to-end

## 10A. Read-Path Parity Invariants (Enforced)
All HR read paths must now follow these invariants:
- Access decisions (`requireHrAccess`, `requireHrAccessWithBranch`) are the source of truth for scope.
- Row-level data must always be constrained by access-derived scope.
- Metadata (branches, filters, counts, summaries) must be derived from the same scoped data and must never widen scope.
- Partial or failed metadata loading must not broaden row queries.
- Branch-limited zero-scope states must not leak entity existence or metadata.

These invariants are enforced via test-first hardening across:
- API routes
- server helpers
- page-level compositions

## 11. Next Approved Tasks (Re-ranked)
Ordered for post-checkpoint execution fit with current repo state:
1. **Kiosk setup/operations hardening slice** (wizard robustness, setup recovery clarity, and rollout checklist confidence) without changing approved kiosk contract scope.
2. **Payroll/payslip UX wording and lock-state consistency hardening** to prevent contract drift across run-detail, payslips tab, and export messaging.
3. **Employee photo/ID output clarity hardening** within existing HR-3.5.2 constraints (no contract expansion).
4. **Environment-level runtime confidence validation** (deploy-state migrations/grants/RLS/trigger alignment checks) without changing runtime contracts.

## 12. Known Risks (Prioritized)
### High risk
- Tenancy/access drift (`house_id` or branch leakage) remains the highest-severity risk.
- Auth/session/policy drift can silently over-allow or over-deny HR actions.

### Medium risk
- Runtime/deploy drift (migrations, grants, RLS, trigger state mismatch across environments) can undermine assumptions validated in local tests.
- Identity workflow regression could weaken frozen HR-1 duplicate/conflict handling discipline.

### Lower risk
- Documentation/expectation drift across HR docs and UI copy can mislead planning and operations even when behavior is unchanged.

## 12A. Tenancy & Auth Regression Coverage Snapshot
Current regression posture includes explicit tests for:
- missing or mismatched `houseId` rejection on HR employee and kiosk-admin endpoints
- cross-house kiosk-device event access denial without payload leakage
- branch scoping behavior that remains house-first and rejects cross-house branch filters
- kiosk token boundary outcomes (missing/invalid/disabled/mismatched slug rejected; valid slug+token accepted)

Conservative caveat:
- coverage is strong at route/service boundaries but still not a full substitute for environment-integrated database/runtime verification.

## 13. Canonical Cross-Doc References
Use these alongside this status snapshot:
- HR master plan: [`hr-master-plan.md`](./hr-master-plan.md)
- Payroll behavior/locks explainer: [`payroll-lifecycle-explainer.md`](./payroll-lifecycle-explainer.md)
- Kiosk setup contract: [`hr-3-5-1a-kiosk-setup-wizard.md`](./hr-3-5-1a-kiosk-setup-wizard.md)
- Kiosk devices admin contract: [`hr-3-5-1-kiosk-devices.md`](./hr-3-5-1-kiosk-devices.md)
- Employee photo hardening: [`employee-photo-pipeline-hardening.md`](./employee-photo-pipeline-hardening.md)
- Employee ID + freeze references: [`hr-3-5-2-employee-id-cards.md`](./hr-3-5-2-employee-id-cards.md), [`hr-3-5-2-freeze.md`](./hr-3-5-2-freeze.md)

## 14. Frozen Boundaries / Non-Negotiables
Current HR work must continue to preserve:
- HR-first phase discipline (no POS/future-phase implementation leapfrogging)
- House as tenant boundary; no cross-house exposure
- Frozen HR-1 identity contracts and approved HR freeze semantics
- No stealth contract changes to statuses, APIs, RPCs, or behavior semantics
- Additive, contract-safe hardening over speculative expansion

## 15. HR Stability Gate Assessment (Final Conservative Blocker Closeout Checkpoint — 2026-03-31 UTC)

### Decision
**Recommended gate result: STABLE ENOUGH TO UNLOCK POS.**

### Why this is conservative and evidence-based
- This checkpoint re-read closure evidence for all three blocker-class hardening streams:
  - tenancy/auth regression consistency audit
  - non-payroll mixed metadata + row parity audit
  - payroll read/export sibling parity hardening
- All three streams are now documented as **closed** with explicit closure evidence and no unresolved blocker-class regressions recorded in those task files.
- No remaining repo documentation in canonical HR task files currently supports an open blocker-class stream for:
  - unresolved tenancy/access blocker
  - unresolved branch-scope parity blocker
  - unresolved no-leak blocker
- HR remains **hardening-active** for non-blocker stabilization slices (kiosk operations, payroll/payslip wording consistency, and operational/runtime confidence).
- This decision is conservative: it confirms only that **no known blocker regressions remain** in current repository evidence; it does not claim zero risk.

### Consolidated checkpoint statement
As of **2026-03-31 UTC**, repository evidence supports this conservative checkpoint:
- **No known blocker regressions remain** in the blocker class (tenancy/access, branch-scope parity, no-leak boundaries).
- HR is therefore **stable enough to unlock POS planning/start**, while HR hardening continues on non-blocker streams.

### Blocker interpretation for POS unlock
- **Blocker:** Any unresolved tenancy/access drift risk, branch-scope parity gap, or unresolved no-leak inconsistency in HR read/write boundaries.
- **Non-blocking hardening follow-up:** Lower-risk UX polish that does not alter authorization, tenancy, identity, or lock semantics.
- **Documentation/operational note only:** rollout playbook clarifications that do not change runtime behavior.

### Post-unlock hardening slices (ordered)
1. Maintain tenancy/auth and parity regressions as locked guardrails (no contract widening).
2. Continue kiosk setup/operations and payroll/payslip wording consistency hardening.
3. Expand environment-level runtime confidence validation across deployment states.

## 16. Last Updated
Canonical re-audit refresh completed on **2026-03-31 (UTC)**, including final conservative blocker closeout checkpoint and gate reassessment.

## 17. HR Devlog Note (2026-04-29 UTC)
- Feature-gate drift across related endpoints can break end-to-end HR flows even when page access appears healthy.
- HR access resolution is not identical to feature entitlement checks; both must stay aligned for entry paths and dependent APIs.
- Identity lookup is a blocking dependency for Add Employee lookup-first creation, so lookup authorization must align with Add Employee entry access while preserving house-scoped deny/no-leak boundaries.
