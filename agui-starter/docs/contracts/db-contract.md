# DB Contract

- **Canonical tenancy key:** `house_id`.
- **Relationships:** `houses` ↔ `branches` (branches may be labeled “Department” in the UI).
- **Minimum required linkage tables:** `entities`, `house_roles` (do not remove or bypass them).
- **Rule:** All UI-facing reads/writes must be house-scoped.
- **Legacy rows:** Some `employees.house_id` values may be `NULL`. Apply an effective-house fallback (e.g., derive from linked employment/role when present) while cleaning up data; new writes must always set `house_id`. Deprecate and migrate away from `NULL` `house_id` rows.
- **Naming conventions:** Do not rename tables to match UI labels. Keep DB table names stable; UI labels can differ.
