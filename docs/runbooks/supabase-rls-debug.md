# Runbook: Supabase RPC & Schema Cache Debug

Use this when HR/POS endpoints return “RPC missing”, “schema cache stale”, or unexpectedly deny access because of RLS/policy drift.

## Quick Triage
1) **Check deployment logs** for PostgREST errors around the RPC name or schema.
2) **Confirm migration order:** Verify the latest migration ran fully (including any RPC definitions).
3) **Re-run the RPC in SQL** (e.g., via Supabase SQL editor) to ensure the function exists and compiles.

## Reload the PostgREST Schema Cache
Every migration that adds or changes RPCs must end with:
```sql
notify pgrst, 'reload schema';
```
If a deploy missed it:
1) Manually run the `notify` command above.
2) Wait for PostgREST to reload (typically a few seconds), then retry the endpoint.

## Validate RLS & Permissions
1) `select * from pg_policies where tablename = '<table>';` to confirm policies exist.
2) Use `alter role authenticated set role to <role>;` within a transaction to simulate the client role, then execute the RPC.
3) Ensure security definer RPCs include explicit house/tenant checks, not just default RLS.

## When Identifier Lookups Fail
1) Verify normalization helpers are deployed on both client/server.
2) Check `EntityIdentifiers` for the normalized value; ensure soft-deleted identifiers are excluded.
3) If the identifier belongs to another entity, route to manual review (do not auto-merge).

## Escalation
- Capture the failing request, SQL, and policy state.
- If reload + policy checks fail, roll back the last migration or redeploy with the corrected RPC and cache reload.
