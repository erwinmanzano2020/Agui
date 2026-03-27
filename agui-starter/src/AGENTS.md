# AGENTS.md

## Scope
This file applies to all application code under `/agui-starter/src`.

Use this file together with the root `/AGENTS.md`. If there is any conflict, root policy wins unless a higher-order source explicitly says otherwise.

---

## What This File Is For
This subtree contains active implementation work and high-churn application code.

The purpose of this file is to keep application changes consistent, tenancy-safe, authorization-safe, and phase-aligned.

---

## App-Layer Boundary Rules
- Feature guards and UI visibility are not substitutes for authorization.
- Authorization decisions must be enforced in the correct server-side boundary.
- Deny-by-default is preferred over permissive fallback when scope or permission is unclear.
- Do not rely on client assumptions to protect tenant or entity data.
- Do not leak sensitive data through convenience loading, optimistic assumptions, or broad queries.

When adding handlers, loaders, services, actions, or repositories, explicitly verify who is allowed to see what and under which scope.

---

## Scope and Ownership Checks
When touching code in this subtree, verify:
- which tenant scope applies
- which house owns the data
- whether branch scope is relevant to the use case
- whether the actor has the correct role or permission
- whether the code path can expose data outside intended scope

Do not assume identity lookup or entity resolution alone grants visibility.
Do not widen access just because a user can resolve or reference an entity.

---

## Domain Separation Rules
Keep these boundaries explicit:
- identity is not the same as membership
- membership is not the same as role
- role is not the same as permission
- lookup capability is not the same as authorization to view or modify full records
- branch/location scope is not the same as tenant ownership

Do not collapse these concepts for convenience.

---

## API / Handler Expectations
When touching API handlers, server actions, or service functions:
- verify scope ownership before returning data
- make failure and deny states explicit
- avoid broad fetches followed by weak filtering
- prefer explicit query constraints over post-fetch filtering
- surface safe user-facing errors when access is denied or context is invalid

If a route or action depends on runtime context, add or update a server-side or integration-style test when possible.

---

## Coding and Change Discipline
- Prefer clarity over cleverness.
- Avoid unrelated refactors.
- Keep changes scoped to the approved task.
- Preserve existing contracts unless explicitly authorized to change them.
- If a change affects shared behavior, call it out explicitly in the implementation summary.

---

## Test Expectations
For changes in this subtree, consider whether you must update:
- unit tests
- integration or server-side tests
- repository test scaffolding
- smoke checklist steps for runtime-sensitive behavior

Minimum expectation: do not leave meaningful new behavior unverified.

---

## Escalate to Root Policy When
Stop and surface the issue if the work appears to require:
- contract change beyond task scope
- tenancy model reinterpretation
- identity model reinterpretation
- future-phase feature introduction
- permission model redesign
- silent cross-module behavior changes
