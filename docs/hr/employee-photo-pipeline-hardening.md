# HR Employee Photo Pipeline (Stable Baseline)

This note captures the current stable baseline for the employee photo flow before background-removal enhancements.

## Final pipeline flow

1. User selects or captures a photo in `EmployeePhotoField`.
2. Client normalizes image to JPEG and opens crop modal.
3. User confirms crop; client renders portrait crop.
4. Upload step writes the file to `employee-photos/<employeeId>.jpg`.
   - When the field is used with employee-record persistence enabled, upload defaults to server upload mode (`/api/hr/employees/[employeeId]/photo/upload`) with authenticated HR access checks.
   - Debug mode may force client upload mode for troubleshooting (`?debug=1&photoUploadMode=client`).
5. Client persists `photo_url` and `photo_path` to employee record via `/api/hr/employees/[employeeId]/photo`.
6. UI refreshes and shows latest persisted image.

## Storage path strategy

- Canonical object key: `employee-photos/<employeeId>.jpg`.
- The component computes target path using `buildEmployeePhotoPath(employeeId)`.
- Client strategy selection rules:
  - default persisted flow: server upload primitive;
  - fallback client mode (debug only): prefers `update` when existing photo is known, otherwise probes for existence and selects `upload` or `update`.

## Server persistence path

- Route: `POST /api/hr/employees/[employeeId]/photo`.
- Validates payload shape and house UUID.
- Enforces HR access using `requireHrAccess`.
- Loads current employee profile fields and updates through `updateEmployeeForHouseWithAccess`, preserving existing non-photo fields.
- Returns persisted `photo_url` + `photo_path`.

## Delete cleanup behavior

- Route: `DELETE /api/hr/employees/[employeeId]/photo` clears persisted `photo_url` and `photo_path`.
- Client then removes storage object when `photo_path` exists.
- Employee delete flow (`deleteEmployeeForHouse`) also attempts storage cleanup and falls back to canonical path if `photo_path` is missing.

## Debug / diagnostics behavior

- Debug panel is hidden by default.
- Debug panel is shown only when explicit debug mode is enabled (`?debug=1`).
- Structured phase logs remain available for failures and troubleshooting.

## Employee ID output hardening behavior

- Employee ID list, single-card PDF, and bulk-print PDF now share the same normalized photo URL behavior.
- `photo_url` is treated as usable only when it is a valid `http/https` URL after trimming.
- If URL is missing/blank/invalid, ID output intentionally falls back to the existing PHOTO placeholder area instead of broken image output.
- HR Employee IDs table now shows an explicit output status:
  - `Photo ready` when a usable URL is present and thumbnail is loadable.
  - `Photo unavailable` when URL is invalid or image fetch fails.
  - `No photo` when no URL is stored.
- Single-card preview uses the same PDF route with inline disposition (`disposition=inline`) so operators can confirm output behavior before download.

## Known remaining enhancement

- Background removal is intentionally deferred and not included in this baseline.

## Optional UX polish (non-blocking)

- Added in current hardening pass: HR Employee IDs table now includes lightweight help text on **Output status** clarifying that `Photo unavailable` can mean an invalid, broken, or unreachable image URL.
- Remaining optional follow-up:
  - add a lightweight UI test for image `onError` fallback behavior in Employee IDs page.
