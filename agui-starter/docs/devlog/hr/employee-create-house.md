# HR employee creation (house-scoped)
- Date: 2025-03-05
- Module: HR
- Related PR(s): Adds house-scoped employee creation form and API
- Devlog entry author: Codex

## Summary
- Added a house-scoped employee creation API/server action that enforces authenticated Supabase usage and RLS (no `service_role` inserts).
- Form wires to the HR Employees page with client-side validation, branch dropdown scoped to the active house, and redirects back to the list on success.
- Creation blocks cross-house branches and non-HR users, returning explicit 401/403/400/500 statuses instead of silent failures.
- Aligns employee writes/reads to the canonical `full_name` column (removing `display_name` usage) to match the live schema.
- Confirms DB-generated employee codes per house; UI should never prompt for codes.

## Outcome
- HR users can add employees without leaving the workspace while staying within RLS boundaries.
- Immediate list refresh via path revalidation keeps the HR roster in sync after creation.

## Follow-ups
- Extend the pattern (authed client + branch verification) to other HR write surfaces (e.g., role changes, onboarding).
- Add end-to-end coverage for the new creation flow once UI e2e harness is available.
