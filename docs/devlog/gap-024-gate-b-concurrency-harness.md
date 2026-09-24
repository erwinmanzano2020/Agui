# GAP-024 Gate-B Pre-P1 — PostgreSQL Concurrency Harness

## Status

**EXECUTED / PASS — disposable local Supabase/PostgreSQL CI.**

Verified runtime-code head:
`59c93b904a92180b3852e8e8df40f1f06c073964`

GitHub Actions:
- workflow: `Gate B DB Concurrency`
- run: **#6**
- run id: `35960349148`
- conclusion: **SUCCESS**

The workflow starts an unlinked disposable local Supabase database on the GitHub runner,
loads the minimal current prerequisite schema used by Gate A/B, applies the complete
Gate-A + Gate-B migration chain in order, runs C1-C8 through independent PostgreSQL
sessions, and destroys the local stack.

No Production project ref, Production credential, paid Supabase branch, or Production
attendance data participates in this harness.

The first zero-history experiment also documented pre-existing repository migration debt:
the full historical migration directory is not clean-replayable from an empty database
because unrelated 2025 migration
`20250207090000_add_tenant_theme_preset.sql` assumes `public.tenant_theme` already
exists, and legacy nonstandard migration filenames are skipped by the current CLI.
Gate-B testing therefore intentionally replays the approved Gate-A/Gate-B boundary on a
scoped current-schema prerequisite fixture instead of changing unrelated historical
migrations.

## Purpose

The owner-approved Gate-B plan requires real independent-session proof for attendance
mutation serialization, stale-write rejection, idempotency, and projection consistency.
Repository/static tests are necessary but do not substitute for PostgreSQL lock timing.

## Environment prerequisites

Before execution record:

- isolated project/branch ref;
- migration head;
- PR #512 exact head;
- fixture House;
- two branches in that House;
- one active employee;
- one active kiosk device bound to the fixture branch;
- authenticated HR actor with the intended House/branch capability;
- service-role connection for kiosk wrapper execution only;
- two independent SQL/database sessions (A/B).

All fixtures must be disposable and deleted with the development branch.

## Invariants checked after every case

1. no raw application write bypasses the canonical command;
2. every live `dtr_segments.canonical_fact_id` points to the same House + employee;
3. every active canonical fact has one current value revision and one sealed current
   evidence frame;
4. mutation operation identity is unique by House + producer namespace + operation ID;
5. employee generation advances only with committed candidate/evidence changes;
6. authorization projection equals a clean Gate-A rebuild;
7. no transaction reports success while leaving compatibility and canonical state
   partially applied.

## Case C1 — duplicate manual create

Session A and Session B submit two different operation IDs for the same employee and same
logical time window concurrently.

Expected:

- House+employee serialization prevents an inconsistent interleave;
- both committed creates, if allowed as distinct facts, are individually canonical and
  projected; no raw-only segment exists;
- same operation ID + same fingerprint is replay-idempotent;
- same operation ID + different fingerprint fails closed.

## Case C2 — exact kiosk retry vs distinct concurrent scan

A: submit kiosk operation ID K1 at T1 and hold the transaction after acquiring the
employee mutation domain.

B1: submit **the same** K1/T1.

B2: separately test a distinct K2 inside the debounce window.

Expected:

- exact retry returns the prior K1 outcome and does not create a second observation/fact;
- distinct K2 cannot independently pass stale application-side debounce; the serialized
  DB decision returns the canonical debounced/action result;
- no accidental immediate IN+OUT pair is created from two near-simultaneous scans.

## Case C3 — kiosk close vs admin repair

Start from one bridged open kiosk fact.

A: close via `hr_apply_kiosk_attendance_scan`.

B: concurrently invoke the admin-only `hr_apply_attendance_time_repair` with the
pre-race expected value revision.

Expected:

- one order wins the House+employee serialization domain;
- the stale expected revision fails rather than overwriting a newer value;
- evidence lineage and current frame remain coherent;
- projection rebuild matches the winning canonical pair.

## Case C4 — bulk replace vs late/offline kiosk replay

Start from an employee/day with bridged canonical attendance.

A: call `hr_replace_bulk_attendance_day` for that employee/day.

B: concurrently replay a valid kiosk source observation for the same employee.

Expected:

- operations serialize on the same House+employee domain;
- retired predecessor facts never reactivate;
- replacement facts do not inherit branch provenance from employee/day/time similarity;
- kiosk evidence applies only to the fact created/selected by the serialized current
  state, or fails stale/invalid as appropriate;
- no deleted compatibility row remains referenced by a Gate-B revision.

## Case C5 — two employee-generation-changing decisions

Use two independent mutations for different attendance dates of the **same employee**,
both capable of changing DEC-018 candidate/evidence coverage.

Expected:

- House+employee serialization prevents lost generation increments;
- committed generation is monotonic;
- an optimistic workflow using an earlier expected generation fails stale after the
  first committed universe change.

## Case C6 — overlapping bulk batches

Run two bulk operations whose employee sets overlap.

If implementation keeps per-result transactions (current approved direction), race the
same employee/day result from two clients.

If a later implementation batches multiple employee locks in one transaction, acquire
employee keys in deterministic sorted order and run inverse batch order from A/B.

Expected:

- no deadlock from inconsistent employee-lock ordering;
- per-result operation IDs deduplicate retry correctly;
- same-key/different-input fails closed.

## Case C7 — projection rebuild vs mutation

A: perform a canonical mutation while holding the employee lock.

B: concurrently invoke the Gate-A House projection rebuild.

Expected:

- no raw-only committed attendance is observable;
- after both complete, a fresh rebuild produces the same projection rows/state as the
  stored projection;
- authorization history contains every superseded/current authority pair required by
  Gate-A activation guards.

## Case C8 — raw privilege cutover

After the final cutover migration:

Authenticated session attempts raw:

- INSERT
- UPDATE
- DELETE
- TRUNCATE

on `public.dtr_segments`.

Application service-role session attempts the same.

Expected:

- all raw mutation attempts fail;
- SELECT compatibility remains only where intentionally retained;
- authenticated manual/bulk wrappers and service-role kiosk wrapper still succeed under
  valid authority because their SECURITY DEFINER owner performs canonical DML;
- private mutation engine is not directly executable by authenticated/service_role.

## Executed evidence

Run #6 proved:

- C1 concurrent manual creates serialize; replay is idempotent; same-key/different-input
  fails closed;
- C2 exact concurrent kiosk retry produces one clock-in; distinct scan inside the
  debounce window does not create an accidental clock-out;
- C3 kiosk close vs stale admin repair completes without deadlock and stale repair fails;
- C4 bulk replacement vs late kiosk scan serializes; predecessor stays retired; no
  Gate-B revision references a deletable compatibility row;
- C5 concurrent generation-changing mutations preserve both generation increments;
- C6 overlapping bulk results serialize without deadlock and operation-key mismatch fails;
- C7 rebuild vs mutation completes without partial state and the post-race projection
  rebuild is deterministic;
- C8 authenticated and service-role raw mutation attempts on protected
  `dtr_segments`/`dtr_entries` fail while approved wrappers remain callable and the
  private mutation engine remains inaccessible.

Final invariant checks also passed:

- bridge House/employee integrity;
- Gate-B revisions keep `dtr_segment_id IS NULL`;
- every active fact has its current revision and a sealed current frame;
- every active Gate-B fact remains compatibility-backed.

## Cleanup

The GitHub Actions runner destroys the local Supabase stack automatically with
`supabase stop --no-backup`. There is no persistent test project or paid branch to
delete. Production rollout remains a later owner-controlled PR/UAT/deployment phase.
