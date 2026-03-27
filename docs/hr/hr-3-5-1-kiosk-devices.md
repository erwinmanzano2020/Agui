# HR-3.5.1 — Kiosk Devices Admin

## Purpose

This feature adds HR-managed kiosk device provisioning and monitoring so houses can create, disable/enable, rotate, and inspect kiosk devices per branch without manual DB token setup.

## Included

- HR page at `/company/[slug]/hr/kiosk-devices`.
- Device creation with one-time plaintext token reveal.
- Field provisioning handoff from admin device to kiosk device:
  - setup wizard URL QR (opens kiosk setup route in setup mode)
  - separate provisioning token QR for scan-to-input flow
  - manual copy/paste fallback remains available
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
- Setup wizard URL and provisioning token remain separate concepts (token is not required in setup URL by default).
- Kiosk setup does not require admin login on the kiosk device; admin actions remain authenticated in HR admin surface.

## Provisioning / Rotation Flow (Operational)

1. Admin (authenticated, house-scoped) creates or rotates kiosk device token in HR Kiosk Devices.
2. Admin shares setup wizard QR from their own trusted device to the kiosk tablet.
3. Kiosk opens `/company/[slug]/kiosk?setup=1` and enters setup wizard without admin login.
4. Token is transferred by scanning provisioning token QR into token input or by manual paste fallback.
5. Kiosk verifies token against kiosk APIs and saves local kiosk setup state.
6. Rotation repeats the same handoff model (new token issued in admin flow, kiosk re-provisioned without admin login).

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
