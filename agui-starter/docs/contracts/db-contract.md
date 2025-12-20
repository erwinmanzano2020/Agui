# DB Contract

- **Canonical tenancy key:** `house_id`.
- **Relationships:** `houses` ↔ `branches` (branches may be labeled “Department” in the UI).
- **Minimum required linkage tables:** `entities`, `house_roles` (do not remove or bypass them).
- **Rule:** All UI-facing reads/writes must be house-scoped.
- **Legacy rows:** Some `employees.house_id` values may be `NULL`. Apply an effective-house fallback (e.g., derive from linked employment/role when present) while cleaning up data; new writes must always set `house_id`. Deprecate and migrate away from `NULL` `house_id` rows.
- **Employee creation (canonical fields):**
  - `house_id` is required for every insert.
  - `full_name` is the only supported name column for employees (no `display_name` writes/reads).
  - `status` defaults to `active` unless explicitly provided.
  - `branch_id`, when present, must belong to the same `house_id`.
  - `code` is required and generated in the DB per house via a counter/trigger; the app should not prompt for or construct codes, and codes are house-scoped labels (not globally unique).
- **Naming conventions:** Do not rename tables to match UI labels. Keep DB table names stable; UI labels can differ.
- **Related docs:** access-control contract (`docs/contracts/access-control.md`), identity contract (`docs/contracts/identity-contract.md`), RLS debug runbook (`docs/runbooks/supabase-rls-debug.md`), devlog index (`docs/devlog/index.md`).
