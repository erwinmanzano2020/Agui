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

## 5. How to Use This Document
- Referenced at the start of Codex tasks
- Linked in future specs
- Used as a copy-paste context for new ChatGPT threads

> Context: HR-1 and HR-2.0 foundations are frozen. Canonical DTR model is dtr_segments as documented in docs/hr/hr-2-foundation-freeze.md.
