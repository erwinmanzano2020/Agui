# Identity Contract

## Canonical person model
- `entities` is the authoritative table for people/actors.
- `entity_identifiers` is the canonical registry for identifiers that point to an `entity_id`.

## Identifier usage (current)
- Preferred identifiers: `PHONE`, `EMAIL`, `auth_uid`.
- Recommended future additions: non-guessable QR token or card token for scan flows.
- HR enrollment: employee creation may supply email/phone; resolve against `entity_identifiers` first via the `hr_find_or_create_entity_for_employee` RPC (identifier map JSON arg). Only when no match exists should the RPC create a new `entities` row and attach identifiers (one marked primary, preferring email). Precede enrollment with a lookup RPC to avoid accidental merges.
- Phone normalization (PH default): canonical storage uses E.164 `+63…`, but legacy lookups also check local digits-only `09…` to avoid duplicate entities from older rows.

## Principles
- Authentication/identity flows should resolve through identifiers → `entity_id`, not via app-facing labels.
- Employee codes, loyalty numbers, and similar labels are **not** identifiers; they are house/module-scoped labels.
- Keep identifiers stable, non-guessable when possible, and avoid overloading business labels for login.
- Identity creation for HR flows uses the `hr_find_or_create_entity_for_employee` RPC (security definer, HR-scoped, identifier map input); do not grant broad table access to `entities`/`entity_identifiers`.
- Multiple employees may link to the same identity across houses, but HR creation must reuse existing identifiers for the same house instead of creating duplicate identities.
- Lookup-first enrollment: treat phone/email as **weak** identifiers (non-unique, recyclable). Do not auto-merge when ambiguous—surface candidates and require explicit selection. Reserve “strong” identifiers (future: verified gov IDs, issued QR/loyalty tokens) for higher-confidence matches.
- Schema cache: any migration that adds/changes RPCs must end with `notify pgrst, 'reload schema';` to avoid stale PostgREST metadata.

## Related docs
- DB contract: `./db-contract.md`
- Access-control contract: `./access-control.md`
- Devlog index: `../devlog/index.md`
