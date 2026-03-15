# HR-3.5 Kiosk Clock-in/out (QR, Branch-Scoped, Offline Queue)

## Scope
- Kiosk mode captures attendance scans only.
- Canonical write target remains `public.dtr_segments`.
- Kiosk writes are always `source='system'`.
- No schedule, overtime, payroll, or payout computation is added.

## Contracts
- Employee identity is QR token only.
- QR token is signed (HMAC-SHA256 via `HR_KIOSK_QR_SECRET`).
- Kiosk authentication is by branch-scoped device token (`x-kiosk-token`) hashed in DB.
- Branch is derived from kiosk device registration; there is no branch picker.
- Toggle behavior:
  - Existing open segment => clock-out latest open segment.
  - No open segment => create open segment as clock-in.
- Debounce: same employee scans under 10 seconds return `debounced`.

## Offline Queue
- Device stores unsent scans in local storage queue.
- UI shows queued count and online/offline indicator.
- Sync loop attempts flush every 15s while online.
- `/api/kiosk/sync` accepts queued events and is idempotent by `clientEventId`.

## Security
- Device token plaintext is never stored server-side.
- `hr_kiosk_devices.token_hash` stores SHA-256 hash (optional pepper).
- Employee QR payload includes `employee_id`, `house_id`, `iat`, optional `exp`.
- House mismatch between QR and kiosk device is rejected.
- Kiosk endpoints are service-role backed and authorize strictly through kiosk token lookup.

## Timezone
- Kiosk normalizes scan times to Manila (`+08:00`) before persistence.
- `work_date` is derived from Manila-local date.
