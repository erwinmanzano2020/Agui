# HR identity lookup bugs and fixes

- Preview lookup failed with `houseId: null` and `column reference "entity_id" is ambiguous`; fixed by enforcing houseId in requests and rewriting the lookup RPC with qualified columns.
- Added schema-cache-aware error messaging and runbook notes: apply migrations then `notify pgrst, 'reload schema';` if RPCs are missing.
- Lookup-first UI now surfaces matches, prefills display name on selection, and blocks duplicate active employees with a link to the existing record.
