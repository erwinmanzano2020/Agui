# New Chat Handoff

Use this template to hand off HR/Codex investigations or implementation work so the next contributor can continue seamlessly.

## State Snapshot

- **Feature / Milestone:** e.g., HR-1 (Frozen) or HR-2 planning.
- **Environment:** house identifier, Supabase project, and branch/tag under test.
- **Schema version:** latest migration timestamp applied; note if `NOTIFY pgrst, 'reload schema';` was run.
- **RPC surfaces:** confirm canonical signatures present and any known overloads removed.
- **Tenancy checks:** summary of RLS/grant validation and any cross-house leak tests performed.

## Active Threads

- **Open questions:** blockers or decisions needed (e.g., contract changes that would break HR-1 freeze).
- **Known issues:** error codes observed (PGRST202/301, duplicate key), suspected causes, and reproduction steps.
- **Runbook steps executed:** link to `docs/hr/hr-1-implementation-runbook.md` checkpoints already covered.

## Next Actions

- **Immediate:** what to test or patch next (include SQL harness snippets or RPC calls).
- **PR requirements:** if migrations/RPCs/identity flows will be touched, list the PR notes required per `agui-development-operating-principles.md`.
- **UI/UX notes:** for lookup-first Add Employee, whether the last run saw zero matches (valid—should proceed) or multiple matches (requires selection).

Keep this snapshot current; stale handoffs risk breaking the HR-1 freeze or duplicating regressions.
