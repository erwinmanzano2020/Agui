# HR identity lookup reliability

- Issue: Preview failed with “Could not find the function … in the schema cache” until migrations were applied manually and `notify pgrst, 'reload schema';` was run.
- Fix: Identity RPC migrations now notify PostgREST, and API responses surface actionable errors when schema cache is stale or RPCs are missing.
- Reminder: Deployments must run Supabase migrations before Preview/Prod; reload the schema cache after RPC changes to avoid lookup failures.
