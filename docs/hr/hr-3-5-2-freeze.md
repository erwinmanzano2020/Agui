# HR-3.5.2 Freeze — Employee ID Cards + QR Issuance

Status: **FROZEN**

This document freezes HR-3.5.2 issuance contracts so future HR changes do not silently break printable employee IDs or kiosk QR compatibility.

## Frozen scope
- HR Employee IDs issuance page and APIs for single-card and bulk A4 export.
- Signed employee QR token embedding for kiosk scanning compatibility.
- PDF output and route-level contract behavior listed below.

## Frozen API contracts

### 1) Single employee ID PDF
- Route: `GET /api/hr/employees/[employeeId]/id-card.pdf`
- Auth: HR-only (house-scoped, via existing HR access checks).
- Required query: `houseId`.
- Response on success:
  - `200`
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="EmployeeID-<code>-<employeeId>.pdf"`
  - non-empty PDF bytes
- QR failure behavior:
  - `500`
  - JSON error containing `Failed to generate QR code`

### 2) Bulk print PDF
- Route: `POST /api/hr/employee-ids/print`
- Auth: HR-only (house-scoped, via existing HR access checks).
- Request payload:
  - `houseId: uuid` (required)
  - `employeeIds: string[]` (required, non-empty)
  - `layout?: "a4_9up" | "a4_8up"`
  - `includeCutGuides?: boolean`
- Validation and limits:
  - Maximum payload cap: `employeeIds.length <= 200`
  - If exceeded: `400` with error message `Too many employees requested`
- Deterministic ordering:
  - Cards are sorted alphabetically by employee code (fallback to id) before rendering.
- Response on success:
  - `200`
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="EmployeeIDs-A4.pdf"`
  - non-empty PDF bytes
- QR failure behavior:
  - `500`
  - JSON error containing `Failed to generate QR code`

## Frozen QR generation and compatibility contracts
- QR image generation is local-only in app runtime (no outbound QR API calls).
- QR image format embedded into PDF is PNG Data URL and must start with:
  - `data:image/png;base64,`
- QR token content/signing remains compatible with HR-3.5 kiosk verification:
  - signed token via existing `createEmployeeQrToken(...)`
  - house-scoped, HMAC SHA-256 token scheme
- Issuance is fail-hard on QR generation errors (no placeholder/blank fallback QR).

## Frozen operational safety
- Bulk QR generation remains bounded (concurrency limit in renderer).
- Current bound is `QR_CONCURRENCY = 8`.

## Change policy (required)
Any modification to the frozen contracts above must include **all** of the following in the same PR:
1. Update this freeze doc (`docs/hr/hr-3-5-2-freeze.md`).
2. Update contract tests that assert the changed behavior.
3. Update `docs/engineering/current-state.md` if status/scope changes.
