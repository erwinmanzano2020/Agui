# Identity Contract

## Canonical person model
- `entities` is the authoritative table for people/actors.
- `entity_identifiers` is the canonical registry for identifiers that point to an `entity_id`.

## Identifier usage (current)
- Preferred identifiers: `PHONE`, `EMAIL`, `auth_uid`.
- Recommended future additions: non-guessable QR token or card token for scan flows.
- HR enrollment: employee creation may supply email/phone; resolve against `entity_identifiers` first via the `hr_find_or_create_entity_for_employee` RPC (identifier map JSON arg). Only when no match exists should the RPC create a new `entities` row and attach identifiers (one marked primary, preferring email).
- Phone normalization (PH default): canonical storage uses E.164 `+63…`, but legacy lookups also check local digits-only `09…` to avoid duplicate entities from older rows.

## Principles
- Authentication/identity flows should resolve through identifiers → `entity_id`, not via app-facing labels.
- Employee codes, loyalty numbers, and similar labels are **not** identifiers; they are house/module-scoped labels.
- Keep identifiers stable, non-guessable when possible, and avoid overloading business labels for login.
- Identity creation for HR flows uses the `hr_find_or_create_entity_for_employee` RPC (security definer, HR-scoped, identifier map input); do not grant broad table access to `entities`/`entity_identifiers`.
- Multiple employees may link to the same identity across houses, but HR creation must reuse existing identifiers for the same house instead of creating duplicate identities.

## Related docs
- DB contract: `./db-contract.md`
- Access-control contract: `./access-control.md`
- Devlog index: `../devlog/index.md`
