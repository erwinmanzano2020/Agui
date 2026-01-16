# HR-2.1 Daily DTR Entry (Manual, House-Scoped) — Review Checklist & Guardrails

## Purpose
HR-2.1 delivers **Daily DTR Entry (Manual, House-Scoped)** that records raw attendance segments only. This layer answers **“what happened”** and intentionally avoids schedules, overtime rules, or payroll interpretation.

## Canonical References
- HR-2.0 foundation freeze: `docs/hr/hr-2-foundation-freeze.md`
- Canonical migration: `supabase/migrations/20261002100000_create_dtr_segments.sql`

## HR-2.1 Contracts & Guardrails
- Multiple segments per employee per day are allowed (no merging/collapsing).
- `source` is **manual** for this page.
- `status` uses `open | closed | corrected`, but **no closing rules** are defined in HR-2.1.
- House scoping rules:
  - Employee must belong to the house.
  - Caller must have HR access (same access pattern as HR-1).

## Time Handling Caution (Explicit)
Current implementation uses:
```
new Date(`${workDate}T${timeValue}:00`).toISOString()
```
This interpretation depends on runtime timezone rules and can differ between server/browser environments.

**HR-2.1 stance:** timezone correctness is intentionally **not solved yet**, but **must remain consistent across create/update**, and **tests must not depend on dev machine timezone**.

**Future work:** standardize on Asia/Manila **or** store local-intended times and interpret later.

## Open Segment Minimal Rules
- Must support creating a segment with **only `time_in`**.
- Must allow later update to set **`time_out`**.
- **No “single open segment” constraint** unless explicitly introduced later (NOT part of HR-2.1).

## UI Expectations
- Date picker works.
- Employee filter works.
- Segments list clearly per day.
- Add/update does **not** apply schedule/OT interpretation.

## Test Coverage Pointers
- Tests live at: `src/lib/hr/__tests__/dtr-segments-server.test.ts`
- Confirm **cross-house denial** coverage exists.
- Confirm **multi-segment day** coverage exists.

## Boundary Statement (Very Clear)
HR-2.1 is **raw capture only**. Schedule rules, overtime rules (e.g., 10-minute minimum, OT after scheduled end), and house-specific policies belong to **later phases** (HR-2.2+ / HR-2.3+).

## Common Debug Pitfalls
- PostgREST schema cache mismatch: run `notify pgrst, 'reload schema'` after migrations.
- Schema vs types mismatch: regenerate `db.types.ts` whenever schema changes.

---

## Quick Review Checklist (HR-2.1)
1) Confirm the “raw truth” contract is preserved
✅ Multiple segments per employee/day are allowed (no merging).
✅ source stays manual for this page.
✅ status stays open/closed/corrected but no “closing rules” yet.

2) Access control sanity
Confirm server helpers enforce:
- employee belongs to house
- caller has HR access (same pattern as HR-1)
Confirm cross-house denial test exists.

3) Time handling (common pitfall)
Make sure toTimestamp(workDate, timeValue) is consistent and explicit:
If you’re using new Date(${workDate}T${timeValue}:00).toISOString(), that will interpret the string in local/browser timezone rules depending on runtime.
Prefer a deterministic approach for PH:
- Either store as “local intended” and interpret later, or
- Standardize on a known timezone for construction (Asia/Manila) and document it.
If you’re not ready to solve timezone correctness now, that’s fine—just ensure:
- It’s consistent across create/update
- Tests don’t accidentally depend on local machine timezone

4) Open segment rules (minimal, but important)
Confirm the update flow allows:
- Create segment with only time_in
- Later set time_out
- And it doesn’t require “one open segment max” (unless you intentionally added that rule—if not, don’t add it yet)

5) UI behavior
- Date picker works
- Employee filter works
- Lists segments clearly per day
- Add/update doesn’t reintroduce schedule/OT interpretations

6) Docs / handoff additions
Make sure it mentions:
- HR-1 frozen + HR-2.0 frozen
- HR-2.1 implements “Daily DTR Entry (Manual)”
- And explicitly notes the “no schedule/OT yet” boundary
