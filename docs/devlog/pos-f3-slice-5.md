# POS-F3 Slice 5 — Bounded Checkout Transition Intent (In Progress)

## Summary
This devlog records implementation start for **POS-F3 Slice 5** as a narrowly bounded, read-only transition intent layer.

Slice 5 in this change is **not checkout execution**. It only answers whether the exact current-session draft order can cross the boundary into a future checkout slice.

## What This Slice Adds
- A server-only bounded helper for current-session transition intent (`house -> branch -> session -> device -> order`).
- Canonical machine-safe transition result shape (`ALLOWED | BLOCKED`) with deterministic blocker posture.
- Thin server action exposure for the transition payload.
- Read-only session panel that displays transition status, blockers, and summary from server results.
- Targeted unit/action/client-hardening tests for allow/deny/stale/consistency behavior.

## What This Slice Explicitly Does Not Add
This slice does **not** implement:
- checkout execution,
- payment/tender behavior,
- inventory behavior,
- receipt behavior,
- sale creation/finalization,
- persistence side effects,
- cross-session behavior,
- multi-order behavior.

## Scope Boundaries Preserved
- Exact-scope only and no-leak deny posture are preserved.
- Invalid or closed scoped contexts deny safely.
- Transition output remains conservative and read-only.
- Client does not infer transition permission locally; it only renders server payload.

## Outcome
POS-F3 Slice 5 is now **in progress** as bounded checkout transition intent only, with checkout capability still out of scope and not implemented.
