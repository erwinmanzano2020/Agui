# ADR: HR Identity RPC Contract

## Status
Accepted

## Context
- The canonical identity table (`public.entity_identifiers`) uses `identifier_type`/`identifier_value` (no `kind`/`value_norm`).
- Multiple overloads of `hr_find_or_create_entity_for_employee` existed; the legacy `p_identifiers` overload referenced legacy columns and conflicted with PostgREST introspection.
- PostgREST schema cache can serve stale or ambiguous definitions after migrations, leading to “function not found”/PGRST202 errors even when SQL is present.
- Add Employee relied on these RPCs and surfaced runtime failures when the app called the wrong signature or when legacy definitions remained.

## Decision
- Canonical RPC signatures:
  - `hr_lookup_entities_by_identifiers(p_house_id uuid, p_identifiers jsonb)`
  - `hr_get_entity_identity_summary(p_house_id uuid, p_entity_ids uuid[])`
  - `hr_find_or_create_entity_for_employee(p_house_id uuid, p_display_name text, p_email text default null, p_phone text default null)`
- Legacy overload `hr_find_or_create_entity_for_employee(uuid, text, jsonb)` is **removed** and must not be reintroduced.
- App calls must use `p_email`/`p_phone` (no `p_identifiers`), matching the canonical signature.
- After changing RPCs, PostgREST schema must be reloaded via `notify pgrst, 'reload schema';`.

## Consequences
- Prevents runtime errors tied to `entity_identifiers.kind` and signature mismatch.
- Ensures Add Employee identity bootstrap is stable and house-scoped.
- Any SQL editor hotfixes must be backported into migrations to keep schema/RPC contracts consistent across environments.
- Future migrations must avoid conflicting overloads and include schema-cache reload instructions.
