# DB Contract

- **Canonical tenancy key:** `house_id`.
- **Relationships:** `houses` ↔ `branches` (branches may be labeled “Department” in the UI).
- **Minimum required linkage tables:** `entities`, `house_roles` (do not remove or bypass them).
- **Rule:** All UI-facing reads/writes must be house-scoped.
- **Legacy rows:** Some `employees.house_id` values may be `NULL`. Apply an effective-house fallback (e.g., derive from linked employment/role when present) while cleaning up data; new writes must always set `house_id`. Deprecate and migrate away from `NULL` `house_id` rows.
- **Employee creation:** Inserts must set `house_id`, use `full_name` for names (no `display_name` column), default `status` to `active` unless explicitly provided, ensure `branch_id` belongs to the same house before insert, and rely on DB-generated `code` (per house, concurrency-safe).
- **Identity link:** `employees.entity_id` is nullable and links to canonical `entities.id`. When email/phone is provided at creation, resolve or create an `entity` + `entity_identifiers` entry via the lookup-first RPC; leave `entity_id` null when no contact is provided. Keep the column nullable for legacy rows. Reuse identities within the same house; do not create duplicates for the same identifier set.
- **Identity visibility:** HR-facing employee list/detail views may join (via HR-scoped RPC) to surface `entities.display_name` and masked identifiers; avoid broad table grants or cross-house leakage.
- **Naming conventions:** Do not rename tables to match UI labels. Keep DB table names stable; UI labels can differ.
- **Related docs:** access-control contract (`docs/contracts/access-control.md`), identity contract (`docs/contracts/identity-contract.md`), RLS debug runbook (`docs/runbooks/supabase-rls-debug.md`), devlog index (`docs/devlog/index.md`).
