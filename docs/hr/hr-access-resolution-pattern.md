# HR Access Resolution Pattern (Canonical)

## Status
- **Status:** active
- **Type:** canonical definition-only pattern (HR)
- **Scope:** HR page reads, HR API reads, and HR server-helper read paths

## Purpose
This document defines one canonical access-resolution pattern for HR read paths so tenancy/auth enforcement is not reinvented inconsistently across pages, APIs, and helpers.

It prevents:
- house/branch scope drift across layers
- metadata scope widening beyond row scope
- ID-enumeration and deny/not-found leakage
- inconsistent access ordering that causes over-broad or under-scoped reads

This file is definition-only and does not change code, schema, contracts, or middleware.

## Canonical Principles
1. **House is the tenant boundary.**
2. **Branch is an in-house limiter, never a second tenant model.**
3. **Access resolves before sensitive reads where the route/helper contract requires access-first behavior.**
4. **Metadata must never be broader than returned row scope.**
5. **Zero-scope branch outcomes must not widen visibility.**
6. **Partial metadata failure must not widen row scope.**
7. **Deny-by-default and no-leak behavior are mandatory.**
8. **Resolved scope must be propagated explicitly to downstream helpers.**

## Canonical Sequence Patterns

### 1) HR Page Route (SSR/page-level reads)
1. Validate route/search input.
2. Resolve access (`requireHrAccess(...)` or `requireHrAccessWithBranch(...)`) for the target house context.
3. Build row filters from resolved access scope.
4. Load scoped rows.
5. Load metadata from the same resolved scope (or derive from scoped rows).
6. If authorization fails for scoped resource routes, use canonical page deny behavior (`notFound()` as currently defined).

### 2) HR API Route (read endpoints)
1. Validate request input and shape.
2. Resolve authentication; unauthenticated returns `401`.
3. Resolve authorization/scope for requested house/branch context.
4. Build and execute scoped row query only from resolved scope.
5. Derive/return metadata only within that same scope.
6. Return `403` for authenticated-but-forbidden outcomes.
7. Keep responses no-leak (do not reveal unauthorized entity existence/details).

### 3) Helper/Service Function (server-side read helper)
1. Accept explicit scope input (`houseId`, and `branchScope` when branch-limited).
2. Reject missing/invalid scope input early.
3. Query rows using only provided canonical scope.
4. Derive helper metadata from scoped rows or equally scoped queries.
5. Return empty/no-scope-safe results when scope resolves to none.

### 4) Mixed Metadata + Rows Read Path
1. Resolve access scope first.
2. Execute row query with that scope.
3. Compute metadata from scoped rows, or run metadata queries with identical scope filters.
4. If metadata computation partially fails, keep row scope unchanged and conservative.
5. Never fallback to house-wide metadata for branch-scoped rows.

### 5) ID-Based Route With Explicit `houseId`
1. Validate `id` + `houseId` shape.
2. Resolve HR access for `houseId` (plus branch scope if needed).
3. Query by `id` under resolved scope filters (not bare `id`).
4. Return canonical deny/not-found outcome with no-leak response body.

### 6) ID-Based Route Without Explicit `houseId`
1. Resolve actor access context first to determine allowed house scope.
2. Query target record using scope-constrained filters (never unscoped/bare `id`).
3. If no scoped match exists, return conservative not-found/forbidden outcome per layer contract.
4. Do not reveal whether the `id` exists outside caller scope.

## Branch-Limited Rules
- Use `requireHrAccessWithBranch(...)` when the read path includes branch-operational resources or branch-limited actors/policies.
- Pass `branchScope` explicitly to downstream helpers; do not rely on implicit object shape casting.
- If allowed branch set is empty, treat as zero-scope and return no data (or canonical deny outcome by layer).
- Sanitize branch query/filter inputs against resolved allowed branches before querying.
- Any returned branch metadata (lists/counts/summaries) must be derived from the same scoped branch set as rows.

## Response-Shape Rules (Conservative)
- **400 Bad Request:** invalid or missing required input.
- **401 Unauthorized:** unauthenticated caller (API).
- **403 Forbidden:** authenticated caller lacking required HR scope/capability (API).
- **404 Not Found:** resource not visible in resolved scope, or canonical page-level unauthorized behavior where `notFound()` applies.

No-leak discipline:
- Do not include unauthorized IDs, house identifiers, branch identifiers, or existence hints in deny/not-found payloads.
- Keep deny payloads minimal, stable, and non-diagnostic for unauthorized entities.

## Implementation Rules
- Prefer access-first resolution.
- Do not fetch by bare ID first if that can create tenancy/access drift.
- Do not rely on implicit shape-casting for branch scope values.
- Do not let metadata loaders widen row scope.
- Always propagate resolved scope explicitly into downstream helpers/services.

## Anti-Patterns (Do Not Use)
- Running resource lookup before access resolution when avoidable.
- Loading house-wide metadata while returning branch-scoped rows.
- Treating empty branch scope as broad/no-filter access.
- Deriving row filters from partial metadata instead of resolved access scope.
- Returning deny/not-found payloads that leak IDs, cross-house hints, or entity details.

## Current Approved Examples (Direction Already Reflected)
- HR status invariants requiring access-derived scope for both rows and metadata, including zero-scope and partial-metadata safeguards.
- Canonical deny behavior split by layer (`401/403` for API, `notFound()` default for unauthorized scoped page access).
- Existing HR hardening direction emphasizing read-path parity across API routes, server helpers, and page-level compositions.

References:
- [`hr-status.md`](./hr-status.md)
- [`hr-deny-ux-rules.md`](./hr-deny-ux-rules.md)
- [`hr-master-plan.md`](./hr-master-plan.md)
- [`hr-master-plan-expanded.md`](./hr-master-plan-expanded.md)

## Scope Note
This document is HR-only. It does not authorize POS or future-system behavior changes and does not alter frozen HR contracts.
