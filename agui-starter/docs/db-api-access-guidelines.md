# DB & API Access Guidelines (reference copy)

Repository governing documents are canonical project truth, and higher governing authority wins on conflict. This file is subordinate reference guidance, not independent authority. Contributor process requirements and the Data Access Plan template live in [`agui-dev-process-codex-guidelines.md`](agui-dev-process-codex-guidelines.md). The Agui Project Control Center is an operational mirror/index and is not DB/API authority.

## Migration-backed database functions

- Any database function or RPC that the UI or another RPC depends on must be defined through committed migrations.
- Manual or environment-only SQL fixes are not an acceptable durable implementation because they create environment drift and can disappear on reset or rebuild.
- When adding or updating a PostgREST-facing function or RPC, include `notify pgrst, 'reload schema';` when PostgREST is involved so its schema cache remains current.
- Prefer idempotent migration definitions such as `create or replace`, together with appropriate guards where applicable, so preview, reset, and re-run behavior remains safe.

## Reliability and safety

- Prefer immutable, deterministic helpers, including masking helpers, for data displayed in HR, Finance, and Identity surfaces.
- Handle unavailable dependent RPCs gracefully. Where it is safe and applicable, keep linked/unlinked status visible while reporting the dependency failure.

## Split-client pattern
- UI-facing routes must use the authenticated Supabase client so RLS policies govern reads and writes.
- Reserve `service_role` only for admin-only steps such as entity resolution, bulk backfills, or operational tasks that cannot be executed by an authenticated user.
- Keep tenant scoping explicit by requiring `house_id` (and related IDs) on every query and mutation.
- Debug order when investigating permission issues: client choice → linkage rows → RLS policy behavior → grants last.

## Error handling and HTTP statuses
- Never return `200` when a Supabase call fails. Use non-200 responses that reflect the failure.
- Prefer centralized helpers like `jsonOk` and `jsonError` from `src/lib/api/http.ts` to keep responses consistent.
- Required statuses for HR/employee flows:
  - `401` when no authenticated user is present.
  - `403` when the user or entity lacks access to the requested house/branch/employee.
  - `500` when Supabase queries fail.

## Logging
- Use the logging helper in `src/lib/api/logging.ts` to emit context-rich errors.
- Logs should include: route, action, userId, entityId, houseId, and the Supabase/Postgres error code + message when available.
- Keep logs structured to make permission-loop debugging easier.

## PR expectations
- Fill out the PR checklist to confirm authenticated-client usage, limited `service_role` scope, RLS validation, and tenancy-aware tests.
- Include an Implementation Digest: files changed, helpers touched, tenancy enforcement details, UI behavior, tests, non-changes, and follow-ups.
