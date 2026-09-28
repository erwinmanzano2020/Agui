# GAP-024 Remaining Gate B Completion Planning

**Planning phase only. No runtime/product behavior, database mutation, merge, or deployment is implemented by this document.**

## 0. Planning identity and durable baseline

- Project: **Agui**
- Repository: `erwinmanzano2020/Agui`
- Active system phase: **HR System — end-to-end MVP / Foundation Security Correction**
- Active GAP-024 sequence: **Gate A → Gate B → Gate C → Gate D → Gate E**
- Current bounded target: **Remaining Gate B**
- Original planning base: `develop` at
  `a95c3c921e067297f4f033620fe2f4ede7e7c5aa`
  (Historical Daily DTR Write P1 squash merge, PR #514)
- Original planning PR: **#515 — Plan GAP-024 Remaining Gate B completion**,
  owner-approved and squash-merged to `develop` as
  `908e36eb1861f3ba76426927f0968ed0caf0fdcb`.
- Current planning re-entry base: `develop @ 908e36eb1861f3ba76426927f0968ed0caf0fdcb`.
- Current planning amendment branch:
  `codex/amend-gap-024-remaining-gate-b-planning`.
- Planning amendment PR **#517 — Amend GAP-024 Remaining Gate B planning for kiosk reject identity** was explicitly owner-approved and squash-merged to `develop` as `8fe979729d79bba806ba28b89b851baeee450258`.
- Runtime artifact **PR #516 — Implement GAP-024 Remaining Gate B closure** is resumed, Draft/unmerged, and reconciled with the approved amendment via merge commit `425c8df8f756b352f1e40acf591314e2cebe4c3a`.
- Production application: Vercel `agui-nine.vercel.app`, currently serving exact commit
  `a95c3c921e067297f4f033620fe2f4ede7e7c5aa`
- Production backend: Supabase project `rytrmtsteojboqmrimdb`
- Canonical governing implementation approval:
  `docs/devlog/gap-024-daily-dtr-branch-enforcement-implementation-approval.md`
- Predecessor planning:
  `docs/devlog/gap-024-gate-b-pre-p1-containment-plan.md`
- Historical P1 planning:
  `docs/devlog/historical-daily-dtr-write-p1-implementation-plan.md`

The durable governance order already authorizes Remaining Gate B as the third Gate-B
sub-slice after:

1. Gate-B pre-P1 raw-mutator containment foundation — released;
2. Historical Daily DTR Write P1 — released and Production-verified;
3. Remaining Gate B — current planning target.

Historical note: the original Remaining-Gate-B planning pass began with no open planning
PR and converged in PR #515. That plan was owner-approved and merged. Runtime PR #516
subsequently discovered one bounded planning-contract omission and correctly returned to
Planning instead of silently widening Runtime scope. This document is now the durable
planning amendment for that re-entry.

## 1. Objective

Close the owner-approved **Remaining Gate B** obligation by proving, against the exact
post-P1 system, that canonical attendance authority is complete, deterministic,
non-bypassable, producer-compatible, replay/idempotency-safe, and ready for the later
Gate C read cutover.

This is a **verification + bounded privilege-hardening closure slice**.

Current repository and Production evidence already show the pre-P1 containment runtime
performed the canonical bootstrap/backfill and producer migration. Fresh Production
privilege audit during this planning run, however, found one remaining approved Gate-B
containment gap: `service_role` still has direct table privileges over several Gate-A
canonical authority tables because the original Gate-A migration revoked those tables
from PUBLIC/anon/authenticated but did not revoke `service_role`.

That is not a new business-policy choice. The already-approved Gate-B contract says raw
canonical tables are deny-direct and that `service_role` must not remain a generic
attendance mutation principal. Therefore Remaining Gate B must include two bounded forward migrations plus the kiosk
adapter changes and closure verification.

No data model, attendance semantics, attribution rule, or user-facing workflow is changed
by the planned closure. If Runtime proof exposes any additional producer/runtime/schema
defect beyond the frozen closure, execution must stop and return to planning rather than
silently broadening the slice.

That stop condition fired in Runtime PR #516. The additive support-event RPC correctly
validates that any supplied employee belongs to the device-derived House, while the
released kiosk service historically attached the QR-claimed employee ID to
`house_mismatch` and `employee_not_found` reject events before same-House employee
verification. The Runtime branch therefore needs a narrowly bounded `service.ts`
adaptation so unverified claims do not become authoritative event identity.

## 2. Business / security outcome

After the future Remaining Gate-B verification Runtime converges:

- every active attendance producer at the exact implementation head has a durable
  disposition;
- every producer that can change attendance truth is command-compatible or proven
  database-disjoint;
- every active compatibility row remains canonically bridged, without freezing the
  planning-time row count as a business invariant;
- deterministic projection rebuild reproduces the same authorization state;
- retries/replays cannot duplicate or diverge canonical attendance;
- P1 correction/remediation is included in the producer compatibility proof;
- invalid or insufficient provenance remains fail-closed;
- no application principal can create raw-only or projection-invisible attendance;
- `service_role` has no direct canonical-table mutation path and cannot invoke the
  projection rebuild as an application mutation primitive;
- the kiosk wrapper remains the only service-role **attendance-truth** mutation
  entrypoint;
- service-role kiosk support writes are database-bounded to non-provenance event classes
  and telemetry-only device fields;
- Gate C prerequisites are either durably proven or the gate remains blocked with a
  concrete named gap.

The slice does not itself perform Gate C.

## 3. Confirmed requirement

The owner-approved GAP-024 implementation approval freezes Remaining Gate B as:

> complete deterministic backfill/rebuild, replay/idempotency, later cutover preparation,
> and producer work only for writers already command-compatible or provably
> database-disjoint from P1-covered state.

Gate C may begin only after evidence proves:

- Gate-A protected readers exist;
- canonical authority/projection state is populated and rebuildable;
- Historical Daily DTR Write P1 is compatible and verified;
- every required active producer continuously maintains canonical state;
- newly committed legitimate attendance is immediately canonically readable;
- invalid/ambiguous writes fail closed; and
- no known producer can create raw-only or projection-invisible attendance.

No new product/business policy is required to state this slice.

## 4. Current Production baseline

Read-only Production verification at planning start shows:

- `dtr_segments`: **96 total / 96 canonically linked**;
- canonical facts: **96 total**;
- fact revisions: **96**;
- canonical observations: **33**;
- canonical evidence rows: **33**;
- evidence frames: **113**;
- fact/evidence memberships: **33**;
- authorization projection: **96**;
- authorization history: **113**;
- active facts missing projection: **0**;
- unbridged compatibility segments: **0**;
- current projection:
  - **17 ATTRIBUTED**;
  - **79 UNATTRIBUTED**;
  - **0 CONFLICT**;
- compatibility source:
  - **59 manual**, all linked;
  - **37 system**, all linked;
- canonical kiosk evidence:
  - **17 LOGICAL_IN**;
  - **16 LOGICAL_OUT**;
- P1 correction/remediation cases in Production: **0 / 0**;
- mutation-operation ledger rows in Production: **0**.

Fresh privilege audit additionally found the current Remaining Gate-B blocker:

- `authenticated` has no direct DML on canonical attendance authority tables;
- `service_role` still has direct SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER
  privileges on:
  - `hr_attendance_facts`;
  - `hr_attendance_fact_revisions`;
  - `hr_attendance_observations`;
  - `hr_attendance_evidence`;
  - `hr_attendance_evidence_frames`;
  - `hr_attendance_fact_evidence`;
  - `hr_attendance_employee_generations`;
  - `hr_attendance_authorization_projection`;
- `service_role` also still has EXECUTE on
  `hr_rebuild_attendance_authorization_projection(uuid)`;
- P1 case/event tables, mutation-operation ledger, and authorization history are already
  deny-direct to `service_role`;
- the approved kiosk wrapper remains service-role executable as intended.

This privilege posture is why Remaining Gate B cannot close as verification-only.

The 79 UNATTRIBUTED facts are not by themselves a defect. GAP-025 intentionally requires
insufficient historical provenance to remain fail-closed rather than fabricated from
current employee/device/schedule context.

The empty Production operation ledger means live Production has not yet supplied
post-release replay/idempotency evidence. This slice must not manufacture Production
attendance merely to populate it; deterministic proof belongs in the disposable
integration harness.

## 5. Released architecture to preserve

### 5.1 Canonical authority

Gate A remains authoritative for:

- attendance facts;
- immutable value revisions;
- observations;
- evidence and semantic evidence lineage;
- evidence frames/membership;
- employee candidate/evidence generation;
- authorization projection and history;
- protected branch-scoped and house-global readers.

### 5.2 Mutation authority

Gate B/P1 currently expose bounded producer commands:

- manual/admin same-day create:
  `hr_create_manual_attendance` — authenticated;
- kiosk scan:
  `hr_apply_kiosk_attendance_scan` — service_role;
- bulk day replacement:
  `hr_replace_bulk_attendance_day` — authenticated;
- maintenance timezone repair:
  `hr_apply_attendance_time_repair` — not executable by normal application roles;
- P1 correction proposal/finalization:
  `hr_propose_attendance_correction`,
  `hr_finalize_attendance_correction` — authenticated;
- P1 historical remediation open/adjudicate/finalize:
  `hr_open_attendance_remediation_case`,
  `hr_adjudicate_attendance_remediation_case`,
  `hr_finalize_attendance_remediation_case` — authenticated.

The shared internal producer engine and P1 finalization helpers remain private.

Raw INSERT/UPDATE/DELETE authority over `dtr_segments` and `dtr_entries` is already
revoked from `authenticated` and `service_role`.

The **remaining database-principal gap** is direct `service_role` authority on the
Gate-A canonical tables listed in Section 4 plus direct EXECUTE on the projection rebuild.
That authority must be cut off in this slice while preserving:

- `hr_apply_kiosk_attendance_scan` as the only ordinary service-role attendance
  mutation wrapper;
- protected canonical read RPCs as read-only interfaces where still needed;
- database-owner / migration-owner authority as explicit break-glass infrastructure.

### 5.3 Exact-head producer inventory at planning baseline

The first planning audit found the following live mutation-related surfaces on
`a95c3c921e067297f4f033620fe2f4ede7e7c5aa`. Runtime must re-run the inventory because
this table is evidence, not a permanent allowlist.

| Surface | Exact-head path | Current disposition |
|---|---|---|
| Daily DTR same-day manual create | `src/app/company/[slug]/hr/dtr/actions.ts` → `src/lib/hr/dtr-segments-server.ts` | authenticated canonical command `hr_create_manual_attendance` |
| Daily DTR historical correction | `actions.ts` → `attendance-p1-server.ts` | P1 proposal/finalization commands |
| Daily DTR historical missing-attendance review | `actions.ts` → `attendance-p1-server.ts` | P1 open/adjudicate/finalize commands |
| Kiosk online/offline attendance | `src/lib/hr/kiosk/service.ts` → `repository.ts` | device-authenticated service path → `hr_apply_kiosk_attendance_scan` |
| Kiosk support/event writes | `src/lib/hr/kiosk/repository.ts` plus the kiosk command | **coupled supporting state, not database-disjoint**: current raw table access is too broad; Runtime must move service-side auxiliary events + device telemetry to narrow RPCs, reserve `scan/clock_in/clock_out` to the canonical kiosk command, and revoke raw event/device mutation from service_role |
| Bulk DTR replacement | `src/app/api/payroll/dtr-bulk/route.ts` | authenticated `hr_replace_bulk_attendance_day` |
| Timezone repair | `scripts/fix-dtr-timezone.ts` | emits private maintenance command calls; no raw DTR UPDATE |
| Legacy `payroll/dtr-today` browser writer | `src/app/payroll/dtr-today/page.client.tsx` | retired as writer / preview-only |
| Legacy `payroll/dtr-bulk/page2.tsx` | absent | retired |
| Payroll/payslip/overtime DTR access | payroll preview/run/payslip/overtime server paths | current **read** consumers only; later Gate D, not Gate-B writer blockers |

Runtime inventory must also search for raw SQL, PostgREST, RPC, scripts, background jobs,
admin utilities, service-role clients, and newly added routes rather than relying only on
the known paths above.

### 5.4 Compatibility state

`dtr_segments` remains a compatibility projection/bridge during staged Gate C/D work.
`dtr_entries` remains a legacy compatibility/read surface where retained by current
consumers.

Neither is allowed to become a second attendance source of truth.

## 6. In-scope behavior

The future Remaining Gate-B Runtime may change only:

- two ordered forward migrations: additive kiosk support wrappers, then final privilege
  cutover;
- `agui-starter/src/lib/hr/kiosk/repository.ts` to replace raw supporting writes with
  the new narrow RPCs;
- `agui-starter/src/lib/hr/kiosk/http.ts` to move ping telemetry to the same wrapper;
- `agui-starter/src/lib/hr/kiosk/service.ts` only to preserve reject-event audit writes
  under the new same-House employee validation rule;
- the directly corresponding kiosk repository/service/HTTP tests;
- generated database contract types for the two new RPCs;
- bounded static/integration verification;
- the closure CI workflow/helper;
- governance evidence.

It must:

1. re-inventory every active attendance writer at the exact Runtime head;
2. classify each as:
   - canonical command producer;
   - P1 correction/remediation producer;
   - coupled supporting/provenance writer with an explicitly frozen ownership boundary;
   - genuinely database-disjoint auxiliary writer; or
   - blocker;
3. run the complete scoped Gate-A + Gate-B + P1 migration chain on a disposable database;
4. prove deterministic bootstrap/backfill on representative pre-cutover legacy
   manual/system fixtures, then prove post-cutover rebuild/replay idempotency;
5. prove projection rebuild determinism from the resulting durable authority;
6. prove all command producers immediately leave canonical facts/revisions/frames and
   projection coherent;
7. prove replay/same-operation retry returns one logical result;
8. prove same-operation/different-input fails closed;
9. prove multi-session races do not produce raw-only, duplicate, or stale-visible facts;
10. prove P1 correction/remediation preserves the same canonical/projection invariants;
11. add the bounded privilege-cutover migration and prove direct
    `service_role` canonical-table access is removed;
12. prove `service_role` cannot call the projection rebuild directly while the kiosk
    wrapper still works;
13. prove current direct table/RPC grants otherwise prevent mutation bypass;
14. prove canonical branch/global readers observe only their approved state;
15. compare read-only Production counts/grants/migration history before closure;
16. record an explicit Remaining Gate-B completion/blocked verdict.

## 7. Explicit out of scope

This slice does **not** authorize:

- Gate C Daily DTR read cutover;
- removal of the current compatibility-segment display from Daily DTR;
- Gate D migration of payroll preview, payroll runs, payslips, overtime, browser,
  kiosk/bulk readers, services, admin/background reads, or repair read paths;
- Gate E final broad raw/base-read retirement;
- new attendance attribution semantics;
- backfilling UNATTRIBUTED facts from current employee branch, current device branch,
  schedule, viewer, request branch, or source label;
- HR-4 approval workflow implementation;
- payroll calculation changes;
- schedule/roster behavior changes;
- employee identity changes;
- GAP-026 implementation;
- POS, Operations, Finance, Telegram, native/offline product expansion;
- synthetic Production attendance writes for verification;
- a new canonical table, authoritative store, or feature flag;
- any data-shape/business-semantic migration;
- any migration beyond the two bounded Remaining-Gate-B migrations unless planning is
  reopened.

## 8. Existing contracts consumed

### Manual/admin

Request authority remains House-first and branch-restricted. Explicit actual branch is
required for established manual provenance. Current-day ordinary create uses
`hr_create_manual_attendance`. Historical existing facts use P1 correction; historical
missing attendance uses owner/manager remediation.

### Kiosk

The service derives device House/branch from the authenticated device, uses stable
`clientId` / offline `clientEventId` as operation identity, and calls
`hr_apply_kiosk_attendance_scan`. Exact retries must be idempotent.

Reject-event identity is now explicitly frozen: `employee_id` may be supplied to the
support-event writer only after the employee has been resolved and verified inside the
device-derived House. A QR claim that fails House matching or resolves to no same-House
employee is non-authoritative input, so the reject event must use `employee_id = null`.
The claimed employee identifier may be retained only as audit metadata
(`claimedEmployeeId`) and must never be treated as established employee identity,
authorization, attendance provenance, or a branch-attribution input.

The service-side `hr_kiosk_events` writer is not an alternate attendance-fact writer,
but it is **not database-disjoint** because the kiosk command reads provenance-bearing
event classes for debounce and the released cutover used those classes for historical
proof. Its safe boundary is event-type ownership: command-owned
`scan/clock_in/clock_out` versus service-side `reject/sync_success/sync_fail`.
Device timestamp updates remain telemetry.

### Bulk

The authenticated bulk API requires stable per-result operation identities and calls
`hr_replace_bulk_attendance_day`. It may not raw-delete/reinsert `dtr_segments` or
`dtr_entries`.

### Repair

The timezone repair script emits calls to the canonical maintenance command and performs
no raw DTR UPDATE.

### P1 correction/remediation

P1 cases/events are immutable/append-only audit authority. P1 finalization may change
canonical fact value/evidence state only through the released P1 finalization engine.
Distinct-new remediation remains fail-closed while the approved HR-4 dependency is
unavailable.

## 9. New / changed backend contract

Two ordered forward migrations and one internal adapter change are planned.

Runtime must create both migrations through the repository's normal Supabase migration
creation flow; this plan freezes purpose/name stems, not fabricated timestamps:

1. `gap024_remaining_gate_b_kiosk_support_wrappers`
2. `gap024_remaining_gate_b_privilege_cutover`

### 9.1 Migration 1 — additive kiosk support wrappers

This migration is backward-compatible with the currently deployed application and must
**not revoke the old raw grants yet**.

It adds:

1. exactly one
   `public.hr_record_kiosk_support_event(uuid,uuid,text,timestamptz,jsonb)`
   overload, logically
   `(device_id, employee_id, event_type, occurred_at, metadata) RETURNS void`, as a
   narrow SECURITY DEFINER service-role auxiliary-event wrapper that:
   - accepts only `reject`, `sync_success`, and `sync_fail`;
   - rejects `scan`, `clock_in`, `clock_out`, and unused `queued`;
   - re-reads `device_id` and derives House + branch from that trusted database row
     rather than accepting caller-supplied House/branch;
   - does **not** add a second activity-state authorization decision after the request has
     already crossed the existing kiosk authentication / canonical scan boundary;
   - validates an optional employee belongs to the derived House when supplied;
   - inserts the auxiliary event using the derived House/branch;
   - updates only that device's `last_event_at` to the supplied event occurrence time,
     preserving current monitoring semantics;
   - uses fixed `search_path`;
   - revokes EXECUTE from PUBLIC/anon/authenticated and grants only service_role;
2. exactly one `public.hr_touch_kiosk_device_telemetry(uuid) RETURNS void` overload,
   logically `(device_id)`, as a narrow SECURITY DEFINER service-role device-touch
   wrapper that:
   - accepts the existing device identity;
   - requires the device row to exist;
   - updates only `last_seen_at`;
   - cannot alter House, branch, token, activation, name, or other identity/authority
     fields;
   - uses fixed `search_path`;
   - revokes EXECUTE from PUBLIC/anon/authenticated and grants only service_role;
3. explicit comments/contract metadata and `NOTIFY pgrst, 'reload schema'`.

It performs no attendance data rewrite and no privilege revocation required by migration
2.

### 9.2 Application adapter between migrations

`agui-starter/src/lib/hr/kiosk/repository.ts` changes only its supporting writes:

- `touchDevice` calls the new telemetry wrapper instead of raw device UPDATE;
- `insertKioskEvent` calls the new auxiliary-event wrapper instead of raw event INSERT +
  device UPDATE;
- device token-hash lookup remains the existing direct SELECT;
- canonical attendance scan remains `hr_apply_kiosk_attendance_scan`;
- no user-visible kiosk semantics or event labels change.

`agui-starter/src/lib/hr/kiosk/http.ts` must also move the kiosk **ping**
`last_seen_at` raw UPDATE to the same telemetry wrapper. The authenticated kiosk-device
admin helper remains unchanged because it uses the authenticated session + existing
owner/manager RLS for legitimate create/enable/disable/token-rotation operations.

`agui-starter/src/lib/hr/kiosk/service.ts` has one additional bounded responsibility
required by the wrapper contract:

- for `house_mismatch` and `employee_not_found`, pass `employeeId: null` to the
  support-event adapter because no same-House employee identity has been established;
- preserve the QR-claimed identifier only in non-authoritative
  `metadata.claimedEmployeeId` for audit/debugging;
- once same-House employee resolution succeeds, existing verified employee IDs continue
  to be used for later reject/sync support events;
- no response status, scan decision, session behavior, event label, or attendance
  mutation semantics change.

Generated DB types and focused repository/service/HTTP tests must cover both new RPCs and
the unverified-claim reject-event rule.

### 9.3 Migration 2 — final privilege cutover

Only after the exact new application artifact is verified against migration 1 may the
final migration close the old raw paths.

Its contract is:

1. re-audit exact-head direct canonical-table, kiosk-event, and kiosk-device dependencies;
2. `REVOKE ALL` direct table privileges from `service_role` on the Gate-A canonical
   authority tables listed in Section 4;
3. selectively re-grant **SELECT only** on a canonical table only if exact-head evidence
   proves a required service-backed read that cannot use an approved protected reader;
   expected default: **no direct canonical-table grant**;
4. repeat/retain deny-direct posture for PUBLIC/anon/authenticated;
5. revoke service-role EXECUTE on
   `hr_rebuild_attendance_authorization_projection(uuid)`;
6. revoke leftover service-role EXECUTE on private Gate-A trigger/guard helpers that are
   not approved service entrypoints;
7. preserve service-role EXECUTE on the canonical kiosk scan and the two new support
   wrappers;
8. harden `hr_kiosk_events`:
   - authenticated keeps approved SELECT but loses INSERT/UPDATE/DELETE;
   - drop authenticated event-write RLS policies;
   - service_role loses direct table access unless exact-head proof justifies SELECT;
   - command-owned `scan/clock_in/clock_out` remain database-owned;
9. harden `hr_kiosk_devices` for service_role:
   - preserve direct SELECT required for token-hash lookup;
   - revoke INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER;
   - preserve authenticated owner/manager device administration;
10. preserve protected canonical read RPC behavior; this is not Gate-D/E read retirement;
11. `NOTIFY pgrst, 'reload schema'`;
12. perform no attendance data rewrite.

Expected post-cutover entrypoints:

- authenticated attendance mutation: manual create, bulk replacement, P1
  correction/remediation;
- authenticated kiosk administration: owner/manager device CRUD + event read-only;
- service-role attendance mutation: kiosk scan only;
- service-role supporting writes: auxiliary-event wrapper + telemetry-touch wrapper only;
- database owner / controlled admin boundary: repair/private internals.

If exact-head proof finds another direct producer dependency or a schema/business semantic
change is required, stop and return to planning.

## 10. Data / store impact

### Authoritative operational state

No new authoritative **data** state is planned.

Existing canonical attendance tables and P1 case/event tables remain authoritative.
Remaining Gate B changes only which application database principals may directly access
that authority.

### Convenience / compatibility state

`dtr_segments` and `dtr_entries` remain compatibility surfaces. Their existing
bridging/atomic compatibility behavior must be verified, not redefined.

### Supporting operational / audit / telemetry state

`hr_attendance_mutation_operations` remains the durable operation-idempotency ledger.
`hr_kiosk_events` is **supporting operational/provenance state**, not canonical
attendance truth and not merely inert telemetry:

- the released kiosk command writes command-owned `scan`, `clock_in`, and
  `clock_out` rows;
- kiosk debounce reads prior `clock_in`/`clock_out` events;
- the released legacy reconcile cutover used exact `clock_in`/`clock_out` event,
  device, branch, source-identity, and timestamp proof to establish historical kiosk
  provenance;
- current service-side auxiliary calls to `insertKioskEvent` emit only
  `reject`, `sync_success`, and `sync_fail`, plus device telemetry updates.

Therefore the service-side event writer cannot be classified as “database-disjoint.”
Remaining Gate B must enforce **event-type ownership in the database**, not only in
TypeScript: no application path outside the canonical kiosk command may emit command-owned
`scan/clock_in/clock_out` rows or otherwise create provenance that can alter debounce /
historical-proof semantics.

Current Production also gives authenticated owner/manager policies raw event
INSERT/UPDATE/DELETE. Exact-head application evidence shows admin monitoring reads events
but does not need raw event mutation, so the event write policies/privileges are removed
while read access remains.

For the two pre-verification reject classes `house_mismatch` and
`employee_not_found`, the persisted audit identity representation changes in one bounded
way: the unverified QR claim is no longer written to authoritative
`hr_kiosk_events.employee_id`; that field is null, while the claim may be retained only
as non-authoritative `metadata.claimedEmployeeId`. This does not establish employee
identity, attendance provenance, branch attribution, or authorization and does not alter
canonical attendance truth.

`hr_kiosk_devices.last_seen_at/last_event_at` remains device telemetry and is not
canonical attendance authority. Service-role direct device UPDATE is nevertheless too
broad because it could change authorization-bearing device fields; Runtime replaces the
two telemetry updates with narrow wrappers while preserving authenticated owner/manager
device administration.

### Production mutation rule

Planning and pre-release verification are read-only against Production.

The future closure Runtime must not insert synthetic Production attendance, correction,
remediation, or operation-ledger rows solely to prove the gate.

## 11. Identity and authorization behavior

Preserve the existing distinctions:

- Supabase authenticated user;
- canonical entity identity;
- employee identity;
- kiosk device identity;
- House tenancy;
- branch operational restriction;
- owner/manager House-wide authority;
- producer lane / operation namespace.

No caller may self-assert a producer lane to gain authority.

Branch never creates House authorization.

A `service_role` credential is not kiosk identity by itself; the kiosk path must still
use the approved server/device authentication boundary before the database wrapper.

A signed/decoded QR employee claim is also not established employee identity by itself.
Until the employee row is resolved and proven to belong to the device-derived House, the
claim cannot populate authoritative `hr_kiosk_events.employee_id`. It may be retained
only as explicitly non-authoritative audit metadata.

## 12. Shared-device behavior

N/A to new product behavior.

Existing kiosk/shared-device behavior is only a verification input. Remaining Gate B
must prove kiosk device identity and explicit event-time branch provenance remain
isolated from authenticated manual/P1 identity.

No new staff session is created or closed by this slice.

## 13. Personal-device behavior

N/A to new product behavior.

Authenticated HR/P1 routes continue using the existing browser/session identity and
server-authoritative HR access resolution. No new client-side authority is introduced.

## 14. Session effects

None planned.

No staff/POS/Telegram session contract is changed.

## 15. Authorization behavior

The future verification must assert at minimum:

- raw DTR table mutation remains denied to `authenticated`;
- raw DTR table mutation remains denied to application `service_role`;
- direct table access to canonical attendance authority remains denied to
  `authenticated`;
- direct service-role canonical-table privileges are absent by default; any retained
  SELECT must have an exact reviewed dependency and no mutation/schema-adjacent grants;
- INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER against canonical attendance authority
  tables are denied to application `service_role`, including facts,
  revisions, observations, evidence/frames/membership, employee generations,
  projection/history, mutation operations, and P1 case/event tables;
- public/anon cannot call canonical mutation wrappers;
- authenticated can call only the approved authenticated wrappers;
- kiosk service_role can call only the approved kiosk mutation wrapper among ordinary
  producer commands;
- maintenance repair remains unavailable to normal application roles;
- private producer/P1 helpers remain non-callable;
- P1 case tables have no direct authenticated mutation lane;
- `service_role` cannot directly execute
  `hr_rebuild_attendance_authorization_projection`;
- `hr_apply_kiosk_attendance_scan` remains service-role executable;
- canonical readers preserve branch-limited versus house-global behavior.

## 16. Operational writes

No new attendance-truth or business transaction write is introduced.

Runtime changes only the already-existing kiosk supporting-write path:
- auxiliary `reject/sync_success/sync_fail` events move behind the narrow support-event
  RPC;
- `house_mismatch` / `employee_not_found` reject rows use null authoritative employee
  identity until same-House verification succeeds, with the QR claim retained only as
  non-authoritative audit metadata;
- device `last_seen_at` / `last_event_at` updates move behind the bounded telemetry /
  support wrappers.

Neither migration rewrites attendance rows. The final migration changes PostgreSQL
privileges; the additive migration only introduces the wrapper functions.

The test harness may write attendance fixtures only to an isolated disposable
Supabase/PostgreSQL database.

Pre-release Production verification remains read-only. A later owner-approved release
must follow the already-frozen sequence: additive wrapper migration → exact
wrapper-capable application deployment → final privilege-cutover migration.

## 17. Convenience / cache / local persistence

No browser localStorage, cookie, cache, or recovery-state change is planned.

Operation identity persistence remains whatever each released producer already uses; the
verification harness tests those contracts rather than inventing a new retry store.

## 18. Frontend / routes / components affected

**No product UI change planned.**

Daily DTR currently reads compatibility segments and, for P1 write workflows, canonical
facts. That staged mixed read posture remains until Gate C/D and must not be “cleaned up”
inside Remaining Gate B.

Payroll/payslip/overtime raw compatibility reads are also later Gate-D work.

## 19. Server / client boundary

No new boundary is planned.

Server-authoritative Supabase RPCs remain the only attendance mutation boundary.

Client operation IDs remain opaque idempotency keys; they do not encode authority.

## 20. Environment / feature flags

No new feature flag is planned.

No Preview environment variable should alter business semantics for this closure slice.

Disposable database verification must remain isolated from Production.

## 21. Error / fallback behavior

Verification must prove:

- stale CAS/generation fails closed;
- same operation ID with different material input fails closed;
- missing producer identity fails closed;
- invalid/cross-House provenance fails closed;
- insufficient provenance remains UNATTRIBUTED/hidden to branch-limited readers;
- conflicting provenance remains CONFLICT/hidden where modeled;
- no command failure falls back to raw DML;
- no test failure is “fixed” by broadening grants or bypassing RLS/command boundaries.

## 22. Compatibility with prior gates

Remaining Gate B must consume, not reinterpret:

- Gate-A canonical storage/read authority;
- Gate-B pre-P1 command containment;
- GAP-025 attribution semantics;
- P1 correction/remediation contracts;
- DEC-014 / DEC-017 / DEC-018 sequencing and authorization;
- House tenancy and branch-restriction invariants.

## 23. Concurrency and idempotency

The future integrated DB harness must cover at least:

1. duplicate manual create replay;
2. same operation ID / different manual input rejection;
3. exact kiosk retry;
4. kiosk debounce semantics;
5. kiosk close versus stale repair;
6. bulk replacement versus kiosk late/offline replay;
7. overlapping bulk operations;
8. duplicate P1 proposal/finalization retry;
9. P1 correction versus concurrent value/evidence change;
10. P1 remediation candidate-universe change;
11. exact remediation finalization retry;
12. projection rebuild versus active canonical mutation;
13. employee-generation monotonicity where the candidate universe changes.

The final state must be canonical and deterministic; no raw-only compatibility commit is
acceptable.

## 24. Deterministic unit/static tests

Future Runtime should extend the existing containment test rather than create a parallel
writer-inventory test surface:

- update
  `agui-starter/src/lib/hr/__tests__/gap024-gate-b-writer-containment.test.ts`;
- do not create a second independent static writer allowlist unless a concrete test
  limitation requires it.

The containment test must also become a **repository-wide producer discovery guard**,
not only a collection of hard-coded file reads. It should recursively inspect
`agui-starter/src/**` and `agui-starter/scripts/**` (excluding test fixtures/generated
output as appropriate) for:

- raw mutation calls against `dtr_segments` / `dtr_entries`;
- direct application DML against canonical attendance authority tables
  (`hr_attendance_facts`, revisions, observations, evidence/frames/membership,
  employee generations, projection/history, mutation operations, and P1
  correction/remediation case/event tables);
- calls to released attendance mutation RPCs;
- direct `hr_kiosk_events` writes capable of emitting provenance-bearing event classes.

The discovered mutation call sites must match an explicit reviewed allowlist of approved
producer/supporting paths. A new call site fails Preflight until it is classified in the
plan/containment test and, when it is a legitimate producer boundary, its path is added to
the integrated closure-workflow trigger set. Read-only DTR consumers must not be falsely
classified as writers.

Minimum static assertions:

- repository writer inventory includes all exact-head producer paths and fails on an
  unclassified newly discovered mutation call site;
- no application code performs raw `dtr_segments`/`dtr_entries` mutation;
- no application code directly mutates `hr_kiosk_events`;
- kiosk service/HTTP code has no raw `hr_kiosk_devices` UPDATE/INSERT/DELETE; only
  token/device SELECT lookup remains direct;
- authenticated kiosk-device admin code is explicitly exempt from that service-role
  assertion and remains governed by owner/manager RLS;
- kiosk event-type ownership is database-enforced: only the canonical database kiosk
  command may write `scan/clock_in/clock_out`; service-side auxiliary writes route
  through the narrow support-event RPC and are limited to
  `reject/sync_success/sync_fail`;
- `house_mismatch` and `employee_not_found` support events never place an unverified
  QR employee claim into authoritative `employee_id`; they use null identity plus
  non-authoritative `claimedEmployeeId` metadata;
- current wrappers and intended grants remain frozen;
- P1 immediate-update bypass remains retired;
- timezone repair remains command-only;
- legacy browser attendance writers remain retired;
- Daily DTR/payroll raw **reads** are explicitly recognized as later Gate C/D scope, not
  misclassified as Gate-B writer failures.

## 25. Integration / backend tests

Planned Runtime/verification file surface:

- two Supabase migrations created through the normal migration command:
  - `gap024_remaining_gate_b_kiosk_support_wrappers`;
  - `gap024_remaining_gate_b_privilege_cutover`;
- `agui-starter/src/lib/hr/kiosk/repository.ts`;
- `agui-starter/src/lib/hr/kiosk/http.ts`;
- `agui-starter/src/lib/hr/kiosk/service.ts`, limited to the frozen unverified
  reject-event identity adaptation;
- directly corresponding kiosk repository/service/HTTP tests as needed;
- `agui-starter/src/lib/db.types.ts` for the two new RPC signatures;
- existing
  `agui-starter/src/lib/hr/__tests__/gap024-gate-b-writer-containment.test.ts`;
- new orchestration workflow:
  `.github/workflows/gap024-remaining-gate-b-db.yml`;
- new **small** phased closure helper:
  `supabase/tests/gap024_remaining_gate_b_closure.sh`;
- governance/status docs only.

The closure helper should expose only the bounded phases needed by the workflow, for
example `seed-pre-cutover`, `restore-released-seams`, and
`verify-post-p1`. It must call the same local Supabase/PostgreSQL container contract used
by the existing harnesses and must not embed a copy of their C1-C8/P1 scenarios.

Do **not** fork a third independent attendance fixture/harness that can drift from the
already released Gate-B and P1 proofs.

The new closure workflow should preserve the current reusable workflow primitives
(`supabase/setup-cli@v1`, the scoped prerequisite fixture, explicit ordered SQL apply,
and unconditional local-stack cleanup).

It must run on `pull_request` to `develop` / `main` plus
`workflow_dispatch`, with path coverage broad enough that future producer-boundary
changes cannot silently skip the closure proof. Minimum watched paths:

- `supabase/**`;
- `agui-starter/src/lib/hr/**`;
- `agui-starter/src/lib/db.types.ts`;
- `agui-starter/src/app/company/**/hr/dtr/**`;
- `agui-starter/src/app/api/kiosk/**`;
- `agui-starter/src/app/api/hr/kiosk/**`;
- `agui-starter/src/app/api/hr/kiosk-devices/**`;
- `agui-starter/src/app/api/payroll/dtr-bulk/**`;
- `agui-starter/src/app/payroll/dtr-bulk/**`;
- `agui-starter/src/app/payroll/dtr-today/**`;
- `agui-starter/scripts/fix-dtr-timezone.ts`;
- `.github/workflows/gate-b-db-concurrency.yml`;
- `.github/workflows/p1-historical-dtr-db.yml`;
- `.github/workflows/gap024-remaining-gate-b-db.yml`.

After trigger/setup, it should:

1. starts the same scoped prerequisite fixture used by the existing database workflows;
2. applies all Gate-A migrations and Gate-B migrations **through the repair-command
   migration**, but intentionally pauses before the final
   `gap024_gate_b_reconcile_cutover`;
3. seeds a small, explicit **pre-cutover legacy fixture** containing:
   - a manual compatibility segment without approved historical provenance;
   - a system/kiosk segment whose event/device/source identity satisfies the released
     provenance proof; and
   - a system/kiosk segment whose historical metadata is insufficient or ambiguous;
4. applies the released `gap024_gate_b_reconcile_cutover` migration exactly once and
   asserts the three fixture classes become, respectively:
   - bridged canonical UNATTRIBUTED;
   - bridged canonical ATTRIBUTED only when the full released proof succeeds; and
   - bridged canonical UNATTRIBUTED/fail-closed, never fabricated ATTRIBUTED;
5. applies all P1 migrations in released order;
6. applies both Remaining-Gate-B migrations in order for disposable-db proof;
7. executes the existing Gate-B concurrency harness;
8. executes the existing P1 concurrency harness using its distinct fixture IDs/state;
9. **restores every test-overridden database seam to the exact released definition before
   closure assertions** — specifically, the current P1 harness models HR-4
   APPROVED/REJECTED states by replacing `hr_attendance_p1_hr4_decision` and ends with
   the modeled APPROVED definition, whereas released Production deliberately defaults
   that private seam to `UNAVAILABLE`;
10. runs a **small Remaining-Gate-B closure verifier** for only the missing cross-slice
   assertions: full bridge coverage, semantic rebuild determinism, reader parity,
   operation/grant no-bypass posture across both compatibility and canonical authority
   tables, kiosk event-type ownership/coupling, and auxiliary-writer disposition.

The final database privilege assertion must be **discovery-based**, not a frozen list of
today's tables/functions:

- enumerate current `public.hr_attendance_%` relations and fail any unclassified
  authenticated/service-role direct privilege;
- enumerate attendance/kiosk mutation-capable functions and compare service-role EXECUTE
  to the reviewed allowlist;
- separately assert kiosk event/device table privileges;
- allow only documented read surfaces and the approved kiosk/support wrappers.

Because the new closure workflow triggers on `supabase/**`, a later migration that
silently recreates direct canonical grants must fail CI instead of becoming unnoticed
authorization drift.

This ordering matters: seeding all representative “legacy” rows only **after** the
reconcile migration would not test backfill at all and would produce a false Gate-B
closure proof.

All closure-specific fixture UUIDs / House IDs / operation IDs must be disjoint from the
existing Gate-B and P1 harness namespaces so reuse cannot accidentally satisfy or disturb
another harness's assertions.

The closure verifier must not copy large blocks of existing test logic merely to obtain a
new workflow name.

Representative post-cutover / command state must additionally include:

- legacy manual segment;
- legacy kiosk/system segment with valid provable event linkage;
- legacy kiosk/system segment without sufficient provenance;
- same-day manual command write;
- kiosk online/offline/replay;
- bulk replacement;
- maintenance repair;
- P1 non-payroll location correction;
- P1 payroll-impacting fail-closed correction;
- P1 remediation existing-related;
- P1 distinct-new fail-closed without HR-4.

Required invariant snapshots before and after deterministic rebuild:

- active fact IDs/revisions;
- evidence-basis revisions;
- projection attribution state/branch;
- governing evidence IDs;
- compatibility bridge;
- employee generation;
- authorization-history cardinality/hash as applicable.

Two rebuilds without authoritative change must reproduce the same semantic projection
tuple for every current fact:
`fact_id + value_revision + evidence_basis_revision + fingerprint + attribution_state +
active_branch_id + governing_evidence_ids`.

`rebuilt_at` is intentionally non-semantic and may change.

Authorization history must **not gain a second row for the same exact
House/fact/value-revision/evidence-basis-revision pair** because its primary key and
`ON CONFLICT ... DO NOTHING` contract make rebuild replay idempotent. The verifier must
compare semantic history keys/content, not wall-clock timestamps.

Do not test “backfill idempotency” by blindly re-running already-applied migration files
inside the same database. Migration replay is proved by constructing a fresh disposable
database from the released ordered chain; rebuild/idempotency is proved through the
released callable/reconciliation contracts and their stable keys.

## 26. Production-shaped pre-release baseline verification

Before Runtime release approval, Production checks are **read-only** and must confirm the
actual pre-cutover state, not pretend the future migration has already run.

Required baseline:

- expected released Gate-A/Gate-B/P1 migration history, with neither Remaining-Gate-B
  migration present yet;
- `dtr_segments total = linked`;
- active facts = current projection rows;
- no active fact missing current projection;
- no unbridged compatibility segment;
- raw authenticated/service-role DTR mutation remains denied;
- authenticated remains deny-direct on canonical attendance authority;
- the known service-role canonical-table privilege gap matches the planned Section 4
  inventory and has not expanded to additional canonical relations/functions;
- `hr_rebuild_attendance_authorization_projection(uuid)` remains the known direct
  service-role callable slated for revocation;
- current authenticated/service-role kiosk event/device privileges match the known
  pre-cutover gap and contain no additional unplanned writer;
- migration-1 support RPCs are **absent** before release;
- P1 lifecycle direct-DML denial and immutable audit posture remain intact;
- no unexpected ATTRIBUTED/UNATTRIBUTED/CONFLICT transition since planning baseline;
- Vercel Production serves the intended released P1 application baseline;
- recent Production warning/error/fatal logs show no blocker unrelated to this planned
  cutover.

A changed business-row count is not automatically an error if legitimate attendance has
occurred. Verification compares relational invariants and privilege **shape**, not a
frozen count of 96.

Any additional raw writer/grant/dependency found at this gate is a planning/runtime
blocker; do not stretch the approved migration to absorb it silently.

## 27. Preview / staging UAT

Because this slice plans no user-visible behavior, human UAT is not mandatory solely to
repeat already-proven P1 UI workflows.

Preview/staging verification should instead prove:

- exact-head build/checks are green;
- no new product route/UI behavior is introduced;
- disposable DB integrated harness passes with both new migrations;
- wrapper-capable app works against the isolated post-migration backend;
- kiosk ping updates `last_seen_at` through the telemetry RPC;
- scan/sync retain current response semantics;
- `reject/sync_success/sync_fail` support events remain writable through the narrow RPC;
- `house_mismatch` and `employee_not_found` reject paths still record their audit
  events even though the QR employee claim is not same-House verified, with
  authoritative `employee_id = null` and the claim present only as audit metadata;
- verified-employee reject/sync events continue to carry the verified employee ID;
- direct support RPC attempts to mint `scan/clock_in/clock_out/queued` fail closed;
- raw service-role event/device mutations fail after migration 2;
- authenticated event mutation fails while event read/admin-device flows remain intact;
- Preview root/smoke remains healthy;
- runtime logs contain no new warning/error/fatal condition attributable to the slice.

If Runtime unexpectedly changes product behavior, this UAT contract is invalid and
planning must reopen.

## 28. Production verification

No synthetic attendance write is required.

Production release does require both planned migrations and the exact wrapper-capable
application artifact under the staged sequence in Section 29.

At closure:

- confirm Production serves the exact merge application commit;
- confirm both Remaining-Gate-B migrations are present in migration history in the
  approved order;
- inspect recent warning/error/fatal logs;
- run the read-only canonical/data invariants in Section 26;
- verify the exact post-cutover table/RPC privilege matrix;
- verify kiosk ping/scan/sync routes remain healthy without manufacturing a live
  attendance event solely for smoke;
- confirm no pre-wrapper deployment is serving after final privilege cutover;
- record exact evidence and Gate-B completion status.

## 29. Deployment / data deployment sequence

The Runtime PR must prove both migrations + the adapter together in disposable CI, but
Production rollout is deliberately staged to avoid an API/grant compatibility gap.

1. branch from then-current `develop`;
2. create both migrations through the normal Supabase migration command;
3. implement the bounded kiosk repository adapter + generated RPC types + frozen tests /
   workflow/helper;
4. run Review & Fix to exact-head convergence;
5. in disposable DB, apply the full released Gate-A/Gate-B/P1 chain plus both new
   migrations and pass all integrated closure assertions;
6. build exact-head Vercel Preview and run focused kiosk scan/sync/support-event route
   verification against an isolated backend; no Production attendance writes;
7. perform read-only Production baseline + privilege comparison;
8. request explicit owner release approval;
9. squash-merge the Runtime PR only after approval;
10. fetch both migrations and the exact application build from the exact merge commit;
11. re-check Production migration history, privileges, deployment, and runtime logs;
12. apply **migration 1 only** (additive kiosk support wrappers);
13. verify wrapper signatures/grants/schema cache while the old Production app remains
    compatible;
14. deploy/promote the exact merge application artifact that uses the wrappers;
15. verify Production HTTP/runtime health and confirm the serving deployment is the exact
    merge commit; do not manufacture an attendance event solely for smoke;
16. confirm new requests are on the wrapper-capable deployment, then apply
    **migration 2** (final privilege cutover);
17. verify:
    - canonical service-role table privileges are closed;
    - projection rebuild is not service-role executable;
    - authenticated kiosk events are read-only;
    - service_role has no raw event/device mutation;
    - kiosk scan + support wrapper EXECUTE matrix is exact;
    - all canonical bridge/projection/history invariants still hold;
18. inspect Production warning/error/fatal logs and route health again;
19. record Remaining Gate B closed only after every post-cutover check passes;
20. leave Gate C unauthorized until separately approved.

### Rollout interruption safety

- If migration 1 succeeds but app promotion fails, the old app remains compatible because
  raw grants have not yet been revoked; leave the additive wrappers in place and rollback
  / fix the app.
- If the new app is promoted but migration 2 has not run, both old raw capability and new
  wrappers temporarily coexist; minimize this window and proceed only after exact-app
  verification.
- After migration 2, rolling the application back to the pre-wrapper build is unsafe
  because that build depends on raw support writes. Rollback must use the exact
  wrapper-capable build or a forward fix; do not restore broad raw grants.

## 30. Cleanup

Future Runtime must:

- leave no disposable test data outside the isolated DB;
- stop the disposable Supabase stack;
- keep no temporary rollout flag;
- introduce no UAT account/device into Production;
- retain no stale test-only RPC/grant in product migrations;
- update only durable status/roadmap records needed to express Gate-B closure.

## 31. Rollback / kill switch

There is no feature-flag kill switch for the database privilege cutover. The two-stage
release sequence is the compatibility/rollback control.

Rollback policy is **fix forward**. Restoring broad direct canonical-table mutation to
`service_role` is not an acceptable routine rollback because that recreates the Gate-B
bypass this slice exists to close.

If pre-release verification finds a required direct dependency, stop before Production
and return to planning. If an unforeseen post-release dependency appears, use a separately
reviewed forward permission correction that grants only the minimum non-mutating
capability needed; do not broadly re-grant canonical DML.

If verification exposes any other defect:

- do not close Gate B;
- do not weaken grants;
- do not re-enable raw DTR DML;
- do not revert P1 as a shortcut;
- keep Gate C blocked;
- return to a bounded planning fix for the concrete producer/invariant failure.

Existing emergency rollback must continue to preserve Gate-A/Gate-B command containment
and P1 immutable audit lineage.

## 32. Acceptance criteria

Remaining Gate B is complete only when all are true on the exact verification head:

1. exact writer inventory is complete;
2. every attendance-truth writer is command-compatible, and every supporting writer is
   either proven safe under an explicit coupling/ownership contract or genuinely
   database-disjoint;
3. integrated Gate-A/Gate-B/P1 + both Remaining-Gate-B migration replay succeeds;
4. representative legacy bootstrap/backfill is deterministic on a fresh ordered replay,
   and post-cutover rebuild/replay behavior is idempotent;
5. every test producer leaves canonical authority + projection coherent;
6. P1 correction/remediation maintains the same invariants;
7. replay/idempotency mismatch tests pass;
8. real independent-session race tests pass;
9. deterministic rebuild reproduces identical current authority;
10. branch/global canonical reader assertions pass;
11. insufficient/conflicting provenance fails closed;
12. direct authenticated/service-role raw DTR mutation remains denied;
13. authenticated has no direct canonical-table access;
14. service_role has no direct canonical-table mutation/schema-adjacent privileges and
    no unreviewed direct canonical SELECT;
15. service_role cannot execute the projection rebuild directly;
16. kiosk wrapper remains the only service-role attendance-truth mutation entrypoint;
17. authenticated kiosk-event access is read-only;
18. service_role has no raw kiosk-event or device mutation;
19. auxiliary kiosk-event RPC accepts only `reject/sync_success/sync_fail` and cannot
    mint `scan/clock_in/clock_out` provenance;
20. unverified QR employee claims never populate authoritative kiosk-event
    `employee_id`; `house_mismatch` / `employee_not_found` use null identity and
    may retain the claim only as non-authoritative audit metadata;
21. verified same-House employee support events continue to carry the verified employee
    identity;
22. device telemetry RPC cannot alter House/branch/token/activation/identity fields;
23. direct authenticated/service-role DML on P1 lifecycle tables remains denied;
24. private helpers remain private;
25. no active fact lacks current projection;
26. no compatibility row is unbridged;
27. no active producer can create raw-only/projection-invisible attendance;
28. no Gate C/D/E behavior was pulled forward;
29. exact-head CI is green;
30. material review threads = 0;
31. current Roadmap/HR status and detailed plan agree;
32. pre-release Production baseline has no **unplanned** blocker and post-release
    Production verification passes.

## 33. Governance / authorization boundary

This planning amendment may define and refine only Remaining Gate-B
producer/privilege containment + verification closure, including the minimum kiosk
reject-event identity/file-surface correction discovered by Runtime PR #516.

It does not:

- implement the future Runtime;
- mark Remaining Gate B complete;
- merge itself;
- authorize Gate C;
- authorize any Production mutation;
- resume POS or another system phase.

After this amendment converges, the only next action is explicit owner approval of the
amended planning contract. After that approval and merge, the already-open Draft Runtime
PR #516 may resume against the amended contract; do not create a duplicate Runtime PR.
The Runtime must re-fetch the merged planning amendment before continuing its
Review → Fix → exact-head verification loop.

## 34. Deferred work

Explicitly deferred:

1. Gate C canonical Daily DTR facts-only read cutover;
2. Gate D all-consumer read migration/disposition;
3. Gate E final broad raw/base-access cutover;
4. kiosk-device/event **branch-limited authorization-lane redesign**. Existing durable
   HR branch-scope audit explicitly records this as a future authorization-model gap; this
   slice preserves current authenticated owner/manager device administration and event
   read scope rather than inventing a new branch-role source of truth;
5. HR-4 approval product implementation;
6. GAP-026;
7. unrelated HR/POS/Operations/Finance work.

## 35. Residual risks to carry into Runtime

- The current privilege gap means Remaining Gate B is not verification-only; release
  sequencing must not apply the privilege cutover before exact-head producer dependency
  proof is green.
- The current 96-row Production baseline is small and clean; larger future attendance
  volume may expose rebuild contention not visible in this dataset.
- Production operation ledger is currently empty, so live replay evidence is absent;
  disposable concurrency tests remain the safe proof source.
- Current Daily DTR and payroll families intentionally retain staged compatibility reads;
  future Gate C/D security work must not confuse “writer containment complete” with
  “all raw reads retired.”
- Historical manual facts correctly remain mostly UNATTRIBUTED; pressure to make more
  records branch-visible must not lead to fabricated attribution.
- Supabase/PostgREST behavior can drift across platform updates; final Runtime must
  verify current grants/function signatures/schema-cache behavior on the release path.
- Repository evidence shows no legitimate external consumer that requires the broad
  canonical/event/device grants being removed, but an undocumented external client cannot
  be proven absent from source alone; the staged release, runtime-log checks, and
  pre-cutover dependency audit reduce but do not eliminate that integration risk.
- There is a deliberately short post-deploy/pre-cutover window where the wrapper-capable
  app is live while old raw support grants still coexist. Release execution should
  minimize this window and never treat that temporary posture as Gate-B completion.
- `claimedEmployeeId` is intentionally untrusted audit metadata. Future analytics,
  debugging, or support tooling must not silently reinterpret it as established employee
  identity or provenance.

## 36. Review & Fix history

### Round 0 — initial draft

Initial draft created from the exact post-P1 repository, Production Vercel deployment,
Production Supabase state, and owner-approved GAP-024 ordering.

### Round 1 — fresh adversarial review and fixes

**P1 — durable governance was stale after the P1 release.** The Roadmap and HR status
still described P1 as awaiting release even though PR #514, Production migrations, and the
exact Production deployment were complete. Fix: synchronize those durable governance
records in this planning PR so a fresh chat cannot select the wrong active slice.

**P2 — producer inventory was implicit rather than auditable.** A closure plan that says
“inventory every writer” without recording the known exact-head surfaces risks omitting an
auxiliary/service path. Fix: add Section 5.3 with the current producer/auxiliary/read-only
inventory plus an explicit exact-head re-search requirement.

**P2 — the initial integration-test wording risked creating a third drifting harness.**
Gate-B and P1 already have real database harnesses. Fix: require reuse/composition of the
released harnesses and limit new code to a small cross-slice closure verifier.

**P2 — rebuild determinism was underspecified around audit timestamps/history.** A literal
row/hash comparison could falsely fail because `rebuilt_at` changes, while history is
keyed by fact/value/evidence revision. Fix: define the semantic projection tuple and the
history-key idempotency assertion, and explicitly prohibit treating migration re-execution
as the idempotency test.

### Round 2 — fresh review after governance synchronization

**P2 — legacy backfill proof was ordered too late.** The Round-1 wording applied the full
Gate-B migration chain before seeding representative legacy rows. That would test only
post-cutover commands and could falsely claim deterministic backfill without exercising
the released reconcile migration on legacy state. Fix: pause after the repair-command
migration, seed three bounded pre-cutover fixture classes, then apply the released
reconcile cutover once and assert ATTRIBUTED versus fail-closed UNATTRIBUTED outcomes.

**P3 — duplicate subsection numbering and fixed-row wording reduced precision.** Fix:
renumber compatibility state to 5.4 and express bridge completeness as a relational
invariant rather than freezing the planning-time count of 96 as future business state.

### Round 3 — durable planning-artifact identity synchronization

**P2 — durable status named the branch/artifact but not the hosted planning PR.** A fresh
session should be able to recover the exact review surface without searching by inference.
Fix: record PR #515 in this plan, HR status, and Roadmap while preserving its Draft,
planning-only, unapproved state.

### Round 4 — fresh integrated-harness state review

**P1 — the existing P1 harness leaves a modeled HR-4 APPROVED seam installed.** In its
standalone disposable database this is harmless, but an integrated Remaining-Gate-B
workflow that runs closure assertions afterward could accidentally verify a test-only
approval capability instead of the released fail-closed Production contract. Fix:
require restoration of every test-overridden seam — explicitly
`hr_attendance_p1_hr4_decision` to released `UNAVAILABLE` behavior — before final
cross-slice assertions.

**P2 — reused harness fixtures need namespace isolation.** Fix: require closure-specific
House/employee/device/operation identifiers to be disjoint from both existing harnesses
so one suite cannot satisfy or corrupt another suite's assertions by collision.

### Round 5 — kiosk supporting-state ownership review

**P1 — the plan incorrectly classified kiosk event writes as database-disjoint
telemetry.** The released kiosk command itself writes `scan/clock_in/clock_out` rows,
reads prior `clock_in/clock_out` events for debounce, and the released Gate-B reconcile
migration used exact kiosk event/device/branch/timestamp proof for historical provenance.
Treating the table as inert telemetry could miss a path that changes operational
semantics. Fix: classify `hr_kiosk_events` as supporting operational/provenance state,
freeze command-owned event types, and require a static/runtime proof that service-side
auxiliary writes remain limited to non-provenance `reject/sync_success/sync_fail`
classes.

The existing `last_event_at` device-timestamp behavior remains telemetry/UX state and is
not promoted into this Gate-B attendance-authority closure slice.

### Round 6 — fresh cross-section consistency review

**P1 — Round-5 kiosk coupling was not propagated through the whole Slice Contract.**
Section 8 still called the kiosk event writer database-disjoint, the writer-classification
list had no category for coupled supporting state, and the acceptance criterion still
required every writer to be command-compatible or disjoint. Those contradictions could
cause Runtime either to ignore the kiosk coupling or incorrectly block it. Fix: add an
explicit coupled-supporting/provenance category, define its event-type ownership boundary
consistently, and update acceptance to distinguish attendance-truth writers from safe
supporting writers.

**P3 — the persistence subsection heading still called all of the state “audit /
telemetry.”** Fix: rename it to supporting operational / audit / telemetry state so the
heading matches the actual contract.

### Round 7 — implementation-surface precision review

**P2 — the plan described the integrated proof but did not freeze its bounded file
surface.** That left Runtime free to duplicate existing workflows/tests in several
different ways. Fix: reuse the existing
`gap024-gate-b-writer-containment.test.ts`, add exactly one closure workflow
(`.github/workflows/gap024-remaining-gate-b-db.yml`), and add one small phased closure
helper (`supabase/tests/gap024_remaining_gate_b_closure.sh`) that orchestrates only the
cross-slice gaps while continuing to invoke the released Gate-B and P1 harnesses.

### Round 8 — continuous-enforcement and idempotency wording review

**P1 — the planned closure workflow did not freeze trigger coverage.** A gate-closing CI
proof that does not rerun when kiosk API, Daily DTR, bulk, repair, RPC type surface, or
the predecessor harnesses change can silently become stale after merge. Fix: freeze
`pull_request` / `workflow_dispatch` behavior and the minimum producer-relevant path
set, including both reused workflows/harness domains.

**P2 — “backfill idempotency” still conflicted with the explicit rule not to re-run an
already-applied migration.** Fix: define the migration/backfill property as deterministic
fresh ordered replay, while idempotency applies to operation replay and callable
post-cutover rebuild/reconciliation behavior.

### Round 9 — exact route-surface trigger review

**P1 — the Round-8 CI path set covered `/api/kiosk/**` but omitted the parallel
`/api/hr/kiosk/**` routes and kiosk-device administration routes present on the exact
development head.** A change to device activation/branch context or the HR-prefixed
scan/sync boundary could therefore alter producer identity semantics without rerunning the
closure proof. Fix: add both `agui-starter/src/app/api/hr/kiosk/**` and
`agui-starter/src/app/api/hr/kiosk-devices/**` to the mandatory workflow trigger set.

### Round 10 — future producer-discovery bypass review

**P1 — exact-head hard-coded inventory plus path-filtered DB CI was not sufficient to
detect a future attendance writer added under a previously unknown route/script.** The
existing containment test reads known files directly; a new command or raw writer outside
those files could avoid both its assertions and the closure workflow path filters. Fix:
require the existing containment test to gain repository-wide mutation-call discovery
over `agui-starter/src/**` and `agui-starter/scripts/**`, fail on every unclassified
new writer/supporting call site, and require any newly approved producer path to be added
to the closure workflow trigger set. This preserves efficient path-filtered DB CI without
leaving an unknown-path bypass.

### Round 11 — canonical-authority raw-DML bypass review

**P1 — the no-bypass contract focused on compatibility DTR tables and P1 lifecycle
tables but did not explicitly freeze raw application DML denial across the full canonical
attendance authority.** A future service-role path plus grant drift could otherwise
bypass the command engine by writing facts/evidence/projection/generation/operation rows
directly. Fix: extend static producer discovery, disposable DB grant verification, and
Production read-only verification to the full canonical authority table set for both
`authenticated` and application `service_role`.

### Round 12 — Production principal privilege audit

**P1 — Remaining Gate B was incorrectly modeled as verification-only.** Fresh Production
grant inspection proved that `service_role` still has direct canonical-table privileges
on core Gate-A authority tables and can execute the projection rebuild. This violates the
already-approved Gate-B requirement that raw canonical authority be deny-direct and that
`service_role` not remain a generic attendance mutation principal. The gap originates
from Gate A revoking table privileges from PUBLIC/anon/authenticated but not
`service_role`.

Fix: Remaining Gate B now includes one bounded forward privilege-cutover migration.
The migration revokes direct service-role canonical table access by default, preserves
SELECT only if a concrete exact-head dependency is proven, removes mutation/schema-
adjacent privileges unconditionally, revokes direct service-role projection rebuild,
keeps the kiosk wrapper as the sole ordinary service-role attendance mutation entrypoint,
reloads PostgREST schema, and performs no data rewrite. Release sequencing and rollback
were updated accordingly.

### Round 13 — kiosk supporting-state database containment

**P1 — static kiosk event-type ownership was still only application convention.**
Production grants show both authenticated house-owner/manager paths and `service_role`
can directly mutate `hr_kiosk_events`; service_role can also broadly mutate
`hr_kiosk_devices`. Because `clock_in/clock_out` events affect kiosk debounce and were
historical provenance material, that raw authority is part of the Gate-B supporting-state
boundary.

Fix: broaden the single Remaining-Gate-B migration from canonical-table privilege cleanup
to a bounded privilege/adapter cutover. Authenticated event access becomes read-only;
service_role loses raw event DML and raw device mutation; the kiosk repository moves
auxiliary event insertion and device telemetry updates to two narrow service-role
SECURITY DEFINER RPCs. The support-event RPC accepts only
`reject/sync_success/sync_fail`, while command-owned
`scan/clock_in/clock_out` remain database-owned by the canonical kiosk command.
Authenticated owner/manager device administration remains unchanged.

This is producer-containment work already covered by Remaining Gate B, not a new product
policy.

### Round 14 — coordinated DB/application rollout review

**P1 — a single migration plus adapter change had an unavoidable compatibility gap.**
Revoking raw kiosk event/device grants before deploying the new adapter breaks the old
app; deploying the adapter first makes it call RPCs that do not exist yet. Fix: split the
bounded database work into two migrations. Migration 1 additively introduces narrow
support wrappers, then the exact wrapper-capable application is promoted, then migration
2 revokes canonical/event/device raw authority. Interruption and rollback behavior are
explicit: before migration 2 the old app remains compatible; after migration 2 only the
wrapper-capable build may serve.

### Round 15 — exact kiosk dependency + race-preservation review

**P1 — kiosk ping was an unrecorded raw service-role device UPDATE.** Exact-head
`src/lib/hr/kiosk/http.ts` updates `last_seen_at` directly, so revoking service-role
device UPDATE after changing only the repository would break ping. Fix: include
`http.ts` and its focused tests in the frozen Runtime surface and route ping through the
same telemetry wrapper.

**P2 — support wrappers initially re-checked device active state and could introduce a
new disable-race failure after an already-authorized request/attendance command.** Fix:
keep active-device authorization in the existing kiosk authentication/canonical scan
boundary. Auxiliary-event RPC validates exact device + House + branch and allowed event
class; telemetry touch validates existing device identity only. Neither wrapper can alter
authorization-bearing fields, so this preserves current behavior without weakening
attendance authority.

### Round 16 — Production verification coherence review

**P2 — Section 28 still described the slice as verification-only after the plan had
gained two migrations and an application adapter deployment.** Fix: Production
verification now explicitly requires the ordered migrations, exact wrapper-capable
artifact, post-cutover privilege matrix, route health, and proof that no pre-wrapper build
is serving. Synthetic attendance remains unnecessary.

**P3 — new service-role wrapper names were left implicit.** Fixed in Round 16 by naming
the callable surfaces. Round 18 further freezes their callable shapes.

### Round 17 — future privilege drift + deferred authorization review

**P1 — a one-time privilege matrix could pass Remaining Gate B and then silently regress
when a later Supabase migration creates another attendance table/function with default
service-role grants.** Fix: require discovery-based disposable-DB privilege assertions
over current `hr_attendance_%` relations and attendance/kiosk callable surfaces, and
keep the closure workflow triggered by all `supabase/**` changes.

**P2 — kiosk device/event branch-limited authorization is a known durable model gap but is
not owned by Remaining Gate B.** The existing HR branch-scope audit explicitly defers
formal branch-limited authorization lanes until that authority model is standardized.
Fix: record this as deferred and preserve the current authenticated owner/manager device
administration + event-read contract rather than smuggling a new branch-role policy into
this security closure.

### Round 18 — support-RPC authority-shape review

**P2 — the support-event wrapper still accepted caller-supplied House/branch even though
the device row is the authoritative source for those values.** Cross-checking would be
safe, but it leaves unnecessary authority-shaped inputs and a larger signature. Fix:
freeze one five-argument support-event RPC that accepts device/optional employee/event
type/time/metadata, derives House + branch from the device row, and returns void. Freeze
the telemetry wrapper as one `(uuid) RETURNS void` overload. Runtime must verify exact
overload count and generated client signatures after schema-cache reload.

### Round 19 — governance claim precision

**P2 — Roadmap wording still said P1 preserved a generic “no-bypass privilege posture,”
which contradicted the fresh canonical/service-role findings.** Fix: narrow the released
claim to the raw DTR-table no-bypass posture actually proven by the P1 release, while the
new Remaining-Gate-B section owns the broader canonical/supporting-state privilege gaps.

### Round 20 — pre-release versus post-release evidence separation

**P1 — the pre-release Production baseline section incorrectly required the future
post-cutover privilege state.** That would make owner release approval impossible because
Production is supposed to still contain the known gap before the migration. Fix: Section
26 now verifies the real released P1 state, confirms the known privilege gaps match the
frozen plan, and blocks only on additional/unplanned drift. Section 28 remains the
post-release proof that the gaps are closed.

**P2 — Preview verification was too generic after the kiosk adapter became Runtime
scope.** Fix: explicitly test ping telemetry, scan/sync response preservation, allowed
support-event classes, forbidden provenance event classes, post-cutover raw DML denial,
and authenticated admin/read survivability against an isolated backend.

### Round 21 — residual rollout risk completeness

**P3 — residual risk did not explicitly mention undocumented external grant consumers or
the intentional short coexistence window between wrapper-capable app promotion and the
final privilege migration.** Fix: document both as realistic release risks without
weakening the cutover contract.

### Round 22 — authorization-boundary terminology review

**P2 — Section 33 still called the future slice a “verification Runtime,” which no
longer matched the converged plan after the approved containment gaps required two
migrations and a bounded kiosk adapter change.** Fix: describe the future scope as
producer/privilege containment + verification closure and the later artifact as a bounded
Runtime/closure PR. No authorization or product scope was expanded.

### Round 23 — original-plan final fresh review from scratch

Fresh review of the complete current Slice Contract, exact post-P1 repository state,
Production privilege evidence, kiosk producer/supporting-state surfaces, two-stage rollout,
test/UAT strategy, rollback rules, and synchronized governance found **no remaining
material P0/P1/P2 planning defect**.

Convergence state:

- unresolved P0: 0;
- unresolved P1: 0;
- unresolved material P2: 0;
- planning scope remains documentation/governance only in PR #515;
- future Runtime scope is bounded to the two planned migrations, kiosk support adapter,
  generated RPC types, directly corresponding tests, closure workflow/helper, and
  governance evidence;
- Gate C/D/E remain unauthorized;
- Production remains unchanged by this planning PR;
- exact-current-head Preflight/Vercel checks must be green before owner approval is acted
  on.

No further planning fix was justified at the original PR #515 approval gate.

### Round 24 — Runtime-discovered planning re-entry

**P1 — the approved Runtime file surface omitted a service adaptation required by its own
new support-event identity contract.** Runtime PR #516 exposed the concrete path:
`hr_record_kiosk_support_event` correctly rejects an employee ID that is not in the
device-derived House, but the released kiosk service historically attached the QR claim
to `house_mismatch` and `employee_not_found` reject events before same-House employee
resolution. Under the strict wrapper, those audit writes would fail. Runtime had already
implemented the safe correction in `service.ts`, but that file was outside the
owner-approved "may change only" surface.

Planning fix: authorize only the necessary `service.ts` adaptation and freeze the
identity semantics. Unverified QR claims use authoritative `employee_id = null` and may
be preserved only as non-authoritative `claimedEmployeeId` metadata; verified
same-House employees retain existing behavior. Corresponding service tests are required.
No additional schema, RPC, event type, product behavior, or rollout step is added.

The planning amendment has converged, was explicitly owner-approved, and was merged as
PR #517. Runtime PR #516 is therefore authorized to resume against the amended contract
while remaining Draft/unmerged until its own Runtime/UAT/release gates pass.

### Round 25 — amendment cross-section data/write coherence review

**P2 — the amendment froze the reject-event identity rule but did not propagate it into
Data/Store Impact and Operational Writes, and Section 16 still described a stale
single-migration Production action.** Fix: record the exact audit-row representation
change, distinguish support/audit writes from attendance-truth writes, and restore the
approved staged release sequence: additive wrapper migration → exact wrapper-capable app
→ final privilege cutover. Also clean the pre-existing malformed “one bounded, two bounded
migrations” wording.

### Round 26 — fresh amendment review from scratch

Fresh review of the amended Slice Contract, Runtime PR #516 blocker evidence, persisted
support-event identity semantics, exact file surface, identity/authorization boundaries,
data/write impact, tests/UAT, rollout sequence, rollback rules, and synchronized
governance found **no remaining material P0/P1/P2 planning defect**.

Convergence state for the planning contract itself:

- unresolved P0: 0;
- unresolved P1: 0;
- unresolved material P2: 0;
- changed files remain documentation/governance only in PR #517;
- Runtime PR #516 is resumed, Draft/unmerged, and reconciled with the merged amendment;
- the only newly authorized Runtime file is the bounded `kiosk/service.ts` adaptation
  required by the already-approved support-event wrapper contract;
- no new schema, RPC, event type, attendance semantic, product workflow, or rollout step
  is introduced;
- Gate C/D/E remain unauthorized;
- Production remains unchanged.

The exact-current planning head has now cleared the repository's normal check gate:
Preflight is green, the Vercel status is successful, and the exact-head Preview deployment
is READY. No superseded Preview is being reused as evidence.

No remaining material P0/P1/P2 planning defect is known. Planning amendment PR #517 has
been explicitly owner-approved and merged; Runtime PR #516 has resumed under that amended
contract.

**PLANNING GATE: CLOSED — RUNTIME RESUMED**


## Runtime / Controlled UAT pre-release convergence checkpoint — 2026-09-28

Runtime PR #516 resumed under the owner-approved amended contract and reached controlled
Preview/UAT convergence on functional head
`45d1db84114f8ccc36950aa377f39df14f2d38c9`.

Exact functional-head automated evidence:

- Preflight #1023 — SUCCESS;
- Gate B DB Concurrency #123 — SUCCESS;
- P1 Historical DTR DB Concurrency #111 — SUCCESS;
- Remaining Gate B DB Closure #53 — SUCCESS;
- Vercel Preview deployment `dpl_GQkYdqFQAnks7Q7Z32sqxX81keMn` — READY;
- material review threads — 0.

Controlled Preview/UAT evidence:

- the branch Preview was explicitly isolated to UAT Supabase project
  `ectzbcijqhegoamtaqgo`, not Production `rytrmtsteojboqmrimdb`;
- the exact Runtime Preview loaded successfully in a real browser;
- both Remaining-Gate-B migrations are present in the isolated UAT backend;
- kiosk support/device fixture rows are clean after verification
  (`hr_kiosk_devices = 0`, `hr_kiosk_events = 0`);
- exact-head tests cover ping/scan/sync route behavior and prove
  `house_mismatch` / `employee_not_found` reject events use
  `employee_id = null` with only non-authoritative `claimedEmployeeId` metadata;
- the disposable DB closure suite proves support RPC allow/deny behavior, raw
  kiosk event/device privilege denial, canonical no-bypass posture, producer
  compatibility, concurrency, reader scope, and projection/rebuild invariants;
- Preview warning/error/fatal logs for the controlled smoke window contain no
  slice-attributable entry.

The human browser checkpoint was intentionally minimal because this slice adds no
user-visible workflow. Its purpose was only to prove that the isolated exact-head Preview
renders normally. No Telegram/native/physical checkpoint is applicable.

Read-only Production pre-release baseline remains exactly the planned pre-cutover state:

- Production Vercel still serves released P1 commit
  `a95c3c921e067297f4f033620fe2f4ede7e7c5aa`;
- neither Remaining-Gate-B migration is present in Production;
- `dtr_segments = 96`, linked segments = 96;
- active canonical facts = 96 and current projection rows = 96;
- active facts missing projection = 0;
- unbridged compatibility segments = 0;
- current attribution remains 17 ATTRIBUTED / 79 UNATTRIBUTED / 0 CONFLICT;
- authenticated has no direct canonical attendance-table access;
- the known service-role canonical-table privileges remain limited to the exact
  planned pre-cutover inventory;
- service_role still has projection-rebuild EXECUTE as expected pre-cutover;
- kiosk event/device raw privileges remain the known planned pre-cutover gap;
- migration-1 support RPCs are absent in Production;
- raw authenticated/service-role DTR writes and direct P1 lifecycle DML remain denied;
- Production warning/error/fatal logs for the last 24 hours contain no blocker.

Cleanup/pre-release safety:

- disposable CI Supabase stacks stop on every run;
- no synthetic UAT kiosk device/event row remains in the isolated UAT backend;
- no UAT account/device or Remaining-Gate-B migration was introduced into Production;
- no temporary rollout feature flag exists;
- the branch-scoped UAT Preview environment override is intentionally retained while PR
  #516 remains open because it is the active safety boundary preventing Preview writes
  from reaching Production. It is not stale cleanup; remove it only when the branch
  Preview is retired after release/merge.

Fresh release review of the complete Runtime diff against the amended approved contract
found no unresolved P0/P1/material-P2 defect. The two-stage Production rollout and
fix-forward rules in Sections 29–31 remain valid.

The next release action is owner approval only after the governance-sync exact head is
green. No merge or Production mutation is authorized by this checkpoint.
