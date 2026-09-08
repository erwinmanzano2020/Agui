# Agui Mobile Foundation — 2026-09-08

## Authorization / phase alignment

This POC is explicitly limited to **shared foundation work** authorized for the current Agui Mobile direction. Operations remains a later governed phase under the root roadmap rules. This change does **not** implement a new Operations business rule, accounting rule, data model, schema, RPC, or production workflow.

## Goal

Create one mobile-first Agui shell that can eventually be entered through either:

1. Telegram Mini App signed `initData`, or
2. direct Agui browser/PWA staff authentication.

Both entry paths are intended to converge on the same authorized employee context before operational data is exposed or changed.

## Implemented in this slice

- Added `/mini` as the Agui Mobile workspace shell.
- Reused the existing cashier action map instead of creating separate mini apps per flow.
- Added launch-mode detection (`telegram` vs `direct`).
- Preserved `/mini/cashier/closing` as the only currently live cashier action.
- Marked End Shift as Telegram-only until direct server-side staff authentication exists.
- Added a direct-browser gate describing the intended known-device → employee → PIN path without pretending that authentication already exists.
- Added a shared mobile shell component and mobile-first action grid.
- Added pure tests for launch-mode classification and action availability.
- Added exact `/mini` to the middleware public-path list. This is only a Supabase-session-layer exception: `/mini` exposes static workflow labels/status only and performs no operational read/write. Existing closing APIs retain signed Telegram verification.

## Deliberately not implemented

- No direct employee/PIN authentication endpoint.
- No device trust or direct Agui staff-session cookie/token.
- No Start / Resume Shift implementation.
- No Customer Utang, Bayad Utang, Cash Out, Cash Transfer, or Cash Drop migration.
- No change to the working End Shift Apps Script contract.
- No Supabase schema/RLS/database migration.
- No widening of branch/house data access.

## Security / tenancy review

- The new `/mini` page contains no tenant, branch, employee, shift, cash, or customer data from the backend.
- A direct browser session cannot open the currently live End Shift action because that route still requires Telegram signed `initData` at its API boundary.
- The middleware exception is exact `/mini`; it does not make future `/mini/**` routes public by default.
- Future direct authentication must enforce canonical identity, tenant/house ownership, branch scope where applicable, and permission checks server-side before any operational context is returned.

## Next shared-foundation slice

Define the direct staff-auth contract for a recognized device + employee + PIN, including server-side session issuance and explicit authorization boundaries. Only after that contract is approved should `/mini/cashier/start` become a live dual-entry operational route.
