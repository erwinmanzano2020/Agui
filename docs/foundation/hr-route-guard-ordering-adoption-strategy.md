# HR Route Guard Ordering — Adoption Strategy for Remaining PARTIAL Families

Date: 2026-03-25  
Status: Canonical decision document (design-only; no runtime changes)

## Purpose

This document converts the PARTIAL-family analysis into explicit adoption decisions for the remaining HR routes that were intentionally deferred in earlier route-guard ordering passes.

This is a **stability-first** decision artifact. It does **not** approve mechanical helper adoption for all remaining PARTIAL routes and does **not** imply a broader HR access redesign.

## Scope

In scope (and only in scope):

- `/api/hr/employees/[employeeId]/id-card.pdf`
- `/api/hr/employees/[employeeId]/photo`
- `/api/hr/employees/[employeeId]/photo/upload`

Out of scope:

- runtime code changes
- helper refactors or new abstractions
- kiosk/device EXCEPTION families
- non-HR route families

## Decision principles (applied)

1. Prefer stability over unification.
2. Preserve anti-enumeration sequencing where present.
3. Preserve branch-limited write-lane semantics where present.
4. Keep business-scope chain semantics explicit when they are route-defining.
5. Use explicit exceptions when semantics differ materially from standardized SAFE families.

---

## Route decision: `/api/hr/employees/[employeeId]/id-card.pdf`

### 1) Route purpose

- Serves employee ID-card PDF output for a specific employee.
- Exists as a house-scoped, authorized document export endpoint for HR operations.
- Boundary: HR employee document export, with legacy membership/business-scope authorization chain semantics.

### 2) Current access/entry sequence

Current order in route flow:

1. Validate `employeeId` route param.
2. Validate query `houseId`.
3. Resolve session user (debug/log context).
4. Capture feature snapshot (debug/log context).
5. Execute route authorization chain:
   - `requireAuthentication(scopeType=house, scopeId=houseId)`
   - `resolveAccessContext(...)`
   - `requireBusinessScopeAccess(...)`
   - `requireModuleAccess(AppFeature.HR, ...)`
   - `requireHrBusinessAccess(...)`
6. Map authorization deny to `403`.
7. Query employee ID-card by `(houseId, employeeId)`.
8. Return `404` when absent.
9. Generate and stream PDF.

Route-entry concerns:

- parameter/query validation
- membership/module/business chain entry
- deny envelope/status handling at entry

Business/domain concerns:

- house-filtered employee-card lookup
- PDF generation and download response

### 3) Critical invariants

Must not change:

- Legacy access-chain gate semantics and order as currently implemented for this route family.
- `403` for authorization denial and `404` for missing employee card after authorization.
- House-scoped lookup behavior (`houseId` + `employeeId` pair).
- Observability intent around authorization outcome logging.

### 4) Risk profile

Mechanical helper adoption risk:

- May flatten or alter business-scope chain semantics into generic route-entry assumptions.
- May drift deny envelopes/status behavior and decision boundaries.
- May unintentionally shift the semantic relationship between membership scope resolution and module/HR checks.

Security/privacy/tenancy risk:

- Wrong semantic mapping could widen or narrow access in house-scoped export behavior.

Branch/write-lane or anti-enumeration risk:

- No branch write lane is primary here; core risk is semantic drift in business-scope chain behavior.

### 5) Adoption classification

**REQUIRES REDESIGN FIRST**

### 6) Prerequisites for future change

Before any helper adoption attempt:

1. Publish a design mapping of existing chain semantics to proposed helper semantics, with explicit allow/deny parity matrix.
2. Produce deny-path parity proof (status + response behavior) for all relevant failure stages.
3. Document how query-driven `houseId` scoping remains equivalent under any proposed entry change.
4. Add scoped regression tests proving unchanged authorization and missing-target behavior.

### 7) Allowed helper scope

Potentially helper-owned later:

- none by default until redesign is approved.

Must remain route-local (“DO NOT MOVE”):

- business-scope membership chain semantics specific to this route
- query `houseId`-driven scoping behavior
- route-specific deny mapping and PDF export behavior

### 8) Recommended next action

**add design prework first**

---

## Route decision: `/api/hr/employees/[employeeId]/photo`

### 1) Route purpose

- Persists or clears employee photo metadata (`photo_url`, `photo_path`) through employee update flows.
- Exists to support photo lifecycle updates while preserving employee write authorization constraints.
- Boundary: HR employee mutation path with branch-limited write-lane enforcement.

### 2) Current access/entry sequence

Current order in route flow (`POST` and `DELETE`):

1. Resolve `employeeId` param.
2. Parse request body and derive operation metadata.
3. Validate payload (`houseId` and expected fields).
4. Enter `persistPhoto(...)`.
5. In mutation path:
   - `requireHrAccessWithBranch(..., { requiredLevel: "write" })`
   - `resolveEmployeeWriteTargetForHouseWithAccess(...)`
   - load current employee profile fields
   - `updateEmployeeForHouseWithAccess(...)`
6. Preserve current error mapping (`403` access deny, `404` missing target, `500` unexpected).

Route-entry concerns:

- payload shape validation
- route-level mutation entry and error envelope framing

Business/domain concerns:

- branch-limited write access determination
- write-target resolution and mutability checks
- employee update constraints and persistence behavior

### 3) Critical invariants

Must not change:

- Branch-limited write semantics for employee target mutation.
- Layered enforcement pattern (`requireHrAccessWithBranch` + write-target/update helpers).
- `403` vs `404` mapping behavior for access-denied vs missing-target states.
- House-scoped mutation boundaries for employee photo metadata.

### 4) Risk profile

Mechanical helper adoption risk:

- Can blur route-entry gating with mutation-lane authorization checks.
- Can accidentally simplify or duplicate write checks in ways that change effective authorization behavior.
- Can alter response mapping and operationally meaningful deny/missing distinctions.

Security/privacy/tenancy risk:

- Incorrect write-lane handling could expose unauthorized mutation capability in branch-limited contexts.

Branch/write-lane or anti-enumeration risk:

- Primary risk is branch/write-lane coupling drift.

### 5) Adoption classification

**PERMANENT EXCEPTION**

### 6) Prerequisites for future change

No helper-adoption prerequisites are defined because this route is classified as permanent route-specific.

If re-opened by future architecture decision (not currently planned), required first:

- formal HR write-lane redesign scope approval
- explicit proof that branch-limited mutation semantics are unchanged
- explicit parity tests for `403/404/500` behavior

### 7) Allowed helper scope

Potentially helper-owned:

- none (current decision).

Must remain route-local (“DO NOT MOVE”):

- branch-limited write gate invocation and required write-level contract
- employee write-target resolution sequencing
- mutation-path-specific error/status mapping

### 8) Recommended next action

**mark permanently exception-only**

---

## Route decision: `/api/hr/employees/[employeeId]/photo/upload`

### 1) Route purpose

- Accepts employee photo binary upload payloads and writes to storage path under strict ownership constraints.
- Exists to support storage-backed employee photo upload with controlled path and tenancy checks.
- Boundary: HR upload surface with security-sensitive sequencing.

### 2) Current access/entry sequence

Current order in route flow:

1. Validate `employeeId` route param.
2. Parse multipart form payload.
3. Validate `houseId`, `path`, `contentType`, and file presence/type.
4. Validate path ownership against `employeeId`.
5. Authorization phase:
   - `requireAuthentication(scopeType=house, scopeId=houseId)`
   - `requireHrAccess(supabase, houseId)`
6. After auth/access success, resolve employee owner house (`resolveEmployeeHouseId(employeeId)`).
7. Return `404` if employee missing; `403` on house mismatch.
8. Execute storage upload.

Route-entry concerns:

- payload and path-shape validation
- auth/access gating before ownership lookup

Business/domain concerns:

- employee ownership/house resolution
- tenancy match enforcement
- storage upload behavior

### 3) Critical invariants

Must not change:

- Auth/access deny path must occur before employee ownership lookup.
- Unauthorized requests must not trigger employee-ownership probing.
- Ownership/path validation semantics and allowed content types.
- Current status behavior for deny/missing/mismatch/upload failure outcomes.

### 4) Risk profile

Mechanical helper adoption risk:

- Can reorder checks so ownership lookup occurs before auth/access denial.
- Can reintroduce enumeration signal leakage via status/timing/path differences.
- Can over-generalize upload-specific ownership constraints.

Security/privacy/tenancy risk:

- High anti-enumeration and tenancy-leak sensitivity if sequencing drifts.

Branch/write-lane or anti-enumeration risk:

- Primary risk is anti-enumeration-sensitive sequencing drift.

### 5) Adoption classification

**CONDITIONAL**

### 6) Prerequisites for future change

Before any helper adoption attempt:

1. Define and approve a guard-order contract that explicitly preserves `auth/access deny before ownership lookup`.
2. Add regression tests proving unauthorized requests never execute ownership lookup.
3. Prove no response/timing drift for deny and missing/mismatch cases.
4. Document route-local upload ownership checks that remain non-transferable to generic helpers.

### 7) Allowed helper scope

Potentially helper-owned later (conditional):

- limited authentication/entity/feature entry resolution only, if sequencing contract is provably preserved.

Must remain route-local (“DO NOT MOVE”):

- path ownership validation
- employee ownership lookup sequencing boundary
- storage-specific upload constraints and response mapping

### 8) Recommended next action

**revisit in a future scoped pass**

---

## Final summary

| Route | Current classification | Why | Preconditions for future adoption | Recommended next action |
|---|---|---|---|---|
| `/api/hr/employees/[employeeId]/id-card.pdf` | REQUIRES REDESIGN FIRST | Route-defining legacy business-scope chain semantics are not a safe mechanical fit for standardized helper entry. | Formal semantics-mapping design + deny-path parity proof + scoped regression coverage. | add design prework first |
| `/api/hr/employees/[employeeId]/photo` | PERMANENT EXCEPTION | Branch-limited write-lane mutation semantics are tightly route/domain-coupled and should remain route-specific. | None planned; only revisit under explicit future write-lane architecture redesign scope. | mark permanently exception-only |
| `/api/hr/employees/[employeeId]/photo/upload` | CONDITIONAL | Anti-enumeration-sensitive sequencing requires auth/access deny before ownership lookup. | Approved sequencing contract + tests proving no pre-auth ownership lookup + deny/missing parity proof. | revisit in a future scoped pass |
