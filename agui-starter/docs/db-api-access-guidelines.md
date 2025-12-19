# DB & API Access Guidelines (reference copy)

Canvas documentation remains the source of truth. This file keeps a working copy alongside the codebase so contributors have the access rules and guardrails in one place. Treat this as the operational spec; see `agui-dev-process-codex-guidelines.md` for contributor-facing requirements and the Data Access Plan template.

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
