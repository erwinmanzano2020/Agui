# Agui Development Process & Codex Guidelines

> This repository copy is the source of truth for contributors. Keep it in sync with the canvas. Changes to the canvas must be reflected here, and PRs must follow this document.

## Principles
- Prefer predictable, auditable changes: every PR must describe scope, access strategy, and validation.
- RLS-first: authenticated Supabase clients power UI-facing data. `service_role` is reserved for admin-only operations.
- Tenancy is explicit: every query that spans tenants includes `house_id` (and related linkage) filters.
- No silent failures: API/Supabase errors return non-200 responses with actionable context.

## Required PR sections
- Summary (what changed and why).
- **Data Access Plan (required in every PR)** — see the template below.
- Implementation Digest (files changed, helpers, tenancy enforcement, UI behavior, tests, non-changes, follow-ups).
- Testing (lint, typecheck, build, test).

## Data Access Plan (Required in every PR)
Document the intended access model before (or while) coding. Include:
- **Client usage**
  - Which operations use `createServerSupabaseClient()` (authenticated client).
  - Which operations use `getServiceSupabase()` (`service_role`) and why the elevated scope is needed.
- **Tables touched** — list tables/views/RPCs.
- **Tenancy strategy** — how `house_id` (and related linkage tables) is enforced in queries/mutations.
- **RLS expectation** — policy names or behaviors expected to allow/deny SELECT/INSERT/UPDATE.

## DB/API access rules
- UI data routes use the authenticated client for all `.from()` queries.
- `service_role` only for admin/internal steps (entity resolution, backfills, operational maintenance).
- Debug order for permission issues: client choice → linkage rows → RLS policy behavior → grants (last).

## PR process guardrails
- Complete all checklist items in `.github/pull_request_template.md`.
- Include the Data Access Plan and Implementation Digest in the PR description.
- Call out notable non-changes (what was intentionally left untouched).

## Testing expectations
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`

## Keeping this doc current
- When the canvas changes, update this file in the same PR.
- If a PR adds new access patterns, update the Data Access Plan section examples.
