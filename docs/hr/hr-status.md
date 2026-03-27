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

## 3. Status Summary
| Status | Snapshot |
|---|---|
| Completed | Core HR shell, access gates, employee management, DTR/schedules, payroll run lifecycle, kiosk devices/scans, and PDF export surfaces are implemented. |
| In Progress | UX consolidation and hardening areas remain (notably payslip tab UX vs run-detail payslip workflow, and operational setup flows). |
| Partial | Some HR capabilities are implemented with explicit limitations (snapshot-only messaging, placeholder UX, photo support gaps, diagnostics-only surfaces). |
| Blocked / Dependency | Government deductions, payout/payment integrations, and non-HR phase work remain intentionally out of scope per HR docs. |
| Not Started | Certain documented HR follow-ups (e.g., kiosk setup wizard flow) are not yet evident in implementation. |

## 4. Completed
The following are clearly implemented in code and/or tests:
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

## 5. In Progress
- Payslip user journey appears split:
  - dedicated `/hr/payslips` page remains placeholder text
  - working payslip preview experience lives in payroll run detail
- Employee detail contains minor placeholder UX (“Shortcuts coming soon”), suggesting UX completion is still underway.
- Continued route-boundary/guard hardening appears active from dedicated helper/tests and devlog artifacts.

## 6. Partial / Needs Hardening
- Payroll surfaces still present “snapshot/no money computed” framing in key pages while payslip math + deductions now exist; messaging and contract wording should be harmonized.
- Employee ID cards remain constrained by current contract (photo placeholder / no photo render in the v1 card flow).
- Some capability verification remains documentation-level unless runtime-verified in a deployed DB (RLS/trigger behavior depends on migration application state).
- Consolidated HR reporting UX is uneven (working capabilities distributed across multiple tabs/routes).

## 7. Blocked / Dependencies
- Intentionally deferred by HR contract boundaries:
  - government deductions
  - payment integrations/payout rails
  - broader payroll/accounting integrations beyond approved HR milestones
- Capability dependencies for certain follow-ups:
  - kiosk setup onboarding UX depends on implementing the documented wizard flow
  - richer ID card output depends on approved photo pipeline completion

## 8. Not Started Yet
From documented HR scope/follow-up docs, these are not clearly present in current repo UI/routes:
- HR-3.5.1a kiosk setup wizard end-to-end flow.
- A dedicated non-placeholder payslip tab experience at `/hr/payslips`.

Items documented as future/deferred (not expected to be started under current constraints):
- Government deduction engines and payment integrations.

## 9. Next Approved Tasks
Ordered by execution fit with current repo state and HR boundaries:
1. **Close payslip UX gap**: implement `/hr/payslips` as a real read surface backed by existing payslip computation routes (no contract expansion).
2. **Implement HR-3.5.1a kiosk setup wizard** using existing kiosk device APIs/contracts to reduce ops friction.
3. **Complete employee ID photo pipeline in approved scope** (photo upload/placement wiring for ID output, no kiosk contract changes).
4. **Hardening pass on payroll messaging + docs** so UI text and freeze docs consistently describe what is computed today vs deferred.
5. **Targeted tenancy/auth regression checks** for branch-limited HR paths and write actions to preserve house boundary guarantees.

## 10. Known Risks
- Auth/session and policy drift can create false access denials or accidental widening if guard order/contracts diverge.
- Tenancy risk remains high-impact: all HR reads/writes must continue to enforce `house_id` and branch limits where applicable.
- Identity-related HR workflows are sensitive to duplicate/merge mistakes; frozen HR-1 identity rules must remain intact.
- Payroll expectations risk: UI/documentation drift can mislead teams on what payroll outputs are authoritative vs preview/snapshot.
- Runtime drift risk: migration-level locks/RLS may differ across environments if schema is not fully aligned.

## 11. Frozen Boundaries / Non-Negotiables
Current HR work must continue to preserve:
- HR-first phase discipline (no POS/future-phase implementation leapfrogging).
- House as tenant boundary; no cross-house data exposure.
- Frozen HR-1 identity contracts (canonical identifier fields + canonical RPC signatures).
- No stealth contract changes to statuses, APIs, or semantics without explicit milestone approval.
- Additive, contract-safe evolution only.

## 12. Last Updated
Initial generated version created from repository audit on **2026-03-27 (UTC)**.
