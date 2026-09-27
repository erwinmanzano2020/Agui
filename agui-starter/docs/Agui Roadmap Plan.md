# Agui Roadmap Plan

## Source of Truth
- Development Operating Principles: [`../../agui-development-operating-principles.md`](../../agui-development-operating-principles.md)
- HR execution snapshot: [`docs/hr/hr-status.md`](../../docs/hr/hr-status.md)
- HR frozen contracts: [`docs/hr/hr-master-plan.md`](../../docs/hr/hr-master-plan.md)
- HR execution-aligned plan: [`docs/hr/hr-master-plan-expanded.md`](../../docs/hr/hr-master-plan-expanded.md)

## Current System Phase (Canonical)
- Active system: **HR System — end-to-end MVP** (sole active development phase)
- Execution mode: narrowly scoped **Foundation Security Correction** implementation is
  authorized only through (1) the separate historical Daily DTR write-authorization P1
  approval and (2) the ordered GAP-024 implementation gates. Each runtime slice still
  requires its own bounded Codex task aligned to the applicable implementation-approval
  record. This does not broadly reopen HR runtime or authorize unrelated HR work.
- Phase activation note: by explicit owner decision, HR is reactivated after POS paused at merged PR #488
- POS is paused, not abandoned. Its preserved checkpoint is **POS-F3 Slice 12 Tender Intent runtime** from merged PR #488.
- No further POS definition, planning, runtime, native application, offline-sync, or hardware-integration work is authorized while HR remains active. Future POS ideas may be logged without interrupting HR, and POS may resume only through a later explicit Roadmap/phase decision.
- Future systems remain gated
- Phase-based execution discipline remains in force (one active phase at a time)

## HR Track Status
- HR-0 to HR-3.5: **implemented baseline, hardening-active**
- Historical checkpoint claim: HR was assessed as functionally complete at the then-approved MVP implementation baseline; the reactivated phase's required current-state audit must verify whether the intended lifecycle is complete end to end
- Remaining work is focused on:
  - regression depth
  - parity enforcement
  - UX consistency
  - runtime confidence
- Historical posture: HR was treated as undergoing stabilization rather than awaiting feature completion; this is evidence for the audit, not a current completeness determination

## Current Execution Focus
- **Gate A is released** at squash merge
  `71d11b79c002dce9b65e786ecb30ecfa9abdd494`.
- **Gate-B pre-P1 containment is released and Production-verified.** PR #512 was
  squash-merged as `df7bbeb11d016297a0a6dbd5d41c998441294c36`; all six Gate-B
  migrations were applied and raw DTR application mutation remains contained.
- **Historical Daily DTR Write P1 is released and Production-verified.** PR #514 was
  squash-merged as `a95c3c921e067297f4f033620fe2f4ede7e7c5aa`; all three P1
  migrations are in Production; Vercel Production deployment
  `dpl_HskHAzyWYZShZo3Y1Sesa4fJEAJK` serves that exact commit.
- Post-P1 Production verification preserved 96/96 canonical bridge coverage, 96 current
  authorization-projection rows, zero active facts missing projection, zero unbridged
  compatibility rows, and the released **raw DTR-table** no-bypass privilege posture.
  The broader canonical/supporting-state privilege audit below found the Remaining-Gate-B
  gaps that are now being planned.
- **Current bounded target: GAP-024 Remaining Gate B — PLANNING RE-ENTRY /
  AMENDMENT REVIEW IN PROGRESS.**
  Durable planning artifact:
  `docs/devlog/gap-024-remaining-gate-b-completion-plan.md`.
  Original planning PR **#515 — Plan GAP-024 Remaining Gate B completion** was explicitly
  owner-approved and squash-merged as
  `908e36eb1861f3ba76426927f0968ed0caf0fdcb`.
  Runtime PR **#516 — Implement GAP-024 Remaining Gate B closure** is Draft/unmerged and
  paused after its exact-scope review exposed one bounded planning omission.
  Current planning amendment PR:
  **#517 — Amend GAP-024 Remaining Gate B planning for kiosk reject identity**
  (Draft / planning-only / unapproved).
- The original privilege/adapter closure remains unchanged: two ordered forward
  migrations, narrow kiosk support RPCs, exact-head producer discovery, released Gate-B +
  P1 harness reuse/composition, deterministic rebuild/replay proof, and Production
  invariant verification.
- The amendment adds only the missing authorized `agui-starter/src/lib/hr/kiosk/service.ts`
  surface required by the new support-event identity validation. For
  `house_mismatch` / `employee_not_found`, an unverified QR employee claim cannot
  populate authoritative kiosk-event `employee_id`; use null identity and preserve the
  claim only as non-authoritative `claimedEmployeeId` audit metadata. Verified
  same-House employee identity continues unchanged.
- Planning Review & Fix is reopened only for PR #517. The next authorized action is to
  converge that planning amendment and request explicit owner approval. Runtime PR #516
  must remain paused until the amendment is owner-approved and merged, then that existing
  Runtime PR may resume against the amended contract. No duplicate Runtime PR is needed.
- No Production mutation or Remaining-Gate-B release is authorized by this amendment.
  No new schema/RPC/event type/user-facing workflow is added. Gate C/D/E, unrelated HR
  work, POS, Operations, and Finance remain unauthorized.
- DEC-017 sequence remains:
  Gate A → Gate-B pre-P1 containment → Historical Daily DTR P1 → **Remaining Gate B** →
  Gate C → Gate D → Gate E.
- Gate C remains blocked until Remaining Gate B itself completes its separate planning,
  Runtime/verification, release, and owner gates.
- keep general HR feature development, POS, Operations, Finance, and unrelated refactors
  gated; preserve scope-first/no-leak, House tenancy, branch-restriction, identity, and
  frozen-contract guardrails.

## HR Stability Gate (Satisfied; POS Unlock Recorded)
HR can be considered stable enough to move forward **only** when:
- no known tenancy or cross-house leakage risks
- branch-limited behavior is consistent across all read paths
- metadata and row payload parity is enforced system-wide
- payroll run and payslip behavior is stable and predictable
- kiosk flows are operationally reliable
- regression coverage exists for all high-risk boundaries

Gate verdict (as of **2026-03-31 UTC**): **STABLE ENOUGH TO UNLOCK BOUNDED POS FOUNDATIONS**.
Checkpoint rationale: blocker-class HR streams for tenancy/access consistency, branch-scope parity, and no-leak parity are documented closed with no known blocker regressions remaining in repository evidence.
Transition record: this checkpoint is the sequencing unlock condition that moved active-phase focus from HR to POS; it is not a relaxation of phase controls.

## Historical POS Unlock (Superseded by Current Pause Decision)
- Next system: POS
- Historical status: POS was eligible to start in bounded foundation scope (conservatively unlocked by HR blocker-closeout checkpoint)
- Unlock condition: HR stability gate satisfied (**met on 2026-03-31 UTC**)
- Bounded POS foundations were permitted to proceed after the recorded HR stability checkpoint, within explicit POS scope limits
- Inventory-coupled and finance-coupled POS behaviors remain separately gated
- Historical note: HR remained hardening-active while POS proceeded. The current phase decision above now pauses POS and reactivates HR; this section records the earlier sequencing unlock and does not authorize current POS work.

## Historical POS Dependency Boundaries (Preserved)
The canonical module order remains unchanged: **HR → POS → Operations → Finance → Growth/advanced systems**.

POS continuation is split into explicit dependency-bounded layers:

1. **POS Foundations / Early POS (allowed after HR stability checkpoint)**
   - device/session/operator accountability
   - scoped draft-order behavior
   - bounded order-line foundations
   - no-leak + scope-first operational rules

2. **Inventory-Coupled POS (gated on Operations foundation)**
   - stock deduction
   - UOM inventory behavior
   - bundles, repacking, or raw-material-linked selling
   - supplier/inventory source-of-truth coupling

3. **Finance-Coupled POS (gated on Finance foundation)**
   - settlement/accounting entries
   - credit or payroll-deduction integrations
   - finance-ledger consequences

Historical roadmap interpretation: bounded POS foundation continuation was authorized after HR stability. The current phase decision supersedes that authorization while POS is paused; no POS layer may continue until a future explicit Roadmap/phase decision.

## Operations and Finance Role Clarification
- Operations owns inventory, purchasing, and stock-flow foundations.
- Any deeper POS behavior that mutates, reconciles, or depends on stock state must wait for Operations foundation readiness.
- Finance owns settlement, accounting, and ledger-facing foundations.
- Any POS behavior with finance-ledger or settlement consequences must wait for Finance foundation readiness.

## Tenancy and Identity Invariants Across Phases
- House remains the tenant boundary.
- Branch remains a location limiter, not a tenant replacement.
- Identity remains shared platform infrastructure across modules.
- Lookup-first behavior remains canonical across module boundaries.

## Notes
- This roadmap update is governance alignment only. Its implementation authority is
  limited to the separately approved historical Daily DTR write P1 and the ordered
  GAP-024 security gates; no other implementation scope is introduced.
- No module reordering is authorized.
- Any work that changes frozen contracts, tenancy boundaries, identity boundaries, or phase gates must be explicitly approved in governing docs.
