# POS-F3 Slice 8 — Implementation Approval

## 1. Purpose

This is the separate implementation-approval record required by the Slice 7C Execution Boundary Definition and Slice 7D Implementation Planning. It authorizes the bounded POS-F3 Slice 8 Checkout Execution Coordinator implementation described below. It does not alter the planning-only status of Slice 7C or Slice 7D.

## 2. Authority chain

This approval follows, without reinterpreting:

1. the Agui Development Operating Principles and Roadmap phase gates;
2. the canonical POS Status;
3. the locked Slice 6 entry-decision contract;
4. the locked Slice 7A foundation contract;
5. the locked Slice 7B lifecycle contract;
6. the Slice 7C execution-boundary definition; and
7. the Slice 7D implementation plan.

The approved runtime dependency remains one-directional:

```text
Slice 6 -> Slice 7A -> Slice 7B -> Slice 8
```

Slice 8 must consume upstream authority through the Slice 7B lifecycle output. It must not directly evaluate, reinterpret, or modify Slice 6, Slice 7A, or Slice 7B.

## 3. Approved scope

Slice 8 is approved only to implement a server-only, current-session Checkout Execution Coordinator that:

- consumes an established Slice 7B lifecycle result and its locked Slice 7A foundation posture;
- validates exact house, branch, session, device, and order anchors;
- determines whether the execution boundary may continue; and
- returns one deterministic, read-only `READY` or `BLOCKED` result with bounded, non-sensitive blocker codes.

The coordinator may preserve an established `ACTIVE` lifecycle context but must not activate, persist, mutate, or otherwise change it.

## 4. Explicit non-goals

This approval does not authorize payment, tender, inventory reservation or deduction, receipt generation, sale completion, persistence, accounting, settlement, Operations integration, Finance integration, database queries or writes, APIs, routes, UI changes, schema changes, migrations, multi-order orchestration, or cross-session behavior.

Inventory remains gated by Operations authority and an approved integration contract. Accounting and settlement remain gated by Finance authority and an approved integration contract.

## 5. Required guardrails and verification

Implementation must remain deterministic, stateless, no-leak, exact-current-session scoped, and free of downstream runtime side effects. It must preserve frozen upstream contracts and return operational repository failures as operational errors rather than domain eligibility results.

Required verification includes focused coordinator unit tests, including the public factory path with legitimate active and inactive lifecycle contexts, plus lint, typecheck, build, and the relevant automated test suite.

## 6. Approval decision

**APPROVED:** POS-F3 Slice 8 Checkout Execution Coordinator bounded runtime implementation, subject to the scope, exclusions, and guardrails in this record.

This approval satisfies the separate approved-task requirement stated by Slice 7C and Slice 7D. It authorizes no later checkout capability.
