# HR-3.5.1a — Kiosk Setup Wizard

## Purpose

Make kiosk onboarding foolproof for HR/owners by guiding first-run setup and reducing token/config mistakes.

## Wizard Flow (`/company/[slug]/kiosk`)

1. **Welcome / Context**
   - Shows workspace slug and current branch context (once verified).
   - Explains that kiosk capture can queue offline but needs internet for sync.
2. **Enter Kiosk Token**
   - User pastes token from HR Kiosk Devices admin.
3. **Verify Connection**
   - Calls `POST /api/hr/kiosk/verify` with `Authorization: Bearer <deviceToken>` and the current workspace `slug`.
   - Handles friendly outcomes:
     - connected
     - invalid token
     - disabled device
     - server unreachable
   - Supports explicit **Continue offline** fallback.
4. **Confirm Device + PIN**
   - Allows naming the kiosk display label.
   - Optional local-only PIN for Settings access.
5. **Hardening Tips**
   - Keep screen on
   - Auto-start browser
   - Add to home screen
   - Enable Android screen pinning
   - Keep charger connected

## Settings Access

- A small Settings trigger exists in kiosk mode.
- Settings opening requires:
  - PIN entry if configured, or
  - long-press (~3s) fallback when no PIN exists.
- Settings supports:
  - status view (sync time, queue length, online/offline)
  - token update (requires re-verify)
  - PIN set/change/disable
  - local queue clear
  - full kiosk reset

## API: `POST /api/hr/kiosk/*`

- Auth via `Authorization: Bearer <deviceToken>`.
- Responses:
  - `401` missing/invalid token
  - `403` disabled device (`reason: "device_disabled"`)
  - `403` slug mismatch during verify (`reason: "slug_mismatch"`)
  - `200` valid token + device metadata (`id`, `name`, `branch_id`, `branch_name`, `house_id`)
- On success, updates `hr_kiosk_devices.last_seen_at`.

## Android Deployment Recommendations

- Use dedicated Android tablet/phone with kiosk browser profile.
- Configure display timeout to never sleep while charging.
- Enable auto-launch of browser/app after reboot.
- Pin app/screen to prevent accidental exits.
- Keep power always connected and network stable.

## Security Notes

- Kiosk token is sensitive and should never be shared in chat screenshots/public docs.
- If token is exposed, rotate immediately from HR Kiosk Devices admin.
- PIN is device-local (localStorage), not centralized security.
