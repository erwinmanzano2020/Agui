# Agui Authorization Foundation (HR-first Canonical Architecture)

## 1) Purpose and scope

This document establishes the **canonical authorization architecture** for Agui during the active **HR-first hardening phase**.

This is intentionally **architecture-first, migration-first guidance**—not a whole-system rewrite. The goal is to stop drift between access styles, define a single model, and create a safe path for incremental standardization.

## 2) Why this is needed now

Agui currently enforces access through multiple strong but partially independent mechanisms:

- feature guards (`AppFeature` + `requireFeatureAccess*`)
- route/API checks specific to modules (HR/POS/settings/inventory/clock)
- role checks (platform/guild/house role assignments)
- policy checks (`entity_policies` hydration + action/resource matching)
- non-production override behavior for feature visibility and access

This works for shipping modules quickly, but it behaves more like a **collection of strong features** than a single unified platform authorization system. A user can be denied by one layer (for example feature access) before the module’s canonical business authorization (for example HR house-role/policy checks) even runs.

## 3) Canonical terms (source vocabulary)

These terms are mandatory and should be used consistently in code/docs.

### Authentication
Identity proof that a request is made by a signed-in principal (session/user token validity). Authentication answers: **who is calling?**

### Membership
Context binding between an authenticated entity and a tenancy/business scope (e.g., house/guild membership rows). Membership answers: **is this principal part of this workspace/tenant context?**

### Role
A named responsibility assignment within a scope (platform/guild/house), e.g. `game_master`, `owner`, `manager`, `cashier`. Roles are principal-to-scope assignments, not UI toggles.

### Feature access
Module-level discoverability/entry gating (e.g., HR app tile or POS shell route). Feature access answers: **may this user enter/see this module surface?**

### Action permission
Fine-grained authority to perform operations on resources (policy action/resource matching), e.g. `payroll:*`, `houses:create`. Action permission answers: **may this user perform this operation?**

### Scope
The tenancy boundary where authority is evaluated (platform, guild, house, and later branch/domain scopes). Scope answers: **where does this authority apply?**

## 4) Critical distinctions (must stay explicit)

### Role vs Feature
- **Role**: identity-bound authority assignment in a scope.
- **Feature**: module-level gate/entry experience.

A role may imply feature eligibility, but feature access is not the canonical representation of authority.

### Feature vs Permission
- **Feature**: broad module entrance/discovery gate.
- **Permission**: operation-specific allow/deny logic.

Feature allow must never be treated as sufficient for write operations.

### Owner authority vs operational elevated authority
- **Owner authority**: business-native authority (e.g., workspace owner/manager) derived from tenancy membership/role.
- **Operational elevated authority**: platform-level bypass/control authority (e.g., game master) used for support/operations.

These are different authorities and should not be merged under one ambiguous “admin” concept.

### Business authority vs module authority vs action authority
- **Business authority**: can act in this house/guild/tenant context.
- **Module authority**: can enter/use this module surface (HR, POS, etc.).
- **Action authority**: can execute this exact operation.

All three are valid checks, but each must be evaluated in a defined sequence.

## 5) Current-state audit (key files and behavior)

### Core auth/feature files

1. `src/lib/auth/permissions.ts`
   - Defines `AppFeature` and maps features to policy requests.
   - Implements `canAccess/canAccessAny`.
   - Adds non-production wildcard policy override (`dev-override`) and non-production bypass behavior.

2. `src/lib/auth/feature-guard.ts`
   - Server guard/check wrappers for pages and APIs.
   - Performs feature denial redirect/403 responses.
   - Uses user policy set from `getUserPermissions`.

3. `src/lib/auth/user-permissions.ts`
   - Caches policy resolution for current user via policy server.

4. `src/lib/auth/user-roles.ts`
   - Caches role assignment resolution via authz server.

5. `src/lib/auth/require-auth.ts`
   - Session/user existence check and redirect for unauthenticated page access.

### Entity/role/policy resolution files

6. `src/lib/authz.ts`
   - Canonical-ish entity resolution fallback chain.
   - Role assignment loading (`platform_roles`, `guild_roles`, `house_roles`).
   - Platform `game_master` bypass semantics inside role checks.

7. `src/lib/authz/server.ts`
   - Server entry points for entity/roles/policies and policy evaluation.

8. `src/lib/policy/server.ts`
   - Resolves current entity + hydrated policies (`entity_policies` + `policies`).
   - Exposes evaluate/list helpers and policy-key debug context.

### Module-specific access files

9. `src/lib/hr/access.ts`
   - HR access = workspace membership + (owner/manager role OR HR policy key).

10. `src/lib/pos/access.ts`
    - POS access = POS-capable role OR POS policy key; redirects on deny.

11. `src/lib/inventory/access.ts`
    - Inventory checks direct role-row presence (house/guild membership path).

12. `src/lib/settings/auth.ts`
    - Settings access has its own privileged role list and scope-specific checks.

13. `src/app/api/clock/route.ts`
    - Performs custom authorization composition (roles + permissions + house role query), distinct from module helpers.

### Route/API guard sequence examples

- POS layout and POS APIs gate first at feature guard (`AppFeature.POS`) before module-specific operational checks.
- HR APIs often gate first using feature guards (`PAYROLL`/`TEAM`/`DTR_BULK`) then run `resolveHrAccess`/`requireHrAccess`.
- This means feature gating can deny requests before canonical HR house authorization executes.

## 6) Canonical target architecture (3-layer model)

Agui should standardize authorization code into three explicit layers.

### Layer 1: Definitions / source-of-truth
Proposed canonical file: `src/lib/access/access-definitions.ts`

Responsibilities:
- canonical enums/types for scope, authority kinds, and normalized action/resource keys
- module feature definitions (HR/POS/etc.) as metadata, not as primary authority model
- role semantics and explicit elevated-authority semantics (e.g., platform GM)
- policy key/action naming contracts and migration notes

Rule: this layer is declarative, deterministic, and side-effect free.

### Layer 2: Access resolution
Proposed canonical file: `src/lib/access/access-resolver.ts`

Responsibilities:
- resolve actor/authentication state
- resolve entity identity and tenancy membership context
- resolve role assignments and hydrated permissions for a requested scope
- compute effective authority snapshot (business/module/action lenses)
- centralize dev/non-production override handling for explicit, inspectable behavior

Rule: this layer fetches/derives facts; it does not redirect or emit HTTP responses.

### Layer 3: Access checks / assertions
Proposed canonical file: `src/lib/access/access-check.ts`

Responsibilities:
- check/assert helpers for page/API/server-action use:
  - `requireAuthentication`
  - `requireMembership(scopeContext)`
  - `requireModuleAccess(module, scopeContext)`
  - `requireActionPermission(action, resource, scopeContext)`
- standardized deny behavior payloads (redirect, 401, 403, structured reason)
- request-level guard sequencing orchestration

Rule: this layer consumes layer-2 snapshots and applies explicit policy/check order.

## 7) Canonical guard sequence (page/API)

Every guarded route/API should follow this fixed sequence:

1. **Authentication check** (must be signed in).
2. **Scope context resolution** (target house/guild/tenant).
3. **Operational elevated authority check** (if explicitly defined platform support/bypass applies).
4. **Membership check** for that scope (unless step 3 grants an explicit operational bypass path).
5. **Module/feature gate** (module entry eligibility).
6. **Action permission check** for operation-level access.
7. **Execute business operation**.

Clarification: step 3 applies only to explicitly defined elevated operational authority (for example platform operator / `game_master` / support bypass). It does **not** apply to normal business roles such as owner, manager, HR manager, cashier, or equivalent tenancy roles.

Important for HR-first phase: HR endpoints should not rely on broad feature guard success as a replacement for house-level HR authority.

## 8) Source-of-truth / resolver / assertion mapping from current files

### Should become source-of-truth inputs
- `src/lib/auth/permissions.ts` (feature catalog intent, but refactor to definitions form)
- role scope/types from `src/lib/authz.ts`
- policy key taxonomy currently implicit in `src/lib/policy/server.ts` + module access files

### Should become resolver layer inputs
- `src/lib/authz.ts` (entity + role resolution)
- `src/lib/policy/server.ts` (policy hydration and evaluation)
- `src/lib/auth/user-permissions.ts` and `src/lib/auth/user-roles.ts` (cached session projections)
- module context lookups currently in `hr/access.ts`, `pos/access.ts`, `inventory/access.ts`, `settings/auth.ts`

### Should become check/assertion layer inputs
- `src/lib/auth/feature-guard.ts`
- `src/lib/auth/require-auth.ts`
- module require helpers (`requireHrAccess`, `requirePosAccess`, settings ensure*Access)
- route-local guard composition (e.g., `api/clock/route.ts`) should migrate to shared checks

## 9) Migration direction (incremental, no big-bang rewrite)

1. Create access layer files as wrappers/adapters first.
2. Keep existing module behavior; re-route internal calls through new layer in place.
3. Migrate highest-risk HR routes first to canonical check sequence.
4. Remove duplicate route-local authorization logic after parity checks.
5. Keep feature guards as module-entry checks; never as sole action authorization.
6. Keep non-production override behavior explicit and centralized with structured debug logs.

## 10) Active-phase discipline and operating principles alignment

- This work is **HR-first** and foundation-hardening only.
- No POS/future-system redesign is proposed here.
- No tenancy/identity rule changes are introduced.
- The architecture favors deterministic, migration-friendly, incrementally adoptable changes.
- This document is the reference baseline for authorization standardization tasks that follow.

## 11) Non-goals for this task

- Not implementing full RBAC rewrite.
- Not replacing every existing route guard now.
- Not redefining product permissions for future modules beyond current HR-first needs.


## Related Documents

- Organizational Glossary: ./agui-organizational-glossary.md  
- Hierarchy and Authority Rules: ./agui-hierarchy-and-authority-rules.md  
- Multi-tenant database rules: ./agui-multi-tenant-database-design-rules.md  
- Feature guard boundary: ./agui-feature-guard-boundary.md

## Feature-guard boundary companion

For the explicit boundary between feature/module entry checks and business/action authorization, see `docs/agui-feature-guard-boundary.md`.
