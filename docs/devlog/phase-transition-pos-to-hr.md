# Phase Transition — POS → HR

## Status and Authority
- **Decision:** Pause POS and reactivate HR as Agui's sole active development phase.
- **Owner authorization:** Explicit.
- **Decision recorded:** 2026-08-27 UTC.
- **Effective checkpoint:** After merged PR #488.
- **Governing references:** [`Agui Roadmap Plan`](../../agui-starter/docs/Agui%20Roadmap%20Plan.md), [`AGENTS.md`](../../AGENTS.md), [`HR status`](../hr/hr-status.md), and [`POS status`](../pos/pos-status.md).

## Preserved POS Checkpoint
POS is paused, not abandoned. The preserved checkpoint is **PR #488 — POS-F3 Slice 12 Tender Intent runtime**. Its runtime and frozen upstream contracts remain untouched. No further POS definition, planning, runtime, native application, offline-sync, or hardware-integration work is authorized while HR is active.

## Reason
- POS is moving toward native/frontline execution.
- Proper validation will later require an appropriate local test PC and a real POS hardware environment.
- Continuing speculative POS or backend work is not authorized.
- HR remains the foundational system to complete end to end.

Future POS ideas may be logged without interrupting HR. Logging an idea does not authorize planning or implementation.

## Immediate Next Action
The first permitted HR task after this governance transition is a **documentation/read-only HR current-state audit** against the canonical HR Master Plan and actual runtime. This record neither performs that audit nor defines or implements the next HR feature.

## Impact and Resumption Boundary
- **Runtime impact:** None.
- **Data/schema impact:** None.
- **Identity, tenancy, security, and architecture impact:** None; existing contracts remain unchanged.
- **HR completion impact:** No new HR capability is declared complete, and no HR runtime implementation is authorized.
- **Rollback/resumption implication:** POS may be reactivated only through a future explicit Roadmap/phase transition.
