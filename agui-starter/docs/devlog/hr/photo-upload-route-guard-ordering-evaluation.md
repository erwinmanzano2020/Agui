# HR employee photo upload route-entry evaluation (conditional)

Date: 2026-03-26

Route reviewed:
- `POST /api/hr/employees/[employeeId]/photo/upload`

Decision:
- **Not adopted** to canonical `resolveHrRouteActorContext(...)` route-entry helper.
- Route remains **CONDITIONAL**.

## Confirmed current runtime sequence

From `src/app/api/hr/employees/[employeeId]/photo/upload/route.ts`, the observed sequence is:

1. Route param UUID validation (`employeeId`), then operation metadata capture.
2. Multipart form parse (`req.formData()`).
3. Payload field validation (`houseId`, `path`, `contentType`, `file`).
4. Upload path ownership validation (`isPathOwnedByEmployee(path, employeeId)`).
5. Authentication gate (`requireEmployeePhotoUploadAuthentication` -> `requireAuthentication`).
6. HR access gate (`requireEmployeePhotoUploadHrAccess` -> `requireHrAccess`).
7. Employee ownership lookup (`resolveEmployeeHouseId` -> service-role query).
8. House match check (`employee.house_id` vs provided `houseId`).
9. Storage upload write (`storage.from("employee-photos").upload(...)`).

Security-sensitive boundary confirmed:
- Employee ownership lookup and storage upload execute only after auth + HR access gates.
- Auth/HR deny paths return `403 { error: "Not allowed" }` and do not perform employee lookup.

## Why canonical helper was not adopted

`resolveHrRouteActorContext(...)` enforces a different entry model (`auth -> entity -> feature`) and requires entity resolution + feature gating. This route currently uses house-scoped `requireAuthentication(...)` + `requireHrAccess(...)` and then performs route-local employee ownership and upload-path checks.

Adopting the canonical helper here would require semantic bridging between:
- house-scoped membership/access semantics and
- entity/feature route-entry semantics,

which cannot be proven equivalent for this upload route without broader access-model changes (out of scope for this task).

To preserve anti-enumeration and deny-path parity, upload-specific ownership checks remain route-local.

## Regression coverage added

Tests in `photo/upload/__tests__/route.test.ts` now assert:
- auth deny short-circuits before HR access, ownership lookup, and upload;
- success path ordering remains `auth -> hr access -> ownership lookup -> upload`;
- existing missing employee, house mismatch, deny-path, and happy-path checks remain in place.
