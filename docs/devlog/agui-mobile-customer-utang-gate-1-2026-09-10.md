# Agui Mobile M4 — Customer Utang Gate 1

## Scope and authority

This Gate 1 slice adds a read-only Customer Utang context and local preview to the existing `/mini` shell. Apps Script and Google Sheets remain the authoritative operational engine. The Next.js route is an authenticated proxy only; it does not query or write operational tables.

No `CUSTOMER_UTANG_SUBMIT` action, submit API, posting handler, migration, RPC, accounting change, A/R mutation, POS mutation, custody mutation, Finance mutation, or Telegram business-semantic change is included.

## Context request

`POST /api/miniapp/cashier/customer-utang/context` accepts `{ initData?: string }`. Signed Telegram `initData` is used when present. Otherwise, the existing signed HttpOnly Direct staff-session cookie is required. The proxy sends the existing Apps Script web-app endpoint:

```json
{
  "proxySecret": "<server-only secret>",
  "action": "CUSTOMER_UTANG_CONTEXT",
  "authMode": "DIRECT | TELEGRAM",
  "directSession": "<Direct session identity, Direct only>",
  "initData": "<signed Telegram initData, Telegram only>"
}
```

The URL also carries `channel=miniapp`; both request and response use `Cache-Control: no-store` behavior.

## Exact successful response contract

```ts
{
  ok: true;
  action: "CUSTOMER_UTANG_CONTEXT";
  mode: "DUAL_ENTRY_CUSTOMER_UTANG_POC";
  authMode: "DIRECT" | "TELEGRAM"; // asserted by the proxy from resolved entry auth
  actor: {
    employeeId: string;
    employeeName: string;
    role: string;
    capabilities: string[];
  };
  branch: { code: string; label: string };
  shift: {
    shiftId: string;
    status: "OPEN";
    businessDate: string; // current canonical business date
    station: string;
    cashBoxLabel: string;
  };
  customers: Array<{
    customerId: string;
    officialName: string;
    collectionTerms: string;
    defaultDueDays: number;
    dueDate: string; // derived upstream; not cashier-editable
    currentAR: number | null; // null when the safe read model has no value
  }>;
  stateFingerprint: string;
  operationalWritesExpected: false;
}
```

The proxy rejects malformed successful payloads, a non-`OPEN` shift, the wrong action/mode, a missing fingerprint, malformed customer data, or any response where `operationalWritesExpected` is not exactly `false`. Apps Script remains responsible for canonical employee/device/session verification, permission and branch enforcement, current-business-day shift validation, active-customer filtering, due-date derivation, and deterministic fingerprint generation.

An upstream stale previous-day shift failure must use `STALE_PREVIOUS_DAY_SHIFT` (as its `code` or `state`; legacy `STALE_SHIFT` is also presented safely). The screen gives this an explicit recovery-required state rather than treating it as a current shift.

## UI and no-write boundary

The screen loads context once. Customer search and selection, amount, sale reference, and note changes are client-local and issue no additional requests. Collection terms and due days are displayed only. The disabled Gate 1 control cannot post a transaction, and no submit route exists.

The paper instruction preserves the live sequence: after a future successful post generates an AGUI Ref, staff copy that reference to the matching logbook/credit slip and complete/sign the paper. There is no pre-submit paper checkbox. Missing customers are directed to the existing Customer Request / Telegram fallback, without implying automatic credit approval.

## Runtime UAT / no-write checklist

1. Configure the existing Direct auth and Apps Script proxy environment variables and ensure Apps Script supports `CUSTOMER_UTANG_CONTEXT` in `DUAL_ENTRY_CUSTOMER_UTANG_POC` mode.
2. Open `/mini`, authenticate Direct, then open `/mini/cashier/customer-utang`. Repeat from authenticated Telegram entry.
3. Confirm BJ / P3 and the active OPEN shift/cash box appear; verify KR RESTAURANT uses its configured terms/due behavior and JEMPH shows CASH with due-today/default zero from Apps Script.
4. Search by customer name and ID, then edit every local field while confirming the Network panel shows no additional context request.
5. Exercise missing/expired Direct session, employee/device mismatch, permission denial, wrong branch, no-open-shift, and stale-previous-day-shift responses. Confirm all fail closed and stale shift presents recovery guidance.
6. Compare before/after row counts and content for `V2 Event Ledger`, `V2 Customer Balance Events`, `Transaction Journal`, and `Cashier Shift`. They must be unchanged.

## Known validation boundary

This repository does not contain the authoritative Apps Script / Sheets engine or live sheet fixtures. Consequently, the deployed action, real KR RESTAURANT/JEMPH configuration, and sheet before/after assertion require runtime UAT against the owner-controlled Apps Script deployment. No mismatch between older documentation and repository behavior was discovered during local implementation; live behavior was not accessible from this repository alone.
