# AGENTS.md

## Purpose
This file defines the root operating rules for all work in this repository.

All local `AGENTS.md` files inherit from this file and may only sharpen behavior for their own subtree. They must not override the core rules here unless an approved higher-order document explicitly changes them.

---

## Hierarchy of Truth
When conflicts arise, follow this order:

1. Agui Development Operating Principles
2. Agui Roadmap
3. Master Plans (HR, POS, others)
4. Codex Tasks
5. Implementation details

If a lower layer conflicts with a higher layer, stop and surface the conflict instead of improvising.

---

## Active Delivery Rule
Agui is phase-based.

Current active priority:
1. HR System (end-to-end MVP)
2. POS
3. Operations
4. Finance
5. Growth and advanced systems

### Hard rules
- Only the active phase may be worked on.
- No feature jumping.
- No future-scope implementation unless the task explicitly authorizes shared foundation work.
- No partial implementation “just to test” unless explicitly requested.

POS and later systems are gated until HR reaches stability milestones.

---

## Tenancy Non-Negotiables
- House is the tenant boundary.
- All reads and writes must be correctly scoped to `house_id` unless an explicitly documented approved exception exists.
- Never expose cross-house data.
- Workspace is UI-only. Do not introduce `workspace_id` into the database model unless approved by governing docs.
- Branch is a location construct, not a replacement for tenant boundary.

When touching queries, handlers, services, repositories, policies, migrations, or RPCs, explicitly verify tenancy behavior.

---

## Identity Non-Negotiables
- Identity is foundational shared infrastructure, not owned by one module.
- Do not assume phone number or email uniquely identifies a person.
- Never auto-merge identities.
- Weak identifiers must not be treated as proof of uniqueness.
- Preserve explicit conflict handling.
- Preserve approved identity and authorization boundaries defined by current plans and architecture docs.

If a task appears to blur identity, membership, role, permission, or tenant scope boundaries, stop and surface the risk.

---

## Freeze and Contract Discipline
- Frozen contracts must not be changed unless the task explicitly authorizes the contract change.
- Do not silently change semantics of fields, APIs, RPCs, routes, or status labels.
- Additive change is preferred over repurposing existing contracts.
- Documentation changes must not imply unapproved scope expansion.

When changing active milestone behavior, verify the relevant plan and freeze context before editing code or docs.

---

## Required Checks Before Finalizing
All implementation work must aim to pass:
- lint
- typecheck
- build
- relevant automated tests

When applicable, also verify:
- migration added
- `db.types.ts` updated
- repository/test scaffolding updated
- RLS/policies/grants reviewed
- runtime-sensitive paths covered by server or integration-style tests
- manual smoke checklist included where needed

Do not claim completion while known required checks are missing.

---

## PR / Review Triggers
Call out these touches explicitly in the PR note or implementation summary:
- migrations
- RPC signature changes
- identity-related behavior
- authorization behavior
- tenancy-sensitive data access
- route guard changes
- environment-sensitive logic
- frozen contract changes

Each of these must include:
- what changed
- what did not change
- what risk was checked
- what tests or verification were added

---

## Documentation Rule
Documentation is part of the feature.

A change is not complete unless:
- behavior is documented where required
- assumptions are stated
- limitations are known
- phase alignment is preserved

---

## Local AGENTS Files
Use the closest applicable local `AGENTS.md` for sharper guidance in these areas:
- `/agui-starter/src/AGENTS.md`
- `/supabase/migrations/AGENTS.md`
- `/docs/hr/AGENTS.md`

Local files refine behavior for their subtree. They do not replace root policy.
