# HR employee lookup-first identity + dedupe

- HR identity RPC now accepts an identifier map (JSON) and normalizes email/phone, reusing existing identifiers before creating new entities.
- Employee creation blocks duplicates when the same identity already has an active employee in the house; inactive rows can be rehired.
- Docs updated to clarify identity vs. contact data and the reuse-first rule for HR enrollment.
