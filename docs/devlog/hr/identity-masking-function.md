# HR identity masking and identity summary

## What changed
- Added migration-backed masking helpers (`mask_identifier_value`) so masking is always available for email and phone identifiers.
- Added a tenant-scoped HR identity summary RPC that relies on the masking helper and reloads the PostgREST schema cache.

## Why it matters
- Production hit a missing `mask_identifier_value` function, breaking identity badges until the function was created manually and the schema cache was reloaded.
- Anchoring the helper and the summary RPC in migrations prevents regressions and keeps HR identity UI stable across environments.
