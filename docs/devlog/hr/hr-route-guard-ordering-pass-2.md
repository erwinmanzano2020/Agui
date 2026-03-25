# HR Route Guard Ordering — Pass 2

Date: 2026-03-25

## What was done

Performed a scoped audit of remaining `/api/hr/**` route families and expanded canonical route-entry guard ordering only where safe.

### Route families updated (SAFE)

- `payroll-runs/[id]`
- `payroll-runs/[id]/post`
- `payroll-runs/[id]/adjustments`
- `payroll-runs/[id]/finalize`
- `payroll-runs/[id]/mark-paid`
- `payroll-runs/[id]/pdf`
- `payroll-runs/[id]/payslips/[employeeId]/pdf`

### Mechanical change pattern applied

For the SAFE routes above, replaced inline route-entry sequence with:

- `resolveHrRouteActorContext(...)`
- Canonical entry order: `auth -> entity -> feature`

Preserved route-specific behavior after entry (house resolution, HR access checks, business/domain validation, mutation/state rules).

## Tests added / expanded

Added drift tests to enforce entry-guard ordering and unauthenticated behavior (including assertion that feature guard is not called when auth fails) for updated families:

- `payroll-runs/:id` (GET)
- `payroll-runs/:id/post` (POST)
- `payroll-runs/:id/pdf` (GET)
- `payroll-runs/:id/payslips/:employeeId/pdf` (GET)

## What was NOT changed

- Identity model or identity source behavior
- Tenancy model (house/domain boundaries)
- House resolution timing and implementation
- HR business-access logic and branch restrictions
- Domain validation and mutation/state-machine rules
- Response envelope standardization across modules

## Exceptions (EXCEPTION)

These route families were intentionally not changed in Pass 2:

- `/api/hr/kiosk/ping`
- `/api/hr/kiosk/scan`
- `/api/hr/kiosk/sync`
- `/api/hr/kiosk/verify`
- `/api/hr/kiosk-devices`
- `/api/hr/kiosk-devices/[id]/enable`
- `/api/hr/kiosk-devices/[id]/disable`
- `/api/hr/kiosk-devices/[id]/rotate-token`
- `/api/hr/kiosk-devices/[id]/events`

Reason: device/kiosk/terminal-oriented flows with non-standard identity entry assumptions; outside safe helper adoption scope.

## Deferred (PARTIAL)

The following were audited but left unchanged due to mixed/specialized access entry behavior:

- `/api/hr/employee-ids/print`
- `/api/hr/employees/[employeeId]/id-card.pdf`
- `/api/hr/employees/[employeeId]/photo`
- `/api/hr/employees/[employeeId]/photo/upload`

These may be revisited in a later pass with explicit route-family design decisions.
