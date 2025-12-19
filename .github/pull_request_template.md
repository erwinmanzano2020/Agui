## Checklist
- [ ] Uses authenticated Supabase client for UI-facing queries
- [ ] service_role used only for admin-only steps (entity resolution/backfill)
- [ ] API returns non-200 on Supabase error (no silent 200 + error)
- [ ] Verified RLS policy behavior (SELECT/INSERT/UPDATE) for affected tables
- [ ] Verified grants only after confirming client + RLS correctness
- [ ] Added/updated tests for tenancy + access control
- [ ] Implementation Digest included (files changed, helpers, tenancy enforcement, UI behavior, tests, non-changes, follow-ups)
- [ ] Data Access Plan included (client split, tables touched, tenancy scoping, RLS expectation)
- [ ] Updated db-contract.md if DB/RLS/tenancy changed
- [ ] Updated access-control.md if roles/permissions/guards changed
- [ ] Added Devlog entry for user-facing module changes
- [ ] Runbook updated if debugging procedure changed

## Summary
- What changed and why

## Data Access Plan
- Authenticated client usage:
- service_role usage:
- Tables touched:
- Tenancy scoping:
- RLS expectation:

## Implementation Digest
- Files changed:
- Helpers added/updated:
- Tenancy enforcement (house_id and scope):
- UI behavior:
- Tests added/updated:
- Notable non-changes:
- Follow-ups:

## Devlog
- Devlog entry path:

## Contracts
- Contracts touched (db-contract/access-control/runbook):

## Testing
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test`
