# Agui Development Operating Principles

These principles document how we manage freezes, contracts, and PR hygiene for Codex work. Apply these rules to every change in this repository, with extra care for identity, migrations, and RPC changes.

## Freeze and Contract Policy

- **Freezes are explicit and named.** When a feature milestone (e.g., **HR-1**) is marked frozen, treat its contracts as immutable until the freeze is lifted or superseded. All frozen contracts must be listed in the relevant doc (see `docs/hr/hr-master-plan.md`) with any allowed deviations.
- **Changes during a freeze require justification.** Only bug fixes that keep the contract behavior intact are allowed; anything that expands or breaks a contract must be proposed as a post-freeze milestone (e.g., HR-2).
- **Documented contracts are the source of truth.** Use the canonical RPC signatures and identity columns captured in the HR docs—do not resurrect legacy `kind` or `value_norm` columns, and keep signatures consistent with the canonical forms.

## Required PR Notes

Include an explicit checklist in PR descriptions whenever a change touches **migrations**, **RPCs**, or **identity flows**:

- Called out whether migrations were added or modified (or explicitly state “no migrations”).
- Confirmed RPC signature compatibility, including overload counts and argument order.
- Noted any updates to identity handling (lookups, inserts, guardrails, normalization).
- Recorded whether schema cache invalidation (e.g., `NOTIFY pgrst, 'reload schema';`) is required post-deploy.

## Identity and Tenancy Guardrails

- **Canonical columns:** `identifier_type`, `identifier_value` are the only supported identity fields. Do not introduce or rely on legacy `kind`/`value_norm`.
- **Tenancy:** All identity and HR data remains house-scoped—no cross-house access. Enforce RLS and grant checks for RPCs and queries that expose identity.
- **Duplicate prevention:** Respect the partial unique index requirement: at most one active employee per `(house_id, entity_id)`.

## CI and Quality Expectations

- Keep ESLint clean (no unused imports or `any`), and ensure `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` stay green locally before merging.
- Avoid changes to generated API types (`db.types.ts`) unless the task explicitly calls for it.
- Treat documentation as a first-class deliverable—major freezes and contracts must be reflected in the docs before code changes land.
