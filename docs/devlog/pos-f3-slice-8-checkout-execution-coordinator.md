# POS-F3 Slice 8 — Checkout Execution Coordinator

## Purpose

Slice 8 is the bounded Checkout Execution Coordinator implementation record. Its separate authorization is recorded in [`pos-f3-slice-8-implementation-approval.md`](./pos-f3-slice-8-implementation-approval.md). It evaluates the already-locked checkout authority chain and returns one deterministic coordinator result. It does not perform checkout or any downstream business effect.

## Authority and dependency direction

The coordinator consumes the locked lifecycle result from Slice 7B. That result carries the locked Slice 7A foundation posture, which in turn is the only permitted route by which the Slice 6 entry decision is consumed. This preserves the one-directional contract:

```text
Slice 6 entry decision -> Slice 7A foundation -> Slice 7B lifecycle -> Slice 8 coordinator
```

Slice 8 does not directly re-evaluate or reinterpret Slice 6, Slice 7A, or Slice 7B.

## Implemented contract

`getCurrentSessionOrderCheckoutExecutionCoordinator` accepts one exact current-session scope and returns:

- `READY` only when the received lifecycle result is `ACTIVE`, its received foundation posture is `FOUNDATIONAL`, and its lifecycle anchor matches the requested house, branch, session, device, and order;
- otherwise `BLOCKED`, with deterministic, bounded, non-sensitive blocker codes; and
- a scope summary containing only the requested anchors and received upstream statuses.

The coordinator is stateless, read-only, deterministic, and has no time, random, persistence, or downstream integration dependency. Its repository factory consumes an already-established Slice 7B lifecycle repository directly, preserving its legitimate lifecycle context (including `ACTIVE`) rather than rebuilding or degrading it. It does not activate or mutate the container lifecycle. A repository operational error is rethrown rather than represented as a domain blocker.

## Explicit exclusions

This slice does not implement payment, tender, inventory reservation or deduction, receipt generation, sale completion, accounting, settlement, Operations integration, Finance integration, schemas, migrations, UI/API changes, multi-order behavior, or cross-session behavior.

No database query, mutation, route, API, schema, migration, authorization contract, or tenancy model was changed. The coordinator is current-session scoped through its exact anchor comparison; a mismatching house anchor is blocked, so it cannot turn a foreign-house lifecycle snapshot into an eligible result.

## Verification

Unit coverage verifies direct and factory-created READY paths, factory preservation of inactive lifecycle context, foundation and lifecycle rejection, each repository boundary class, deterministic evaluation, no mutation leakage, and safe anchor mismatch handling. The full lint, typecheck, build, and test suite are required before this slice is considered stable.
