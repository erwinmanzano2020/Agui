# Current State (Engineering Handoff)

## 1. Frozen Foundations
"Frozen" means schema + contracts + semantics are stable. Changes require a dedicated migration task and explicit approval.

- HR-1 (Employee + Identity linking) — **FROZEN**
- HR-2.0 foundations (DTR canonical model) — **FROZEN**

## 2. Canonical Contracts
- Canonical DTR model: `public.dtr_segments`
- Reference: `docs/hr/hr-2-foundation-freeze.md`
- `time_in` / `time_out` are the canonical time fields
- No alternative DTR tables or legacy aliases should be introduced

## 2.1 HR Current Increment (Active)
- HR-2.1: Daily DTR Entry (Manual, House-Scoped)
  - Reference: `docs/hr/hr-2-1-daily-dtr-review.md`
  - Raw capture only (non-negotiable boundaries):
    - Multiple segments per employee/day are allowed
    - No schedule logic yet
    - No overtime computation rules yet (e.g., 10-min minimum OT, OT after scheduled end)
    - No lunch-break rules yet
    - No auto-close / one open segment max rule unless it already exists
  - Timezone caution (short):
    - `time_in` / `time_out` are stored as timestamptz
    - Construction/parsing can be timezone-sensitive (e.g., `new Date(...)`)
    - Keep create/update consistent and avoid tests depending on local machine timezone
  - Next increment once merged: HR-2.2 schedule templates + branch assignments
    - Reference: `docs/hr/hr-2-2-schedules-freeze.md`

## 3. Non-Negotiable Guardrails
- All HR/DTR data is house-scoped
- Cross-house writes are forbidden and enforced at DB level
- PostgREST schema must be reloaded after migrations
- `db.types.ts` must be regenerated after schema changes
- Destructive migrations are only allowed when explicitly stated

## 4. What Is NOT Frozen Yet
- DTR insert/update APIs
- Hours worked computation logic
- Overtime rules
- Approval workflows
- Audit/correction flows

## 4.1 Next Likely HR Increments
- HR-2.2: Schedule definition per house/branch (work windows)
  - Reference: `docs/hr/hr-2-2-schedules-freeze.md`
- HR-2.3: Overtime rules engine (house-configurable thresholds)
- HR-2.4: DTR validation / closing workflow (optional approvals)
- HR-2.5: Payroll rollup integration from DTR segments

## 5. How to Use This Document
- Referenced at the start of Codex tasks
- Linked in future specs
- Used as a copy-paste context for new ChatGPT threads

> Context: HR-1 and HR-2.0 foundations are frozen. Canonical DTR model is dtr_segments as documented in docs/hr/hr-2-foundation-freeze.md.
