# POS Master Plan (Canonical)

## 1. Purpose
This document is the canonical planning anchor for the POS module. It defines POS scope, boundaries, phase intent, and non-negotiable constraints before implementation work begins.

It is governance/planning authority for POS and does not authorize implementation by itself.

## 2. Positioning in Agui Architecture
- POS is an Agui module, not a separate product.
- Phase 1 POS remains in the same Agui app/codebase.
- POS is an operational terminal surface, not a generic admin page.
- POS must inherit Agui tenancy, access, and identity guardrails without reinterpretation.

## 3. Why POS Is the Next Active Module
Roadmap and HR checkpoint alignment establish POS as the next eligible module:
- HR is documented as stable enough to unlock POS planning/start.
- POS is next in the approved system priority (HR → POS → Operations → Finance → Growth).
- POS startup must preserve HR frozen boundaries and hardening continuity.

## 4. Current Execution Posture
- Module state: foundation-defined, implementation-not-started.
- Execution mode: documentation-first foundation wave.
- Current objective: complete canonical POS foundation set so implementation tasks can be planned safely.

## 5. POS Operating Definition
POS in Agui is defined as:
- a controlled in-house terminal workflow for branch operations,
- using explicit device/session discipline,
- with accountable human operators,
- under house-scoped tenancy and deny-by-default access behavior.

## 6. Scope Boundaries (Current)
In scope for POS foundation and Phase 1 planning:
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

## 9. High-Level POS Phase Direction
### POS-F0: Foundation (current)
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
2026-04-01 (UTC)
