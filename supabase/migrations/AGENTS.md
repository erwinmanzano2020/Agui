# AGENTS.md

## Scope
This file applies to SQL migration work under `/supabase/migrations`.

Use this file with the root `/AGENTS.md`. Root policy remains canonical.

---

## Why This File Exists
Migrations are high-risk.

A migration can create tenancy leaks, contract drift, incompatible RPC changes, broken policies, or misleading schema semantics. This file exists to keep migration work disciplined and additive.

---

## Migration Safety Protocol
- Prefer additive changes over destructive or semantic repurposing.
- Do not silently change the meaning of an existing column.
- Do not repurpose columns to represent a new concept.
- Avoid hidden coupling between old semantics and new usage.
- If a contract must change, surface it clearly and ensure the task explicitly authorizes it.

---

## Ownership and Scope Rules
When adding or changing schema:
- make ownership and scope explicit
- verify whether `house_id` is required
- verify whether branch/location fields are domain-specific and not tenant replacements
- do not assume a lookup field implies authorization scope
- ensure tenant boundaries remain enforceable in queries and policies

Schema changes must preserve clear tenant ownership behavior.

---

## RLS / Grants Review Checklist
For migrations that affect access, review:
- RLS policies
- grants
- function security context
- default access behavior
- risk of cross-house reads or writes
- risk of broad policy conditions

Do not merge tenancy-sensitive schema work without checking policy implications.

---

## RPC / Function Compatibility Checklist
When touching functions or RPCs:
- preserve signature stability unless the task explicitly allows breaking change
- clearly note parameter changes
- verify caller compatibility
- verify auth/security behavior
- verify downstream app assumptions

Do not silently break application contract surfaces.

---

## Post-Migration Expectations
When relevant, also ensure:
- schema is reloaded as needed
- `db.types.ts` is regenerated or updated through the approved flow
- repositories or typed access layers are updated
- tests or verification steps are updated
- implementation summary calls out migration risk checks

---

## Forbidden Patterns
- repurposing existing columns for different meaning
- adding ambiguous ownership semantics
- relying on application filtering instead of enforceable database constraints where policy is needed
- weakening RLS or grant boundaries without explicit authorization
- hidden breaking changes to active contracts

---

## Escalate Instead of Improvising When
Stop and surface the issue if the migration seems to require:
- reinterpretation of tenant boundary
- identity model redesign
- broad contract breakage
- unplanned data backfill complexity
- policy weakening to make the app “just work”
