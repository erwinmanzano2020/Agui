# Supabase Migrations Hygiene

- Schema and RPC contracts must be migration-backed; mirror any SQL editor changes into migration files.
- Do **not** keep conflicting RPC overloads. If a function signature changes, drop legacy overloads to avoid PostgREST ambiguity.
- After modifying RPCs or schema, reload PostgREST: `notify pgrst, 'reload schema';`.
- If you patch RPCs in SQL editor for hotfixes, backport them into migrations immediately to keep preview/dev/main aligned.
