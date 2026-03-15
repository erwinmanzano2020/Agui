# HR-3.5 Freeze — Kiosk Clock-in/out

## Frozen
- Kiosk input is QR-only employee identity.
- Employee QR tokens are signed and verifiable without DB storage.
- Kiosk auth uses branch-scoped kiosk tokens (`x-kiosk-token`) looked up by token hash.
- Kiosk toggles IN/OUT based on open segment existence.
- Debounce window is 10 seconds per employee.
- Kiosk writes only raw attendance capture into `public.dtr_segments` with `source='system'`.
- Offline queue + sync API is supported and sync idempotency is keyed by `clientEventId`.
- Time normalization contract is Asia/Manila.

## Not in Scope
- No payroll, OT, schedule, approval, or payout logic.
- No mutation to HR-3.3 / HR-3.4 frozen posting/PDF flows.
- No additional canonical DTR tables.
