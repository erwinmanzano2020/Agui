# HR-3.5.2 Freeze Declaration — Employee ID Cards + QR Issuance

## A. Declaration
HR-3.5.2 is frozen. Any behavior changes require an explicit unfreeze/migration task and approval.

## B. Frozen Contracts (Non-Negotiable)
- **Routes and methods**
  - `GET /api/hr/employees/[employeeId]/id-card.pdf`
  - `POST /api/hr/employee-ids/print`
- **Payload validation**
  - `houseId` must be present and valid.
  - `employeeIds` must be a non-empty array of strings for bulk print.
  - HR access and house scoping are enforced before issuing PDFs.
- **Bulk cap**
  - Maximum `200` employee IDs per bulk request.
  - Requests over cap fail with `400` and message: `Too many employees requested`.
- **Deterministic ordering**
  - Bulk print order is deterministic: `code` alphabetical (case-insensitive), fallback/tie-break by `id`.
- **PDF response contract**
  - `Content-Type: application/pdf`
  - `Cache-Control: no-store`
  - Single export filename format: `EmployeeID-<sanitized-code>-<sanitized-id>.pdf`
  - Bulk export filename format: `EmployeeIDs-A4.pdf`
- **QR generation contract**
  - QR image generation is local-only in app runtime (no external QR API dependency).
  - QR output must be PNG data URL with prefix: `data:image/png;base64,`.
  - Export is fail-hard on QR generation errors (returns `500`, no placeholder QR output).
- **Token signing compatibility**
  - QR token generation must remain compatible with kiosk verification via the shared token helpers.
  - Do not introduce a new signing scheme that breaks `createEmployeeQrToken(...)` / `verifyEmployeeQrToken(...)` interoperability.

## C. Contract Test Coverage Required
The following behaviors must remain covered by automated contract tests:
- PDF response headers and filename format.
- Bulk cap error shape (`400` + `{ error: "Too many employees requested" }`).
- Deterministic ordering in bulk output.
- QR output prefix `data:image/png;base64,`.

## D. Change Policy
If HR-3.5.2 behavior changes, the same PR must update:
1. This freeze doc (`docs/hr/hr-3-5-2-freeze.md`), and
2. The HR-3.5.2 contract tests that enforce the changed behavior.

No silent contract drift.

## E. Non-goals (Frozen-Out)
- No redesign of the card layout.
- No new features (photo workflows, template system, printing UI enhancements).

## F. References
- [HR-3.5.2 Employee ID Cards](./hr-3-5-2-employee-id-cards.md)
- [HR-3.5 Kiosk Freeze](./hr-3-5-freeze.md)
- [Engineering Current State](../engineering/current-state.md)
