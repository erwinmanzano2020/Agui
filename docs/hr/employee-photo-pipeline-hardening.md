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

## Known remaining enhancement

- Background removal is intentionally deferred and not included in this baseline.
