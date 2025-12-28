# HR Identity & Onboarding Notes

Phase alignment: Phase 1 (HR employee onboarding) focuses on lookup-first flows and duplicate prevention; later phases extend identifier lifecycle and customer-facing lookup.

## Lookup-First Flow (Encoder UX)
1) Encoder types any identifier (phone/email/gov ID/loyalty scan).
2) System normalizes the input using shared utilities, then performs a lookup.
3) If matches exist:
   - Show “possible match” unless the identifier is verified/strong.
   - Allow the encoder to select an existing entity; prefill safe fields (e.g., display name).
   - Keep branch/rate/status as user-entered unless explicitly pulled from an employee record.
4) If no matches: proceed to create a new entity and the requested role record.

## Guardrails
- **Duplicate active employee block:** APIs must return a 409 when an entity already has an ACTIVE employee row in the same house. Rehire is allowed when prior rows are inactive (either re-activate the old row or create a new active one).
- **Privacy defaults:** Lookup endpoints are HR-scoped, authenticated, and return masked identifiers; UI surfaces identity info only to authorized roles.

## References
- Identity contract and strength model: `docs/contracts/identity-contract.md`.
- Schema/RPC cache runbook: `docs/runbooks/supabase-rls-debug.md`.
