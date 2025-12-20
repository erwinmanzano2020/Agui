# Identity Contract

## Canonical person model
- `entities` is the authoritative table for people/actors.
- `entity_identifiers` is the canonical registry for identifiers that point to an `entity_id`.

## Identifier usage (current)
- Preferred identifiers: `PHONE`, `EMAIL`, `auth_uid`.
- Recommended future additions: non-guessable QR token or card token for scan flows.

## Principles
- Authentication/identity flows should resolve through identifiers → `entity_id`, not via app-facing labels.
- Employee codes, loyalty numbers, and similar labels are **not** identifiers; they are house/module-scoped labels.
- Keep identifiers stable, non-guessable when possible, and avoid overloading business labels for login.

## Related docs
- DB contract: `./db-contract.md`
- Access-control contract: `./access-control.md`
- Devlog index: `../devlog/index.md`
