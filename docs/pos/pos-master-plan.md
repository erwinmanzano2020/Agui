# POS Master Plan (Canonical)

> **Execution posture — paused/historical:** By explicit owner-approved Roadmap transition, POS is paused after merged PR #488 and HR is the sole active development phase. This plan remains canonical for preserving POS scope, boundaries, and frozen contracts; it does not authorize current POS definition, planning, implementation, or runtime changes. POS may resume only through a future explicit Roadmap/phase decision.

## 1. Purpose
This document is the canonical planning anchor for the POS module. It preserves POS scope, boundaries, historical phase intent, and non-negotiable constraints established through the merged PR #488 checkpoint.

It remains the governance/planning authority for POS contracts, but its execution posture is paused and historical. It does not authorize new POS planning or implementation by itself, and it is subordinate to the current Roadmap phase decision that reactivated HR.

## 2. Positioning in Agui Architecture
- POS is an Agui module, not a separate product.
- Phase 1 POS remains in the same Agui app/codebase.
- POS is an operational terminal surface, not a generic admin page.
- POS must inherit Agui tenancy, access, and identity guardrails without reinterpretation.

## 3. Historical POS Activation Context (Superseded)
The following context records why POS was previously activated; it is not current execution authority:
- HR was documented as stable enough to unlock POS planning/start.
- POS was next in the approved system priority (HR → POS → Operations → Finance → Growth).
- POS startup was required to preserve HR frozen boundaries and hardening continuity.

The owner-approved Roadmap transition after merged PR #488 supersedes that activation posture: POS is now paused and HR is the sole active development phase.

## 4. Current Execution Posture
- Module state: paused after merged PR #488; not abandoned.
- Preserved checkpoint: POS-F3 Slice 12 Tender Intent runtime.
- Execution mode: historical preservation only. No further POS definition, planning, runtime, native application, offline-sync, or hardware-integration work is authorized while HR is active.
- Current objective: preserve the checkpoint runtime and all frozen POS contracts unchanged until a future explicit Roadmap/phase decision reactivates POS.
- Runtime/schema/API/migration impact of the transition: none.

## 5. POS Operating Definition
POS in Agui is defined as:
- a controlled in-house terminal workflow for branch operations,
- using explicit device/session discipline,
- with accountable human operators,
- under house-scoped tenancy and deny-by-default access behavior.

## 6. Scope Boundaries (Preserved Historical Definition)
The following scope is preserved for contract and historical context only; it is not currently authorized work.

Historically in scope for POS foundation and Phase 1 planning:
- device/session model definition
- operator sign-in direction (employee QR identifier + POS PIN)
- branch-limited in-house operation rules
- order/payment conceptual flow boundaries
- access, identity, and storage ownership guardrails

Out of scope at this stage:
- standalone POS app split
- native mobile POS assumptions
- expanded cross-module finance settlement design
- inventory coupling beyond explicitly approved POS slice
- implementation details (schema/API/UI code)

## 7. Relationship to HR and Shared Identity
- POS does not own identity.
- POS reuses shared identity and HR employee foundations.
- Employee identity lookup signals who the operator is; POS credentialing governs terminal operation rights.
- POS PIN is operational credential data owned by POS, not HR employee core identity data.

## 8. Tenancy and Branch Rules
- House remains the tenant boundary for all POS reads/writes.
- Branch is an in-house limiter for operational context.
- Branch does not replace house tenancy and must never allow cross-house inference.
- POS device records are house-scoped and branch-bound.

## 9. High-Level POS Phase Direction (Historical)
These phase descriptions preserve the original direction and do not authorize continuation while POS is paused.

### POS-F0: Foundation (historical)
Canonical docs, boundaries, vocabulary, and anti-drift guardrails.

### POS-F1: Core Terminal MVP
Minimal safe terminal flow:
- operator sign-in via employee QR identifier + POS PIN,
- open/use/close POS session on a bound device,
- create/order lifecycle baseline,
- payment capture records within approved POS scope.

### POS-F2: Stabilization and Expansion (future, deferred)
Operational hardening and additive capabilities only after F1 stability checkpoint.

## 10. Explicit Out-of-Scope (for now)
- Schema migration design or table-level implementation.
- API contract implementation.
- UI implementation tasks.
- Auth/RBAC redesign.
- Tenancy model reinterpretation.
- Middleware/platform rewrites.
- Contract invention outside governing docs.

## 11. Submodule Rule
Any POS submodule must inherit POS/system rules and must not redefine tenancy, identity, access, or no-leak behavior.

## 12. Last Updated
2026-08-27 (UTC) — execution posture reconciled with the approved POS-to-HR transition after merged PR #488; frozen POS contracts and runtime remain unchanged.
