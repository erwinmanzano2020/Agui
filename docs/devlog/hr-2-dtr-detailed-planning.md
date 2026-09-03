# HR-2 DTR Detailed Planning

## 1. Status and authority

- **Status:** reconciled contract; documentation only.
- **Reconciled:** 2026-09-03 UTC, after the PR #492/#493 authorization-security stabilization.
- **Implementation authority:** none. This record does not authorize runtime, UI,
  API, schema, migration, approval, payroll, or HR-4 implementation.
- **Existing implementation posture:** partial baseline only; see
  `docs/hr/hr-status.md`. Planned behavior below is not a claim that it exists.

This is the existing primary HR-2 planning record. It reconciles, rather than
duplicates, the HR-2 requirements in `docs/hr/hr-master-plan.md`, the evidence in
`docs/devlog/hr-current-state-audit-2026-08-28.md`, and the lower-level raw-capture
guardrails in `docs/hr/hr-2-1-daily-dtr-review.md`.

House remains the tenant boundary. Branch remains a location and access
restriction, never a substitute tenant boundary. The capability, deny/no-leak,
access-derived branch restriction, and owner/manager house-authority rules
stabilized by PR #492/#493 remain in force. This reconciliation changes none of
those rules and changes no frozen HR-1 identity contract.

## 2. Required HR-2 outcome

HR-2 is the attendance-fact and DTR-correction-record layer. It must:

- support a per-employee month view and a per-employee custom date-range view;
- represent every calendar day in the selected period, in deterministic date order;
- distinguish a day with no DTR from a day evaluated as zero worked hours;
- explicitly represent incomplete clock records;
- provide an explicit DTR correction/edit flow;
- require a correction reason and attribute the correction actor and timestamp;
- retain traceable original and corrected attendance values without silently
  overwriting the original attendance;
- identify payroll-impacting corrections and hand them to HR-4 approval authority;
- exclude a rejected payroll-impacting correction from payroll-ready facts; and
- prepare attendance facts without calculating payroll.

All reads and writes remain house-scoped and no-leak. Any branch restriction must
be derived from the authorized actor's scope and applied as a restriction; a caller
supplied branch or employee identifier cannot widen access.

## 3. HR-2.1 raw-capture compatibility

HR-2.1 remains the lower-level raw-capture guardrail, not the complete HR-2
lifecycle contract. Its existing contract is preserved:

- multiple segments per employee/day are allowed;
- segments are not implicitly merged or collapsed;
- raw capture records what happened and does not apply schedule, overtime, or
  payroll interpretation; and
- an open segment may contain only `time_in`, may later receive `time_out`, and is
  not subject to a one-open-segment rule unless a future authorized contract adds
  one.

The raw segment `status` values (`open | closed | corrected`) describe individual
capture records only. They do not decide whether a whole day/period is complete,
whether a correction has approval, or whether attendance is payroll-ready.

## 4. Separate state dimensions

The following dimensions must remain separate. The labels below describe planning
semantics; they do not authorize new columns, enums, APIs, or state machines.

| Dimension | Owner | Meaning |
|---|---|---|
| Raw segment status | HR-2 raw capture | Whether an individual captured segment is `open`, `closed`, or marked `corrected`; multiple segments remain independent. |
| Day/period evaluation | HR-2 | Whether the selected day has no record, has incomplete attendance, is complete enough to evaluate, or is blocked. Evaluation must consider all represented days without rewriting raw segments. |
| Correction state | HR-2 record + HR-4 decision | HR-2 records proposed original/corrected lineage and whether it affects payroll; HR-4 supplies any required pending/approved/rejected decision. |
| Payroll-ready state | HR-2 handoff boundary | Whether an evaluated attendance fact has no unresolved blocker and any payroll-impacting correction has an HR-4 approval. It is not a payroll calculation. |

Consequently, `NO_RECORD`, `INCOMPLETE`, `COMPLETE`, and `BLOCKED` are day/period
evaluation concepts; correction pending/approved/rejected is a separate lifecycle;
and `PAYROLL_READY` is a separate eligibility result. They must not be compressed
into one raw segment status. A rejected correction remains audit history and cannot
become a payroll-ready fact, while the unchanged base attendance may be evaluated
separately under the normal rules.

No-record handling is intentionally explicit: absence is not zero hours and must
not be inferred to be payable. A future policy may classify a represented day, but
this contract does not invent that policy.

## 5. Correction contract and ownership boundary

### HR-2 owns

- attendance facts and DTR correction records;
- correction reason, correcting actor identity, and correction timestamp;
- original-versus-corrected lineage and a non-destructive audit trail;
- identification of whether a correction affects payroll; and
- handoff of payroll-impacting corrections to HR-4.

### HR-4 owns

- approval authority and the approval/rejection decision;
- approver attribution;
- approval status and timestamps;
- rejection reason; and
- approval audit evidence.

HR-2 does not approve its own corrections. Until HR-4 approves a
payroll-impacting correction, that corrected path is not payroll-ready. Rejection
must not promote the rejected values into payable inputs. HR-2 may retain an HR-4
decision reference for lineage, but that does not transfer approval ownership to
HR-2. HR-4 implementation is not authorized by this record.

## 6. Attendance and payroll boundary

HR-2 may prepare normalized attendance facts or candidates such as payable
days/hours, late or undertime minutes, overtime/rest-day/holiday-work candidates,
approved leave markers when available, correction markers, and attendance
summaries. These are attendance outputs, not payroll calculations.

HR-2 does not calculate salary, deductions, payouts, or accounting entries; does
not finalize payroll; and does not manufacture approval. Schedule facts, when
needed, are supplied by HR-4. If no schedule exists, HR-2 must represent that
absence rather than infer a schedule. Raw capture remains interpretation-free.

## 7. Required validation and future verification

Any separately authorized implementation must preserve deterministic, bounded,
non-sensitive failures for invalid ranges, out-of-house employees, unauthorized or
out-of-branch targets, incomplete clocks, missing correction reasons, unresolved
payroll-impacting approvals, conflicting records, and schedule ambiguity when a
schedule-dependent evaluation is requested.

Future coverage must verify at least:

- month and custom-range views represent every day;
- no-DTR differs from zero hours, and incomplete clocks remain explicit;
- multiple raw segments survive without implicit collapse;
- corrections require reason/actor/timestamp and preserve before/after lineage;
- pending or rejected payroll-impacting corrections cannot supply corrected
  payroll-ready facts;
- only HR-4 approval can resolve the approval decision;
- house, branch, capability, and deny/no-leak rules hold for reads and writes; and
- operational failures are not disguised as attendance states.

Production-like RLS/grant/RPC parity and realistic multi-house/branch UAT remain
required independently of repository tests.

## 8. Proposed options — owner decision required

The following ideas are useful but are **not approved HR-2 or HR-4 requirements**:

- a separate employee/requester submission lifecycle;
- withdrawal or cancellation of a correction request;
- evidence or attachment requirements;
- generalized requester-versus-approver separation beyond HR-2's inability to
  approve its own correction;
- a broad self-approval policy beyond that confirmed boundary;
- escalation or fallback approvers;
- multi-level approvals; and
- additional approval-policy machinery.

They must remain proposed until an explicit owner decision and must not block the
confirmed HR-2 contract or be inferred from this planning record.

## 9. Implementation reconciliation

| Capability | Current classification |
|---|---|
| Manual daily raw segment capture, including independent/open segments | Existing baseline; bounded by HR-2.1 and only partially verified. |
| Monthly single-employee all-days grid | Partially implemented; not proof of the complete period contract. |
| Custom date-range view and complete explicit evaluation semantics | Still missing/planned. |
| Correction reason, actor/timestamp, and original/corrected lineage as the confirmed lifecycle | Still missing/planned. A raw segment marked `corrected` is not proof of this lifecycle. |
| HR-4 approval authority and approval audit lifecycle | Documentation/contract only; not HR-2 implementation. |
| Approval-aware payroll-ready attendance handoff | Still missing/planned end to end. |
| Authorization-security stabilization | Implemented in the PR #492/#493 checkpoint, with production-like/manual verification still outstanding; it does not implement HR-2 lifecycle behavior. |

Historical “baseline implemented,” “usable,” or stability-checkpoint language means
repository coverage at that time, not end-to-end completion of this contract.

## 10. Non-goals and next gate

This reconciliation does not implement or authorize UI/API expansion, schema or
migrations, schedules, approvals, payroll computation, identity changes, tenancy
changes, POS, or any other runtime behavior. It also does not create an HR-2 Codex
implementation task.

Any implementation requires a separate owner-authorized gate that selects a
bounded slice from this confirmed contract. Optional ideas in Section 8 require
their own owner decision and are not prerequisites for that gate.
