# POS F3 Slice 4 — Review Validation / Checkout Readiness (Planning Only)

## Summary
This entry records **planning only** scope for POS-F3 Slice 4.
Slice 4 remains **gated**, **not started**, and strictly bounded to **pre-checkout read-only validation** for the exact current-session draft order context.

The slice definition is intentionally conservative and exists to prevent scope drift into checkout, payment, inventory, or finalization behavior.

## Key Decisions
- Slice 4 is defined as current-session only, draft-order only, and read-only validation only.
- Slice 4 is explicitly pre-checkout and cannot execute checkout behavior.
- Validation scope is bounded to existing POS draft/session/pricing constraints and exact scope lineage.
- Output is conceptual-only in this planning record (status + issues + machine-safe codes + summary).
- Explicit initiation is required before implementation; this planning record does not authorize code changes.

## Proposed Validation Scope
Slice 4 should answer only:

**“Is this exact current-session draft order ready to proceed to a future checkout slice?”**

Bounded readiness inputs to validate:
- scoped order exists,
- order is still `DRAFT`,
- session is still `OPEN`,
- scope is exact: `house -> branch -> session -> device -> order`,
- order has at least one active line,
- active lines are valid for bounded review purposes,
- pricing is resolvable under existing server pricing rules,
- no missing price state exists,
- no invalid scoped context exists.

Conceptual readiness result shape (planning only):
- readiness status,
- blocking issues list,
- machine-safe issue codes,
- read-only validation summary.

## Explicit Non-Goals
Slice 4 does **not** include:
- checkout execution,
- sale finalization,
- payment/tender capture,
- inventory reservation/deduction,
- receipt generation,
- persistence of readiness snapshots,
- cross-session browsing,
- multi-order queue orchestration,
- finance/ledger effects.

## Risks / Misreadings Prevented
- Prevents misreading “checkout readiness” as “checkout now exists.”
- Prevents stealth expansion into tender/payment or inventory-coupled behavior.
- Prevents implied authorization to finalize orders or create sale records.
- Prevents cross-session/multi-order queue scope creep in a current-session slice.
- Preserves phase discipline by keeping Slice 4 gated until explicit implementation initiation.

## Outcome
- POS-F3 Slice 4 is now clearly bounded as a **planning-only** target.
- Slice 4 remains **gated** and **not started**.
- No runtime behavior, schema, API, route, UI, or test behavior was changed by this planning artifact.
