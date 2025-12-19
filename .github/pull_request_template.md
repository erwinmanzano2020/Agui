## Checklist
- [ ] Uses authenticated Supabase client for UI-facing queries
- [ ] service_role used only for admin-only steps (entity resolution/backfill)
- [ ] API returns non-200 on Supabase error (no silent 200 + error)
- [ ] Verified RLS policy behavior (SELECT/INSERT/UPDATE) for affected tables
- [ ] Verified grants only after confirming client + RLS correctness
- [ ] Added/updated tests for tenancy + access control
- [ ] Implementation Digest included (files changed, helpers, tenancy enforcement, UI behavior, tests, non-changes, follow-ups)

## Summary
- What changed and why

## Implementation Digest
- Files changed:
- Helpers added/updated:
- Tenancy enforcement (house_id and scope):
- UI behavior:
- Tests added/updated:
- Notable non-changes:
- Follow-ups:

## Testing
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test`
