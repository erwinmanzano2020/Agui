# POS-F3 Slice 7 Canonical Boundary Decision

## Summary
POS-F3 Slice 7 remains **planning-only** and **not started**.

This record is governance-only and selects a single canonical checkout session boundary model without authorizing runtime/API/UI/schema work.

## Options Evaluated
All allowed models were evaluated using the bounded criteria: scope clarity, operator accountability, no-leak safety, cancellation behavior, resumability pressure, concurrency risk, auditability posture, and avoidance of stealth persistence scope.

- **order-tied**
  - Strong scope clarity through a single explicit owner anchor (eligible current-session draft order).
  - Strong operator accountability because accountability can be attached to one order-owned boundary.
  - Conservative no-leak and cancellation framing with minimal ownership ambiguity.
  - Lower concurrency ambiguity than broader owner anchors.
  - Strong audit posture from a direct owner lineage.
  - Lowest stealth-persistence pressure among options for current bounded architecture.

- **session-tied**
  - Broader ownership surface than needed at this stage.
  - Adds resumability pressure at the session level that can be misread as continuity scope.
  - Increases risk of ambiguous ownership when multiple order contexts exist within a session.

- **device-tied**
  - Device is a location/terminal context, not the most conservative checkout ownership anchor.
  - Raises concurrency and accountability interpretation risk when different order contexts share device posture over time.
  - Encourages continuity language centered on terminal context rather than draft-order ownership.

- **bounded hybrid**
  - Can be made conservative only if one primary owner is explicitly dominant.
  - Even with explicit priority language, hybrid framing introduces additional interpretation surface at this stage.
  - Higher governance burden now with no immediate bounded benefit over a single-owner anchor.

## Decision
The canonical Slice 7 checkout session boundary model is **order-tied**.

This is a singular governance decision and is now locked for current POS-F3 Slice 7 planning posture.

Primary owner and constraints:
- **Primary container owner:** eligible **current-session draft order**.
- **Bounded guards/constraints only:** house -> branch -> session -> device exact-scope lineage, operator accountability requirements, and Slice 6 `ENTERABLE | BLOCKED` entry posture.
- **Not ownership:** session, device, operator, and broader scope context are required guardrails, not container owners.

## Why This Option Wins Now
Order-tied best matches current bounded POS architecture because it preserves a single ownership anchor while keeping all other dimensions as explicit safety guards.

It provides the most conservative fit for:
- scope-first exact lineage,
- operator-attributed accountability,
- no-leak deny consistency,
- bounded cancellation wording without persistence implication,
- lower concurrency ambiguity,
- auditability clarity,
- prevention of stealth persistence interpretation.

## Why The Other Options Were Not Chosen
- **session-tied** was not chosen because it broadens ownership beyond the minimum boundary needed now and increases resumability/concurrency interpretation pressure.
- **device-tied** was not chosen because terminal context is a guard dimension, not the strongest ownership anchor for checkout container definition.
- **bounded hybrid** was not chosen because current governance needs explicit single-owner clarity first; hybrid framing adds avoidable interpretation overhead at this stage.

## Risks Accepted
- Future slices may need explicit additive language if broader resumability framing is later authorized.
- The model intentionally favors strict ownership clarity over short-term flexibility.

These accepted tradeoffs are intentional to preserve phase discipline and avoid stealth scope expansion.

## Non-Goals
This decision record does **not** authorize or implement:
- checkout runtime behavior,
- payment/tender behavior,
- inventory behavior,
- receipt behavior,
- sale finalization behavior,
- persistence side effects,
- cross-session browsing,
- multi-order orchestration,
- any API/handler/UI/schema/test/migration work.

Slice 1 through Slice 5 remain closed and locked.

Slice 6 remains the only active bounded implementation slice and remains unchanged as checkout entry decisioning only.

## Outcome
A single canonical model is now locked for Slice 7 planning: **order-tied**.

Slice 7 remains governance-only, planning-only, and not started.
