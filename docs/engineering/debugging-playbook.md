# Debugging Playbook

Use this triage ladder to debug HR and identity issues, with quick error mappings and SQL harness guidance.

## Triage Ladder

1. **Identify scope:** Confirm the `house_id` and environment. Ensure requests carry authenticated context.
2. **Reproduce with canonical RPCs:** Call the HR identity RPCs directly to isolate UI noise.
3. **Check recent deployments:** Look for migrations or RPC changes that might need a schema cache reload.
4. **Inspect logs and error codes:** Map common PostgREST errors before changing code.
5. **Validate invariants:** Enforce canonical columns, normalization, and the partial unique index guardrail.

## Common Error Mapping

- **PGRST202 / function not found:** Likely RPC overload mismatch or stale schema cache. Confirm only the canonical signatures exist and run `NOTIFY pgrst, 'reload schema';`.
- **PGRST301 / multiple functions:** Remove stray overloads; ensure argument order and types match the frozen signatures.
- **Duplicate key violations:** Check the partial unique index on `(house_id, entity_id)`; verify phone/email normalization to avoid collisions.
- **RLS/permission denied:** Confirm authenticated role and grants; ensure house scoping matches the caller.

## SQL Harness

Use direct SQL to validate behavior:

- **Lookup-first sanity:**
  ```sql
  select * from hr_lookup_entities_by_identifiers(
    :house_id,
    '[{"identifier_type":"email","identifier_value":"casey@example.com"}]'::jsonb
  );
  ```
- **Create/attach flow (expect “no match” to be valid):**
  ```sql
  select * from hr_find_or_create_entity_for_employee(
    :house_id,
    'Casey Example',
    'casey@example.com',
    '+15555550123'
  );
  ```
- **Summaries for UI/audit:**
  ```sql
  select * from hr_get_entity_identity_summary(
    :house_id,
    array[:entity_id]
  );
  ```

Capture outputs with timestamps and schema versions in incident notes to speed handoffs.
