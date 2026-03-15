# HR-1 Implementation Runbook

Use this runbook when building or debugging HR-1 functionality. It captures the frozen contracts, invariants, and known guardrails to avoid regressions.

## Canonical Identity Model

- Columns: **only** `identifier_type`, `identifier_value` (no legacy `kind`/`value_norm` fields).
- Tenancy: every lookup and mutation is scoped to `house_id`; do not expose cross-house identity data. Ensure RPCs respect RLS and authenticated grants.
- Duplicate prevention: partial unique index allows only one active employee per `(house_id, entity_id)`.

## Canonical RPC Signatures

- `hr_lookup_entities_by_identifiers(p_house_id uuid, p_identifiers jsonb)`
- `hr_find_or_create_entity_for_employee(p_house_id uuid, p_display_name text, p_email text, p_phone text)`
- `hr_get_entity_identity_summary(p_house_id uuid, p_entity_ids uuid[])`

Treat these signatures as frozen during HR-1. Adding overloads or changing parameter order requires a post-freeze milestone.

## Lookup-First Add Employee Flow

1. **Normalize inputs**: trim, lowercase emails, standardize phone numbers (E.164), and retain identifier types (`email`, `phone`, etc.).
2. **Lookup** via `hr_lookup_entities_by_identifiers`:
   - **0 matches:** valid. Proceed to create a new identity through `hr_find_or_create_entity_for_employee`.
   - **1+ matches:** require explicit selection to prevent duplicates.
3. **Create or attach** using `hr_find_or_create_entity_for_employee`. Respect the partial unique index so only one active employee is tied to a `(house_id, entity_id)`.
4. **Summaries**: use `hr_get_entity_identity_summary` for downstream UI or audit surfaces.

## Invariants and Guardrails

- Maintain house scoping for every RPC call.
- Enforce phone normalization before persistence; avoid storing mixed formats.
- Never reference legacy `kind` columns; all logic must operate on `identifier_type`.
- Ensure duplicate prevention by confirming the partial unique index remains intact.

## Known Failure Modes and Fixes

- **Legacy column references:** Queries or RPC bodies using `kind`/`value_norm` will fail—replace with `identifier_type`/`identifier_value`.
- **RPC overload mismatch / function not found (PGRST202/301):** Confirm only the canonical signatures exist and are deployed; drop stale overloads and redeploy.
- **Schema cache issues:** After function changes, run `NOTIFY pgrst, 'reload schema';` to refresh PostgREST’s cache, and ensure deploys call the same hook.

## SQL Verification Harness

Use these checks when validating environments:

- Identity lookup sanity:
  ```sql
  select * from hr_lookup_entities_by_identifiers(
    :house_id,
    '[{"identifier_type": "email", "identifier_value": "alex@example.com"}]'::jsonb
  );
  ```
- Create or attach path:
  ```sql
  select * from hr_find_or_create_entity_for_employee(
    :house_id,
    'Alex Example',
    'alex@example.com',
    '+15555550100'
  );
  ```
- Summary call:
  ```sql
  select * from hr_get_entity_identity_summary(
    :house_id,
    array[:entity_id]
  );
  ```

Record results with the associated schema version and confirm tenancy boundaries (no cross-house rows returned).
