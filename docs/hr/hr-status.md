# HR Status (Initial Repo Audit)

## 1. Purpose
This document is the **current execution snapshot** for HR delivery based on repository audit as of 2026-03-27. It is a planning/status tracker and **does not replace** the roadmap, operating principles, or HR master/freeze docs.

## 2. Current HR Focus
Based on active-phase rules and current implementation, the live HR focus is:
- house-scoped HR access + branch-aware enforcement
- employee identity + employee lifecycle flows
- DTR + schedules + overtime derivation
- payroll preview/run lifecycle + export surfaces
- kiosk attendance + employee ID issuance

**Overall:** HR is functionally broad across core domains, but still requires consolidation, hardening, and contract-aligned stabilization before it should be considered stable.

Current execution mode: Hardening and consolidation, not feature expansion.

## 3. Status Summary
| Status | Snapshot |
|---|---|
| Completed (implemented baseline) | Core HR shell, access gates, employee management, DTR/schedules, payroll run lifecycle, kiosk devices/scans, and PDF export surfaces are implemented and usable. Stability/hardening is still required in some areas listed below. |
| In Progress | UX consolidation and hardening areas remain (notably payroll wording alignment and operational setup flows). |
| Partial | Some HR capabilities are implemented with explicit limitations (snapshot-era messaging drift and photo support gaps). |
| Blocked / Dependency | Government deductions, payout/payment integrations, and non-HR phase work remain intentionally out of scope per HR docs. |
| Not Started | Certain documented HR follow-ups (e.g., kiosk setup wizard flow) are not yet evident in implementation. |

## 4. HR Phase Mapping (Audit View)
- **HR-1:** mostly implemented, but should remain treated as frozen-contract sensitive (identity + tenancy boundaries must stay strict).
- **HR-2:** mostly implemented in functional surface (DTR/schedules/preview), with ongoing hardening and consolidation needs.
- **HR-3:** implemented with hardening needed; lifecycle and export surfaces exist, but messaging/UX alignment and stabilization are still needed.
- **HR-3.5:** partially implemented; kiosk/admin and ID issuance flows exist, while setup/operational polish work remains.

## 5. Completed (Implemented Baseline, Not Automatic Stability)
The following are clearly implemented in code and/or tests and usable for current HR execution, but not all should be read as fully production-stable:
- HR workspace shell and tabbed navigation with auth checks.
- HR access enforcement (`requireHrAccess`, branch-scoped policy extraction, role/policy evaluation).
- Employee list/create/edit flows plus identity lookup endpoint.
- DTR segment creation/update UI and server actions, with overtime derivation helpers.
- Schedule templates/windows, branch assignments, and overtime policy management.
- Payroll preview computation and filterable UI.
- Payroll run lifecycle foundations:
  - draft creation + snapshot rows
  - finalize/post/paid status actions
  - adjustment run creation path
  - run detail status metadata and controls
- Payslip preview computation + deductions workflow in payroll run detail.
- Payslip PDF route and payroll run merged PDF export route.
- Kiosk devices admin + kiosk scan/sync/verify/ping API surfaces.
- Employee ID listing/print flow and single ID card PDF route.
- Broad HR automated coverage exists (lib/app/api HR tests across access, payroll routes, kiosk, ID cards, employee flows).

## 6. In Progress
- Payslip user journey is now available in both payroll run detail and `/hr/payslips`, but wording and operator guidance still need hardening for consistency.
- Employee detail contains minor placeholder UX (“Shortcuts coming soon”), suggesting UX completion is still underway.
- Continued route-boundary/guard hardening appears active from dedicated helper/tests and devlog artifacts.

## 7. Partial / Needs Hardening
- Payroll surfaces still present “snapshot/no money computed” framing in key pages while payslip math + deductions now exist; messaging and contract wording should be harmonized.
- Payroll lifecycle behavior and locking semantics are documented in [`payroll-lifecycle-explainer.md`](./payroll-lifecycle-explainer.md) for canonical reference.
- Employee ID cards remain constrained by current contract (photo placeholder / no photo render in the v1 card flow).
- Some capability verification remains documentation-level unless runtime-verified in a deployed DB (RLS/trigger behavior depends on migration application state).
- Consolidated HR reporting UX is uneven (working capabilities distributed across multiple tabs/routes).
- Photo pipeline and ID-output hardening details are tracked in [`employee-photo-pipeline-hardening.md`](./employee-photo-pipeline-hardening.md) for current behavior/fallback expectations.

## 8. Blocked / Dependencies
- Intentionally deferred by HR contract boundaries:
  - government deductions
  - payment integrations/payout rails
  - broader payroll/accounting integrations beyond approved HR milestones
- Capability dependencies for certain follow-ups:
  - kiosk setup onboarding UX depends on implementing the documented wizard flow
  - richer ID card output depends on approved photo pipeline completion

## 9. Not Started Yet
From documented HR scope/follow-up docs, these are not clearly present in current repo UI/routes:
- HR-3.5.1a kiosk setup wizard end-to-end flow.

Items documented as future/deferred (not expected to be started under current constraints):
- Government deduction engines and payment integrations.

## 10. Current Definition of Done (HR MVP Guidance)
Treat HR MVP as complete only when all of the following are true at the same time:
- employee lifecycle flows are stable and identity-safe under frozen HR-1 rules
- DTR output is accurate, explainable, and operationally verifiable
- payroll outputs are consistent, explainable, and contract-aligned
- payslip experience is stable and accessible from intended HR surfaces
- kiosk setup/use is operationally usable for branch teams
- tenancy/auth boundaries (`house_id` scope + branch limits) remain enforced end-to-end

## 11. Next Approved Tasks
Ordered by execution fit with current repo state and HR boundaries:
1. **Harden payslip operator UX**: keep `/hr/payslips` and payroll run detail wording/empty states aligned to current snapshot + computed-preview behavior (no contract expansion).
2. **Implement HR-3.5.1a kiosk setup wizard** using existing kiosk device APIs/contracts to reduce ops friction.
3. **Complete employee ID photo pipeline in approved scope** (photo upload/placement wiring for ID output, no kiosk contract changes).
4. **Continue payroll messaging + docs hardening** so UI text and freeze docs consistently describe what is computed today vs deferred.
5. **Targeted tenancy/auth regression checks** for branch-limited HR paths and write actions to preserve house boundary guarantees.

## 12. Known Risks (Prioritized)
### High risk
- Tenancy/access drift: any `house_id` or branch-scope leakage is a critical contract failure.
- Auth/session/policy drift: guard-order or policy drift can silently over-allow or over-deny HR access.

### Medium risk
- Identity workflow regression: duplicate or conflict handling drift can weaken frozen HR-1 guarantees.
- Runtime drift across environments: migration-level locks/RLS can differ if deploy state is inconsistent.

### Lower risk
- Payroll expectation/documentation drift: misleading wording can cause planning confusion, but is lower severity than tenancy/auth leakage.


## 12A. Tenancy & Auth Regression Coverage
This hardening pass expands regression checks for existing HR endpoints (no contract/surface expansion) to lock tenancy and auth behavior in test coverage.

What is now explicitly enforced:
- Requests with missing or mismatched `houseId` are rejected for HR employee and kiosk-admin routes.
- Cross-house resource access is denied for kiosk device events (`404` not-found pattern, no event payload leakage).
- Branch scoping remains house-first: house-wide listing is allowed only when `branchId` is omitted; cross-house branch filters are rejected.
- Kiosk token boundaries are explicit in route-level tests:
  - invalid/rotated token is rejected,
  - disabled device token is rejected,
  - slug mismatch is rejected,
  - matching slug + token pair succeeds.

What is now explicitly tested:
- `GET /api/hr/employees`: missing membership reject, mismatched `houseId` reject, omitted `houseId` returns scoped house data.
- `GET /api/hr/kiosk-devices`: missing `houseId` reject, house-scoped listing success, cross-house `branchId` reject.
- `GET /api/hr/kiosk-devices/:id/events`: malformed ID reject, missing `houseId` reject, cross-house device reject without `events` payload.
- `/api/kiosk/*` and `/api/hr/kiosk/verify`: missing token reject, invalid token reject, disabled token reject, slug mismatch reject, valid slug/token allow.

Known gaps (intentional, pending later hardening slices):
- Existing coverage is primarily route-entry and service-boundary regression tests with mocked persistence, not full end-to-end database integration suites.
- Legacy `/api/kiosk/scan` and `/api/kiosk/sync` do not take slug input by design; slug mismatch coverage is anchored to verify flow where slug is an explicit contract input.
- This pass does not alter identity model behavior, RBAC model, middleware architecture, or database schema.

## 13. Frozen Boundaries / Non-Negotiables
Current HR work must continue to preserve:
- HR-first phase discipline (no POS/future-phase implementation leapfrogging).
- House as tenant boundary; no cross-house data exposure.
- Frozen HR-1 identity contracts (canonical identifier fields + canonical RPC signatures).
- No stealth contract changes to statuses, APIs, or semantics without explicit milestone approval.
- Additive, contract-safe evolution only.

## 14. Last Updated
Initial generated version refined for tighter phase/stability alignment on **2026-03-27 (UTC)**; tenancy/auth regression coverage updated on **2026-03-28 (UTC)**.
