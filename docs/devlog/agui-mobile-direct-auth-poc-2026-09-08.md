# Agui Mobile Direct Staff Auth POC — 2026-09-08

## Authorization / phase alignment

This is a bounded **shared-foundation POC** under the owner-approved Agui Mobile direction. It does not introduce an Operations business rule, change accounting behavior, migrate the backend away from Apps Script / Google Sheets, or reinterpret the frozen POS operator-auth contract.

POS remains the active roadmap phase. The direct mobile staff session described here is platform/shared-entry infrastructure only. No POS PIN contract is repurposed by this work.

## Existing VVS runtime model being preserved

The current VVS Sheets / Apps Script runtime already separates device and staff-session concepts:

- `Device Registry` contains company/personal device metadata, branch/station defaults, allowed roles, whether a device is shared, whether Staff PIN is required, and active state.
- `V2 Staff Sessions` records the employee actually using a device, role used, branch/station, active/closed state, related cashier shift, `PIN Verified?`, and session provenance such as `PIN LOGIN`.
- `Employee Masterlist` already records Employee ID and PIN status without making POS own staff identity.

Therefore Agui Mobile direct entry must reuse that shared-device / Staff PIN / staff-session model rather than treating the POS PIN as a global Agui password.

## Implemented in this POC

### Direct entry UI

`/mini` now contains a real direct-sign-in surface:

1. enter/check Agui Device ID;
2. enter Employee ID;
3. enter Staff PIN;
4. if the server and upstream both verify the request, show the active direct staff-session identity.

Only Device ID may be remembered in browser `localStorage`. Staff PIN is never persisted in browser storage.

### Fail-closed server boundary

Four additive Next.js API endpoints now exist:

- `POST /api/miniapp/direct/context`
- `POST /api/miniapp/direct/login`
- `POST /api/miniapp/direct/session`
- `POST /api/miniapp/direct/logout`

They are public only at the Supabase middleware layer. Their own server boundary remains fail-closed.

Direct upstream calls are disabled unless:

- `AGUI_MOBILE_DIRECT_AUTH_POC=enabled`, and
- the existing Apps Script web-app URL + proxy secret are configured.

A successful login also requires `AGUI_MOBILE_SESSION_SECRET` with at least 32 characters before Agui will issue a signed HttpOnly browser session cookie.

### Proposed additive Apps Script actions

The Next.js POC expects these new upstream action names:

- `MOBILE_DIRECT_CONTEXT`
- `MOBILE_DIRECT_LOGIN`
- `MOBILE_DIRECT_SESSION`
- `MOBILE_DIRECT_LOGOUT`

These action handlers are **not implemented by this repository commit**. The feature gate must remain disabled until the current Apps Script engine implements and verifies those contracts.

## Required upstream verification contract

### `MOBILE_DIRECT_CONTEXT`

Must resolve only an active authorized company/shared device and return limited context. The direct POC requires:

- exact requested Device ID;
- `ownership = COMPANY`;
- `sharedDevice = true`;
- `requiresStaffPin = true`;
- `active = true`;
- explicit `loginEnabled = true`.

Device ID is routing/context, **not a secret and not proof of employee identity**.

### `MOBILE_DIRECT_LOGIN`

Apps Script must verify the existing VVS Staff PIN against the requested employee and device context, enforce the existing employee/device/role/branch rules, apply rate limiting/lockout appropriate to the current runtime, and create/reuse the canonical `V2 Staff Sessions` record.

The Next.js boundary accepts success only when all are true:

- returned Device ID matches request;
- returned Employee ID matches request;
- session type is `SHARED DEVICE`;
- session status is `ACTIVE`;
- `pinVerified = true`.

Authentication denials are collapsed to a generic outward `Invalid staff sign-in` response to avoid employee/PIN enumeration.

### `MOBILE_DIRECT_SESSION`

Every browser-session recheck must validate the signed cookie anchors (`sessionId`, `deviceId`, `employeeId`) against a still-active upstream V2 Staff Session. The cookie by itself is not authorization to read or mutate operational data.

### `MOBILE_DIRECT_LOGOUT`

Must close/end the canonical upstream shared-device staff session. The browser cookie is cleared even when upstream closure cannot be confirmed; the UI explicitly reports that incomplete closure instead of pretending it succeeded.

## Browser session cookie

The POC cookie:

- is HttpOnly;
- is SameSite=Lax;
- is Secure in production;
- contains only signed session/device/employee anchors plus issue/expiry timestamps;
- contains no Staff PIN, role, branch, station, cash, customer, or business data;
- defaults to a 12-hour maximum age, bounded to 15 minutes–24 hours by server configuration;
- must be revalidated through `MOBILE_DIRECT_SESSION` before it is treated as an active staff identity.

## Deliberately still not unlocked

This POC does **not** make any new operational workflow live.

- Start / Resume Shift remains `NEXT` with no route.
- End Shift remains Telegram-only and continues to require signed Telegram `initData` at its current server boundary.
- Customer Utang, Bayad Utang, Cash Out, Cash Transfer, and Cash Drop remain planned only.
- No Supabase schema, migration, RLS, finance, inventory, cash, or closing contract changes are included.

## Verification added

Pure tests cover:

- Device ID / Employee ID / Staff PIN input normalization;
- strict shared-company-device context acceptance;
- exact device/employee matching and `pinVerified + ACTIVE` login acceptance;
- signed staff-session token round-trip, tamper rejection, and expiry rejection.

Repository lint/typecheck/build/full tests still need to run in an environment with the project dependencies available before this draft POC can be considered merge-ready.
