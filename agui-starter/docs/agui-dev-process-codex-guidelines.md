# Agui Development Process & Codex Guidelines

> Repository governing documents and code on the governing branch are canonical project truth. Hosted GitHub is authoritative for PR, review, checks/CI, and merge evidence. The Agui Project Control Center is an operational mirror and discovery index, not a co-equal authority. Chat and planning notes are working context only until durable project state is reflected in the appropriate repository documentation.

Follow the [Project Control ↔ Repo Knowledge Relay / Sync Protocol](../../docs/agui/project-control-sync-protocol.md). If the Project Control Center and repository appear to disagree, set the status to **Needs Reconciliation**, identify the governing repository authority, and reconcile the stale or missing record through the approved documentation/PR process before dependent work resumes.

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

For documentation-only PRs, retain this section and state explicitly: no runtime data access, no DB/API surfaces touched, and tenancy/RLS impact is none.

## DB/API access rules
- UI data routes use the authenticated client for all `.from()` queries.
- `service_role` only for admin/internal steps (entity resolution, backfills, operational maintenance).
- Debug order for permission issues: client choice → linkage rows → RLS policy behavior → grants (last).

## Knowledge Relay workflow

### Before work
Identify and read, in authority order and to the depth relevant to the bounded task:

1. root `AGENTS.md`;
2. the closest applicable nested `AGENTS.md`;
3. Agui Development Operating Principles;
4. the current Roadmap;
5. the active module Master Plan and status;
6. relevant current gate, approval, decision, and contract records;
7. mapped code/runtime surfaces when implementation is authorized; and
8. the project-control sync protocol linked above.

Reading the whole repository is not required. Establish scope and stop conditions, then stop and surface any conflict with governing authority rather than improvising.

### During work
When work introduces or discovers new behavior, a contract clarification, limitation, workaround, material risk, authorization boundary, tenancy or identity implication, or operational edge case, update the appropriate repository documentation in the same PR when required. Do not defer known required documentation cleanup to an unspecified future task. Park future ideas without expanding active scope.

### Before completion
Verify that scope stayed within authorization, governing documents remain consistent, required checks ran, no unexpected files changed, and documentation accurately describes both implementation and non-changes. For work with material project-control impact, include the Control Center Sync Payload defined below.

### After PR hosting
Verify the hosted GitHub PR head, diff, changed files, reviews, checks/CI, and merge state. Local branch output alone is insufficient evidence of hosted state. Update the Project Control Center mirror only from verified material state, and record a merge only after hosted merge verification.

## Control Center Sync Payload
For work with material project-control impact, return this structured handoff:

```text
Project / Phase:
Gate / Slice:
Work Class:
Status:
PR Number / URL:
Base Branch:
Expected Hosted Base SHA:
Local Completion SHA:
Hosted Head SHA:
Canonical Documents Read:
Canonical Documents Changed:
Runtime / Code Surfaces Changed:
Database / Migration Surfaces:
Authorization / Tenancy / Identity Impact:
Owner Decisions Applied:
New Decisions Proposed:
Risks / Gaps:
Tests / Checks:
Known Limitations:
Project Control Tabs To Update:
Suggested Project Control Status:
Next Authorized Action:
Scope Deviations:
Stop Conditions Encountered:
```

Use `None` or `Not applicable` when accurate. The local completion SHA is Codex-local evidence only; the hosted head SHA must be independently verified from GitHub, and Codex must not claim hosted verification it could not perform. The payload does not update the Project Control Center; it enables ChatGPT/owner verification and manual mirror maintenance.

## Material Project Control update triggers
Mirror material state after a phase or milestone/gate change; new owner decision; contract approval/change; PR opening; material review finding; blocker; new P1/P2 risk; merge-ready state; merge; important limitation; or future-capability discovery that must be parked rather than implemented. This follows DEC-006 continuity discipline.

Trivial formatting, typo-only changes, and routine internal implementation details with no project-control value do not require mirror updates.

## PR process guardrails
- Complete all checklist items in `.github/pull_request_template.md`.
- Include the Data Access Plan and Implementation Digest in the PR description.
- Call out notable non-changes (what was intentionally left untouched).
- Codex may prepare a branch, commit, create or update the PR, and report completion state.
- Unless explicitly authorized, Codex must not trigger `@codex` review, merge, enable auto-merge, resolve owner/reviewer threads, or claim merge readiness from local results alone.
- The owner controls the manual review trigger. Verify the exact hosted head before recommending merge.

## Testing expectations
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`

## Keeping this doc current
- When a PR adds a new access pattern or changes a process rule, update the appropriate canonical repository documentation and this guide when applicable.
- Keep assumptions, limitations, and operationally material findings documented in the same PR when required.
