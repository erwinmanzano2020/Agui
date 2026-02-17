# HR-3.5.2 Employee ID Cards (CR80) + QR Issuance

## Scope
- HR-only issuance of printable employee IDs.
- Single CR80 card export and bulk A4 sheet export.
- No kiosk behavior changes; kiosk scan/verify still uses existing HR-3.5 contract.

## Card dimensions
- CR80 size: **85.60mm x 53.98mm**.
- Front-only layout in v1.

## Included content (v1)
- House name header.
- Employee code (primary visual identifier).
- Optional branch name.
- QR token block.
- Photo placeholder box with label `PHOTO (paste here)`.
- Footer reminders:
  - `Scan at kiosk`
  - `If QR is damaged, contact HR for reprint.`

## QR token contract
- QR encodes signed token from existing helper: `createEmployeeQrToken(...)`.
- Signing scheme: HMAC SHA-256.
- Payload is house-scoped and includes employee identifier claims used by kiosk verification.
- No raw personal profile data is encoded outside the signed token payload.

## Bulk print contract
- Endpoint: `POST /api/hr/employee-ids/print`.
- Accepts employee IDs and renders one merged A4 PDF sheet.
- Ordering is deterministic: alphabetical by employee code, fallback to employee id.
- Includes optional cut guides (`includeCutGuides`, default true).

## Boundaries
- No PDF storage in DB/object storage (response is generated on-demand).
- No employee photo upload/render support yet (placeholder only).
- House scoping and HR access are enforced on print APIs.

## Future
- Photo upload/placement flow.
- Admin template customization (branding, fonts, field placement).
- Optional card back side and policy/legal footer variants.
