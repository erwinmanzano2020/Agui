# HR Route Guard Ordering — PARTIAL Route Design Note

Date: 2026-03-25
Status: Documentation of current behavior only (no runtime changes)

## Purpose

This note captures why the remaining HR route families were left as **PARTIAL** after SAFE helper adoption work.

It documents current code truth for:

- `/api/hr/employees/[employeeId]/id-card.pdf`
- `/api/hr/employees/[employeeId]/photo`
- `/api/hr/employees/[employeeId]/photo/upload`

This is not a redesign proposal and does not claim global HR standardization.

---

## Route: `/api/hr/employees/[employeeId]/id-card.pdf`

### Current purpose

Serve an employee ID-card PDF for a specific employee under a caller-provided `houseId` query parameter, after passing legacy business-scope HR authorization chain checks.

### Current entry sequence (actual code order)

1. Validate `employeeId` route param (`UUID`) using `ParamsSchema`.
2. Read and validate `houseId` from query string.
3. Create server Supabase client and read user (`supabase.auth.getUser`) for logging context.
4. Capture feature debug snapshot for logging.
5. Run route-local authorization pipeline:
   - `requireAuthentication(scopeType=house, scopeId=houseId)`
   - `resolveAccessContext(...)`
   - `requireBusinessScopeAccess(...)`
   - `requireModuleAccess(AppFeature.HR, ...)`
   - `requireHrBusinessAccess(...)`
6. Return `403` for `AuthorizationDeniedError`; otherwise `500` for pipeline failure.
7. Load employee card by `(houseId, employeeId)`.
8. Return `404` if card is missing.
9. Generate and stream PDF.

### Current access chain/helpers used

- `requireAuthentication`
- `resolveAccessContext`
- `requireBusinessScopeAccess`
- `requireModuleAccess(AppFeature.HR)`
- `requireHrBusinessAccess`

This is a **membership/business-scope chain**, not the newer route helper chain (`auth -> entity -> feature`) used by SAFE families.

### House/branch/identity assumptions

- House boundary is caller-selected (`houseId` query param) and drives auth scope.
- Employee lookup is house-filtered in data access (`getEmployeeIdCardById(supabase, houseId, employeeId)`).
- No explicit branch-scoped write/read lane here.
- Identity-link resolution is not explicit at route entry; membership/scope helpers provide authorization semantics.

### Anti-enumeration or privacy-sensitive behavior

- Denied access collapses to `403 Not allowed` for authorization denials.
- Existence check (`404 Employee not found`) only occurs after authorization succeeds.

### Why PARTIAL instead of SAFE

- Route is intentionally coupled to legacy business-scope membership/module/HR chain semantics.
- Mechanical replacement with `resolveHrRouteActorContext(...)` would bypass/flatten this chain unless the same semantics are re-expressed explicitly.

### Safe-adoption prerequisites

- Explicit mapping decision between business-scope chain semantics and helper semantics.
- Confirmed parity for role/policy/module behavior (`requireModuleAccess` + `requireHrBusinessAccess`) under all deny paths.
- Agreed handling for `houseId` query-driven scoping with no change to current deny/allow envelopes.

### Risks of mechanical helper adoption

- Silent access widening/narrowing by changing gate semantics.
- Loss of intentional membership/module ordering behavior.
- Deny-path drift (`403` vs alternative envelopes/status) and observability drift in route logs.

### Recommendation

**Needs explicit redesign** before helper adoption. Not SAFE for mechanical swap.

---

## Route: `/api/hr/employees/[employeeId]/photo`

### Current purpose

Persist or clear employee photo metadata (`photo_url`, `photo_path`) through employee update flows that rely on branch-limited write semantics.

### Current entry sequence (actual code order)

For both `POST` and `DELETE`:

1. Read `employeeId` from route params.
2. Parse JSON payload and derive `operationId` from header/body.
3. Validate payload shape (`houseId`, nullable photo fields for `POST`; `houseId` for `DELETE`).
4. Route-local write path calls `persistPhoto(...)`.
5. In `persistPhoto(...)`:
   - Create Supabase client.
   - Run `requireHrAccessWithBranch(..., { requiredLevel: "write" })`.
   - If denied, return `403`.
   - Resolve mutable employee target with `resolveEmployeeWriteTargetForHouseWithAccess(...)`.
   - Return `403` on `EmployeeAccessError`, `404` if target missing.
   - Load current employee profile fields.
   - Call `updateEmployeeForHouseWithAccess(...)` (re-validates write target + branch assignment constraints).
   - Return `403` on `EmployeeAccessError`, `404` if missing, else success payload.

### Current access chain/helpers used

- `requireHrAccessWithBranch(..., { requiredLevel: "write" })`
- `resolveEmployeeWriteTargetForHouseWithAccess(...)`
- `updateEmployeeForHouseWithAccess(...)`

Important: The write lane is enforced by route + domain helpers together. `requiredLevel` is passed at callsite, while downstream domain helpers enforce mutation target and branch-scope constraints.

### House/branch/identity assumptions

- `houseId` comes from request body and is the tenancy boundary for mutation.
- Branch-limited users are constrained by employee target mutability rules (`resolveEmployeeWriteTargetForHouseWithAccess`).
- Update path preserves existing domain update expectations by loading current employee fields and writing through canonical employee update helper.

### Anti-enumeration or privacy-sensitive behavior

- Denied mutable-target access maps to `403 Not allowed`.
- Non-existent employee maps to `404 Employee not found` after passing higher-level checks.
- Error mapping is deliberately narrow (`EmployeeAccessError` => `403`, unexpected => `500`).

### Why PARTIAL instead of SAFE

- Route is a write-path specialization coupled to branch/mutability domain checks, not only entry auth/feature checks.
- Mechanical helper insertion at entry can blur boundaries between entry gate and mutation authorization lane and invite accidental simplification.

### Safe-adoption prerequisites

- Explicitly documented contract for how route-entry helper coexists with write-lane branch enforcement.
- Confirmed preservation of current `403/404/500` mapping across `EmployeeAccessError` vs missing-target paths.
- Verified no reordering that moves/duplicates mutation checks in ways that alter deny semantics.

### Risks of mechanical helper adoption

- Flattening write-lane semantics into generic entry auth gate.
- Accidentally widening writes for branch-limited actors or changing when `404` vs `403` is emitted.
- Drift in domain error mapping and logs used for operational debugging.

### Recommendation

**Leave route-specific** unless/until a write-lane-specific adoption plan is approved.

---

## Route: `/api/hr/employees/[employeeId]/photo/upload`

### Current purpose

Handle binary employee photo upload to storage with strict path ownership and auth-first anti-enumeration sequencing.

### Current entry sequence (actual code order)

1. Validate `employeeId` route param as UUID.
2. Parse multipart form payload.
3. Validate payload fields:
   - `houseId` UUID
   - `path` shape (`employee-photos/...` + image extension)
   - `contentType` (`image/jpeg` or `image/png`)
   - `file` presence/type
4. Enforce path ownership (`path` must correspond to route `employeeId`).
5. Authorization phase:
   - `requireAuthentication(scopeType=house, scopeId=houseId)`
   - `requireHrAccess(supabase, houseId)`
6. Only after auth/HR access succeeds, resolve employee owner house (`resolveEmployeeHouseId(employeeId)`).
7. Map missing employee => `404`; house mismatch => `403`.
8. Upload to `employee-photos` bucket with service client.

### Current access chain/helpers used

- `requireAuthentication` (house-scoped)
- `requireHrAccess`
- Route-local ownership validation (`isPathOwnedByEmployee`, `resolveEmployeeHouseId`)

This route intentionally combines auth/access checks with upload/domain-specific ownership checks.

### House/branch/identity assumptions

- Caller supplies `houseId`; route compares normalized `houseId` against employee record ownership.
- Upload path must be employee-bound (`employee-photos/{employeeId}.{jpg|png}`).
- Uses service client for ownership lookup and storage write after authorization gate.

### Anti-enumeration or privacy-sensitive behavior

- Authentication/HR deny returns `403` before employee ownership lookup.
- Tests explicitly assert no employee lookup occurs when auth/access fails.
- This sequencing reduces employee existence leakage for unauthorized callers.

### Why PARTIAL instead of SAFE

- Route has security-sensitive sequencing where ownership lookup is intentionally delayed until after auth/access.
- Mechanical helper adoption could reorder ownership lookup or collapse distinctions between auth denial and ownership checks.

### Safe-adoption prerequisites

- Proven guard-order contract that preserves: `auth/access deny before employee lookup`.
- Explicit test coverage guaranteeing unauthorized requests cannot trigger employee ownership probes.
- A route-local boundary definition of what remains outside shared helper (upload path ownership + storage-specific validation).

### Risks of mechanical helper adoption

- Reordering that reintroduces enumeration signals (e.g., different statuses/timing before auth).
- Conflating generic actor resolution with upload-specific ownership rules.
- Accidental response-envelope/status drift in security-sensitive deny paths.

### Recommendation

**SAFE later** only with explicit anti-enumeration sequencing guarantees and dedicated drift tests.

---

## Final summary table

| Route | Current classification | Why deferred | Safe-adoption prerequisites | Recommendation |
|---|---|---|---|---|
| `/api/hr/employees/[employeeId]/id-card.pdf` | PARTIAL | Uses legacy business-scope membership/module/HR chain not equivalent to mechanical helper swap | Explicit semantics mapping + deny-path parity proof | needs explicit redesign |
| `/api/hr/employees/[employeeId]/photo` | PARTIAL | Branch/mutability write lane is domain-coupled and sensitive to check placement | Write-lane coexistence contract + 403/404 parity guarantees | leave route-specific |
| `/api/hr/employees/[employeeId]/photo/upload` | PARTIAL | Auth-first anti-enumeration ordering and upload ownership checks are sequencing-sensitive | Guaranteed auth-before-lookup ordering with route-local ownership boundaries preserved | SAFE later |

## Explicit non-goals / non-changes

- No runtime code changes.
- No helper expansion.
- No route-entry rewrites.
- No access semantics changes.
- No response contract changes.
- No tenancy/branch/identity/upload/anti-enumeration behavior changes.
