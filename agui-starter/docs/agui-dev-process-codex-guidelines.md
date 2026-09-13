# Agui Development Process & Codex Guidelines

## Authority Model

- Repository governing documents and code are canonical project truth.
- Hosted GitHub is authoritative execution evidence for PR identity, hosted head and diff, reviews, CI/checks, merge state, and merge commit.
- The Agui Project Control Center is an operational mirror/index.
- Chat is working context only.
- Any material mismatch between these surfaces is **Needs Reconciliation**. Stop any conclusion that depends on the mismatch until it is resolved against the appropriate authority.

The Project Control Center does not become a co-equal source of truth. Follow the repository's governing hierarchy and the complete relay protocol at [`../../docs/agui/project-control-sync-protocol.md`](../../docs/agui/project-control-sync-protocol.md).

## Principles

- Prefer predictable, auditable changes: every PR must describe scope, access strategy, and validation.
- Use RLS-first access: authenticated Supabase clients power UI-facing data; reserve `service_role` for approved admin-only operations.
- Keep tenancy explicit: every query that spans tenant data must enforce `house_id` and applicable linkage.
- Do not hide failures: API/Supabase errors must return non-200 responses with actionable context.

## Required PR Sections

Every PR must include:

- **Summary** — what changed and why.
- **Data Access Plan** — intended access model and tenancy/RLS treatment.
- **Implementation Digest** — files and surfaces changed, enforcement, behavior, tests, non-changes, and follow-ups.
- **Testing** — the checks actually run and their results.

For a documentation-only PR, the Data Access Plan may state: no runtime data access, no DB/API access, and no RLS/tenancy change.

## Data Access Plan

For runtime work, document:

- which operations use `createServerSupabaseClient()`;
- which approved operations use `getServiceSupabase()` (`service_role`) and why elevated scope is necessary;
- tables, views, and RPCs touched;
- how `house_id` and related linkage enforce tenancy;
- the RLS policies or expected allow/deny behavior.

## Knowledge Relay Lifecycle

### Before Work

Read exact relevant canonical paths. At minimum, read:

1. `AGENTS.md`;
2. every applicable nested `AGENTS.md`;
3. `agui-development-operating-principles.md`;
4. `agui-starter/docs/agui-dev-process-codex-guidelines.md`;
5. `agui-starter/docs/Agui Roadmap Plan.md`;
6. the relevant canonical Master Plan: `docs/hr/hr-master-plan.md` for HR, or `docs/pos/pos-master-plan.md` for POS only after a future explicit Roadmap/phase decision reactivates POS;
7. the relevant canonical status or execution snapshot: `docs/hr/hr-status.md` for HR, or `docs/pos/pos-status.md` for POS only after a future explicit Roadmap/phase decision reactivates POS;
8. the applicable decision, approval, gate, and devlog records;
9. applicable domain-specific technical guidance, including `agui-starter/docs/db-api-access-guidelines.md` whenever DB/API/RPC work is in scope;
10. mapped code/runtime surfaces when implementation is authorized; and
11. `docs/agui/project-control-sync-protocol.md`.

Do not select an authority by filename or title alone when compatibility or legacy copies exist. `agui-starter/docs/pos-master-plan.md` is not the canonical POS Master Plan, and the POS path mapping does not reactivate POS; the current Roadmap keeps POS paused. For a future module without an explicit canonical-path mapping, stop and resolve the path before treating a document as governing authority.

### During Work

When work introduces or discovers behavior, a limitation, workaround, risk, contract change, authorization boundary, tenancy implication, identity implication, or operational edge case, update the appropriate repository documentation in the same PR when required. Discovery does not expand authorized scope.

### Before Completion

Verify:

- authorized scope and all changed files;
- documentation alignment;
- applicable checks and their actual results;
- absence of hidden scope expansion; and
- for material work, a staged/pre-host Control Center Sync Payload complete for every locally knowable field, with unavailable hosted-only fields explicitly pending as defined by the sync protocol.

### After Hosting

Finalize the sync payload using an independently verified PR Number / URL, Hosted Head SHA, hosted diff, reviews, CI/checks, and other applicable hosted facts. A local SHA is local evidence only; it is not proof of hosted state. Do not recommend merge before applicable hosted verification is complete. Review and merge remain owner-controlled.

## DB/API Access Rules

- UI data routes use the authenticated client for all `.from()` queries.
- Use `service_role` only for approved admin/internal steps such as entity resolution, backfills, or operational maintenance.
- Debug permission issues in this order: client choice → linkage rows → RLS policy behavior → grants last.

## PR Process Guardrails

- Complete all applicable items in `.github/pull_request_template.md`.
- Call out intentional non-changes.
- Report hosted facts only after independently verifying them.
- Hand off material repository changes through the sync payload; the payload does not itself update the Project Control Center.

## Testing Expectations

Run lint, typecheck, build, and relevant tests for implementation work. Documentation-only work may instead run the repository's applicable Markdown, link, diff, authority, and privacy checks when runtime checks are not required.
