# HR employees RLS incident (authenticated client fix)
- Date: 2025-02-01
- Module: HR
- Related PR(s): Add API guardrails and Data Access Plan documentation
- Devlog entry author: Codex

## Summary
- Incident: HR employees API returned silent failures and 42501 permission errors because UI-facing queries used `service_role` in some paths, bypassing expected RLS and confusing debugging.
- Fix pattern: enforce split-client usage—`createServerSupabaseClient` for all UI-facing reads/writes, reserving `getServiceSupabase` for entity resolution only. Added explicit 401/403/500 responses and structured logging (route/action/userId/entityId/houseId/error code).
- Tenancy/RLS: all employee/branch queries scoped by `house_id` with branch filtering; RLS expected to allow house members with HR roles/policies.

## Outcome
- Users now get clear HTTP statuses instead of silent 200s; logs provide context to trace RLS/grant issues.
- Reduced likelihood of 42501 loops when UI follows authenticated-client pattern.

## Follow-ups
- Extend split-client + logging helpers to remaining API routes.
- Migrate any legacy `employees.house_id` NULL rows to explicit house assignments.
