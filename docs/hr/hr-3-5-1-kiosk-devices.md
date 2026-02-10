# HR-3.5.1 — Kiosk Devices Admin

## Purpose

This feature adds HR-managed kiosk device provisioning and monitoring so houses can create, disable/enable, rotate, and inspect kiosk devices per branch without manual DB token setup.

## Included

- HR page at `/company/[slug]/hr/kiosk-devices`.
- Device creation with one-time plaintext token reveal.
- Device lifecycle actions:
  - disable / enable
  - rotate token (old token immediately invalid)
- Device monitoring fields:
  - `last_seen_at`
  - `last_event_at`
  - `disabled_at`
  - `disabled_by`
- Recent events panel per device from `hr_kiosk_events`.

## Token Handling Rules

- Plaintext kiosk token is generated server-side at create/rotate time.
- Database stores **hash only** (`token_hash`).
- Plaintext token is shown to HR **once** and cannot be retrieved later.

## Disable Behavior

- Disabled devices fail kiosk authentication for:
  - `POST /api/kiosk/scan`
  - `POST /api/kiosk/sync`
- Current behavior returns `401` with invalid token semantics.

## Monitoring Behavior

- Successful kiosk scan/sync touches `last_seen_at` on device.
- Successful kiosk event writes update `last_event_at` to event `occurred_at`.

## Not Included

- Employee self-service portal changes.
- Biometric or face/fingerprint integrations.
- Kiosk PDF printing.
- Payroll logic changes.
- Background daemon runtime for kiosk; kiosk remains browser-based.
