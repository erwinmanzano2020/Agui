# POS Access Resolution Pattern (Canonical)

## Status
- Status: active
- Type: canonical definition-only pattern (POS)
- Scope: POS page reads, POS API reads, POS server-helper read paths

## 1. Purpose
This document defines one canonical access/scope resolution pattern for POS so device/session/operator flows stay tenancy-safe and no-leak across pages, APIs, and helpers.

## 2. Canonical Principles
1. House is the tenant boundary.
2. Branch is an in-house limiter, never a second tenant.
3. Access resolution is authoritative and precedes scoped data reads.
4. Device/session/operator context must be validated before operational data access.
5. Deny-by-default and no-leak behavior is mandatory.
6. Scope must be propagated explicitly to downstream queries/helpers.
7. Metadata must never be broader than row scope.

## 3. Canonical Sequence Patterns
### A) POS Page Route (SSR)
1. Validate route/search input.
2. Resolve authenticated actor and POS access context for target house.
3. Resolve allowed branch scope (if branch-limited actor).
4. Validate device/session context if route is terminal-operational.
5. Query rows only from resolved scope.
6. Load metadata from same scope (or derive from scoped rows).
7. Apply canonical page deny behavior (e.g., notFound) where page contract defines it.

### B) POS API Route (read)
1. Validate input.
2. Authenticate caller (`401` if unauthenticated).
3. Authorize for house + branch + POS capability context.
4. Validate referenced device/session ownership/scope.
5. Execute scoped query based on resolved scope only.
6. Return scoped metadata/rows parity.
7. Return `403` for authenticated-but-forbidden outcomes with no-leak payloads.

### C) POS Helper/Service Read Function
1. Accept explicit scope input (`houseId`, `branchScope`, and device/session scope when relevant).
2. Reject missing or invalid scope.
3. Query with explicit scope only.
4. Return conservative empty/no-scope-safe results for zero-scope.

### D) ID-Based Route Discipline
- Never query by bare ID without scope constraints.
- Validate ID + resolved scope first, then fetch.
- No existence hints outside authorized scope.

## 4. Device/Session/Operator Scope Rules
- POS device must belong to resolved house and allowed branch context.
- Session must belong to the device and resolved house context.
- Operator must be authenticated in shared identity context and verified by POS credential flow.
- Requests missing consistent device/session/operator scope must deny conservatively.

## 5. Mixed Metadata + Rows Parity Rule
When responses include both metadata and row data:
- both must be derived from identical resolved scope,
- partial metadata failures must not broaden row query scope,
- branch-limited callers must not receive house-wide metadata leakage.

## 6. Deny Behavior (Conservative)
- `400`: invalid input.
- `401`: unauthenticated API caller.
- `403`: authenticated but not authorized in POS scope.
- `404`: not found within already-authorized scope only.

No-leak discipline:
- never reveal unauthorized entity existence or cross-house identifiers,
- keep deny payloads minimal and non-diagnostic.

## 7. Anti-Patterns (Forbidden)
- access-after-fetch on sensitive resources
- treating branch as tenant replacement
- accepting QR identifier alone as terminal authorization
- house-wide metadata with branch-scoped rows
- implicit scope propagation by optional object shape

## 8. Last Updated
2026-04-01 (UTC)
