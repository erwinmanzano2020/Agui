# GAP-024 Gate-B Pre-P1 Raw-Mutator Containment Plan

## Status

**PLANNING ONLY — first bounded planning pass. Runtime implementation is not authorized by this document.**

Base: `develop` at `71d11b79c002dce9b65e786ecb30ecfa9abdd494` (PR #510 squash merge).

Active phase remains HR. This slice is the owner-approved DEC-017 prerequisite between
GAP-024 Gate A and Historical Daily DTR Write P1. It must establish a database-enforced,
non-bypassable attendance mutation foundation and prove every principal that can mutate
P1-covered attendance either uses the canonical command or is database-enforced as
disjoint. P1 itself remains a separate later bounded PR.

## 1. Objective

Establish the exact implementation contract for the **Gate-B pre-P1 raw-mutator /
producer-write-containment foundation** so Historical Daily DTR Write P1 can later execute
without any authenticated, service-role, kiosk, bulk/import, manual/admin, replay/sync,
background, or repair path bypassing Gate-A canonical attendance authority.

## 2. Business / security outcome

After the future runtime slice completes:

- all active attendance mutations that overlap P1-covered state cross one database-enforced
  canonical command boundary;
- no live producer can create/update/delete a raw `dtr_segments` row that is invisible to
  Gate-A fact/revision/evidence/projection authority;
- kiosk and other active producers preserve their current user-visible semantics while
  maintaining canonical durable authority;
- raw legacy compatibility rows may remain readable where later gates still need them,
  but overlapping mutation authority is contained;
- Historical Daily DTR Write P1 remains disabled until this containment slice is merged,
  deployed, and repository/database proof confirms no bypass-capable principal remains.

## 3. Confirmed requirement

Owner-approved DEC-017 requires this sequence:

1. inventory every active attendance mutation principal/writer;
2. establish a hardened non-bypassable canonical command;
3. migrate every overlapping principal to that command or prove it database-enforced as
   disjoint;
4. verify no remaining authenticated, service-role, kiosk, bulk/import, manual/admin,
   background, replay/sync, repair, or other active principal can mutate P1-covered state
   outside that command;
5. only then may the separately approved Historical Daily DTR Write P1 execute.

Application convention, trusted server code, route discipline, and ordinary RLS alone are
not sufficient containment.

## 4. Current durable state reconstructed

### 4.1 Gate A

GAP-024 Gate A is merged and released.

- PR #510 squash merge: `71d11b79c002dce9b65e786ecb30ecfa9abdd494`.
- Gate-A canonical fact/value/evidence/projection authority is live.
- Final membership lock-order correction is applied to Supabase.
- Gate-A facts/projection/history are currently empty.
- Gate-A readers and rebuild function exist; no normal Production consumer is cut over.

### 4.2 Current raw attendance state

Read-only live verification at this planning checkpoint:

- `dtr_segments`: 96 rows total.
  - 59 `source='manual'`
  - 37 `source='system'`
  - 95 closed, 1 open
  - 0 bulk, 0 pos at this exact checkpoint
- `hr_kiosk_events`: 248 rows.
- Every 37 current `source='system'` segment has a `clock_in`/`clock_out`
  `metadata.segmentId` relationship.
- Structural kiosk-event matching currently shows:
  - 36 closed system rows = exactly one linked IN + one linked OUT, one branch, no null
    branch;
  - 1 open system row = exactly one linked IN, zero OUT, one branch, no null branch;
  - zero current system rows have cross-branch linked event evidence;
  - all 73 linked clock events match the compatibility segment timestamp, House, employee,
    and carry branch/device context.
- **DEC-019 identity narrows the establishable subset:** only 44/73 linked clock events
  currently carry a non-empty opaque `metadata.clientId`, producing only 17/37 system
  segments for which every required governing observation currently has a stable
  source/operation identity (16 closed + 1 open). The other 20 system segments are not
  eligible for established kiosk provenance from current evidence alone.
- `dtr_entries`: 1035 rows and remains a separate compatibility/bulk summary surface.

This evidence supports a **bounded candidate** kiosk bootstrap subset, not blanket
establishment of all system rows. GAP-025 explicitly states that JSON
`metadata.segmentId` is evidence of present behavior but is not sufficient canonical
integrity infrastructure by itself; DEC-019 additionally requires trustworthy
namespaced source identity and original occurrence time. Gate-B bootstrap may establish
only rows for which the migration both creates durable canonical linkage and proves every
governing observation satisfies that identity/integrity contract. It also does **not**
prove manual legacy branch provenance, so manual legacy rows must not be assigned a
branch merely from current employee/device/request context.

## 5. Current active writer / principal inventory

The implementation slice must re-run and freeze this inventory at its exact implementation
head. Current confirmed writers are:

### A. Authenticated manual/server DTR

1. `agui-starter/src/app/company/[slug]/hr/dtr/actions.ts`
   - authenticated server client;
   - create via `createDtrSegment(...)`;
   - update via direct `dtr_segments.update(...)`;
   - current write authorization uses HR access + target resolution.

2. `agui-starter/src/lib/hr/dtr-segments-server.ts`
   - authenticated helper;
   - direct `dtr_segments.insert(...)`.

### B. Authenticated legacy browser writers

3. `agui-starter/src/app/payroll/dtr-today/page.client.tsx`
   - browser authenticated client;
   - direct insert/update.

4. `agui-starter/src/app/payroll/dtr-bulk/page2.tsx`
   - browser authenticated client;
   - destructive delete + insert replacement.

These browser paths are bypass-capable while `authenticated` retains raw DML.

### C. authenticated API that escalates to service_role for bulk writes

5. `agui-starter/src/app/api/payroll/dtr-bulk/route.ts`
   - authenticates a real user with `createServerSupabaseClient()`;
   - resolves entity, House, feature access, and HR branch access;
   - then escalates data reads/writes through `service_role`;
   - destructive delete + insert replacement;
   - also writes `dtr_entries`.

Gate-B must remove the attendance-write escalation: after authorization, the route invokes
the authenticated bulk command through the caller session. A SECURITY DEFINER wrapper may
perform the required atomic database work while retaining `current_entity_id()` /
requested-House authorization. The generic service credential must no longer be the bulk
attendance mutation principal.

### D. service_role kiosk / offline replay

6. `agui-starter/src/lib/hr/kiosk/http.ts`
   + `agui-starter/src/lib/hr/kiosk/service.ts`
   + `agui-starter/src/lib/hr/kiosk/repository.ts`
   - service-role device-authenticated flow;
   - scan creates or closes `dtr_segments`;
   - offline sync replays `clientEventId` and `occurredAt`;
   - kiosk event rows preserve device/branch/event evidence.

### E. Repair / operational procedure

7. `agui-starter/scripts/fix-dtr-timezone.ts`
   and `docs/admin/hr-dtr-timezone-repair.md`
   - raw SQL / service-role style operational mutation;
   - directly updates `dtr_segments`.

### F. Database principals

Live table privileges currently expose broad mutation/schema-adjacent privileges on
`dtr_segments` to `authenticated`, `service_role`, and
`postgres` / administrative database authority, including
`INSERT`, `UPDATE`, `DELETE`, **`TRUNCATE`**, `REFERENCES`, and `TRIGGER`
(along with SELECT).

Live authenticated RLS policies are House-role based and permit raw
INSERT/UPDATE/DELETE. TRUNCATE is outside row-level RLS semantics. Together these are the
present database bypasses the future runtime slice must close for normal application
principals.

The implementation inventory must also search for hidden writers at the exact head
(migrations, scripts, RPCs, tests that represent production procedures, direct SQL,
background jobs, legacy routes). Discovery of another active writer does not expand
product scope, but it must be classified and contained or proven DB-disjoint before exit.

## 6. Authoritative architecture to preserve

### Source of truth

- Gate-A canonical attendance authority becomes the authoritative mutation truth:
  `hr_attendance_facts`, append-only fact revisions, observations/evidence, evidence
  frames/membership, employee generation, and authorization projection.
- `dtr_segments` remains a compatibility/operational row surface during staged migration;
  it must no longer be independently authoritative for overlapping writes.
- `hr_kiosk_events` remains kiosk audit/source material but is not itself canonical
  attendance authority.
- `dtr_entries` remains outside Gate-A truth and must not silently become canonical.

No parallel attendance source of truth is authorized.

## 7. Canonical command boundary

### 7.1 Physical direction

Implement **one migration-backed canonical mutation engine** with narrowly authorized
public wrappers and private helpers.

Planning internal name:

`hr_apply_attendance_producer_mutation(...)`

The internal engine is **not granted directly to browser/application roles**. Public
entrypoints are producer/caller-specific so a caller cannot gain authority merely by
passing `lane='KIOSK'`, `lane='BULK_IMPORT'`, or another producer label. At minimum, the runtime design must separate:

- authenticated HR/manual command entry — EXECUTE granted to `authenticated`;
- authenticated bulk/import command entry — EXECUTE granted to `authenticated`;
- kiosk/device command entry — EXECUTE granted to `service_role` only because the
  existing kiosk API is service-backed;
- audited maintenance/repair entry — not granted to normal application roles; callable
  only through the approved administrative/break-glass maintenance boundary.

The private canonical engine and private helpers have EXECUTE revoked from
`PUBLIC`, `anon`, `authenticated`, and `service_role`; only the database owner
and the narrowly granted wrappers may reach them through definer execution.

Equivalent strongly typed wrappers are acceptable if they share one canonical internal
mutation engine and do not duplicate canonical business logic.

Each callable function must be migration-backed, `SECURITY DEFINER` where elevation is
required, use a fixed safe `search_path`, enforce House tenancy, derive caller identity
from the appropriate trusted context, and expose only its approved producer contract.
Every migration must explicitly REVOKE default/public function EXECUTE before granting the
intended role. Raw canonical tables remain deny-direct.

### 7.2 Command input contract

Required logical inputs:

- `house_id`
- `employee_id`
- operation identity / retry key
- producer operation namespace / producer class, but **not as a trusted authority claim**;
  the public wrapper/caller class determines which producer contract may be used;
- producer-specific immutable source identity where available
- mutation intent:
  - create/open
  - close
  - legacy/manual replacement
  - retire/replace
  - repair-adjust
- proposed canonical value:
  - work_date
  - time_in
  - time_out
  - lifecycle status
  - source label
- actual-attendance provenance fields when the producer legitimately has them
- expected current canonical state:
  - expected fact/value revision when a workflow is mutating from a previously observed
    fact version;
  - expected employee candidate/evidence generation **only for workflows whose decision
    was made against a previously observed candidate/evidence universe** (including the
    later P1 remediation flow). Ordinary producer ingestion such as kiosk scan/sync must
    still serialize on and atomically advance the employee generation, but it does not
    require the device/client to know that generation in advance.

The command must not infer historical branch from current employee branch, request branch,
UI context, or current device context except where a producer supplies a separately
valid source observation under an already-approved lane.

### 7.3 Command result contract

Return a typed result that distinguishes at minimum:

- applied;
- idempotent replay / already applied;
- stale fact revision;
- stale employee generation;
- authorization/provenance rejected;
- target not found / no longer current;
- conflict / unresolved canonicalization;
- invalid input.

Return identifiers/revisions needed by the caller without exposing raw evidence or hidden
other-branch state.

### 7.4 Transactional responsibilities

One command transaction must atomically maintain all applicable pieces:

1. acquire the **House + employee attendance-mutation serialization domain**;
2. validate tenancy and the **entrypoint-specific producer contract**; never trust a
   caller-supplied lane string to confer kiosk/manual/bulk authority;
3. resolve operation retry identity before creating new canonical state;
4. validate expected fact revision / employee generation;
5. write or update the compatibility `dtr_segments` row where the current producer
   contract still requires it;
6. create/advance canonical fact/value revision;
7. create/advance observation/evidence/frame/membership when provenance changes;
8. seal/activate the intended evidence frame;
9. lock/create the House + employee generation row and advance
   `candidate_evidence_generation` exactly once whenever the committed mutation changes
   DEC-018 candidate/evidence coverage; compare an expected generation only when the
   workflow supplied one from a prior authoritative read;
10. invoke the **existing Gate-A House rebuild/classifier** in the same transaction for
    the initial implementation rather than duplicating classification logic. Treat
    House-wide rebuild cost/contention as a load-test gate; any later incremental
    per-fact classifier requires a separately reviewed equivalence proof;
11. commit all or none.

No producer may update `dtr_segments` first and "catch up" Gate-A later.

## 8. Legacy compatibility bridge

### 8.1 Direction

Add an additive nullable compatibility reference on `dtr_segments`:

`canonical_fact_id uuid null`

with:

- same-House / same-employee referential enforcement to
  `hr_attendance_facts(house_id,id,employee_id)`; and
- a uniqueness rule ensuring one live compatibility row cannot share the same non-null
  canonical fact bridge with another row.

The exact composite/index shape may follow PostgreSQL implementation constraints, but the
one-live-row-per-canonical-fact invariant is part of the contract.

This bridge is compatibility metadata, not a new source of truth.

### 8.2 Why the direction is preferred

Existing Gate-A fact revisions can point to `dtr_segment_id`, but current bulk writers
delete and recreate segment rows. Using the legacy segment ID as the canonical fact
identity or as mandatory immutable historical ownership would make legitimate legacy
replacement incompatible with append-only fact history.

A forward reference from the mutable compatibility row to a stable canonical fact allows:

- stable canonical fact identity independent of compatibility row replacement;
- legacy readers to keep consuming `dtr_segments` during Gate B/C/D staging;
- raw row deletion only after canonical retirement/transition rules have been applied;
- rebuild/backfill without rewriting immutable Gate-A history.

For this containment slice, **new/backfilled canonical fact revisions must leave the
legacy `dtr_segment_id` reference NULL**. The existing Gate-A column remains for
compatibility/history but its `ON DELETE RESTRICT` FK must not become the ownership link
for a row that later bulk/repair compatibility flows are allowed to replace. The
`dtr_segments.canonical_fact_id` forward bridge is the live compatibility mapping.

A later separately reviewed migration may repurpose or retire the optional legacy
`dtr_segment_id` reference, but Gate B must not create a reverse dependency that makes
approved compatibility-row replacement impossible.

## 9. Producer-specific migration contracts

### 9.1 Kiosk scan + offline sync — must migrate in this slice

Kiosk is an overlapping `service_role` writer and cannot remain raw.

Requirements:

- route/device authentication remains unchanged;
- canonical source observation identity uses the kiosk/offline event identity contract;
- current public kiosk already supplies a UUID `clientId`; offline sync supplies required
  `clientEventId`;
- the future command must reject a missing producer operation/source ID for a write path
  that can retry; do not silently fall back to timestamp identity;
- Gate B freezes the active kiosk producer mapping as one semantic source-identity
  family: the online per-scan UUID `clientId` and offline `clientEventId` (which the
  current sync service intentionally forwards into `processKioskScan` as `clientId`)
  are the opaque ID for the same logical scan contract. Use one versioned producer
  namespace for that contract so retries of the same offline action reuse the same
  observation identity. A future materially different kiosk producer requires a new
  namespace mapping;
- historical bootstrap may use already-recorded `clientId` values only where present,
  unique in the selected namespace, and unambiguous—never database event-row ID/order or
  timestamp as a substitute;
- source observation records capture:
  - producer namespace;
  - immutable client event/source ID;
  - original `occurredAt`;
  - device-derived actual branch already validated against House;
- create/open and close advance canonical value/evidence atomically;
- retries are idempotent and cannot create duplicate facts/evidence;
- cross-branch or malformed evidence fails closed according to GAP-025;
- current debounce behavior remains a UI/operational guard, not the idempotency authority.

For current kiosk bootstrap, **do not assume all 37 system segments are establishable**.
At the planning checkpoint only 17/37 have a stable opaque `clientId` on every required
IN/OUT observation. The implementation must re-run the proof and may establish only the
subset that satisfies the complete durable-link + DEC-019 identity + original-occurrence
contract. Every other system row remains unresolved/UNATTRIBUTED even when its current
JSON segment link and branch happen to agree.

### 9.2 Authenticated manual DTR create/update — must migrate in this slice

The current manual action must call the canonical command rather than raw table DML.

**New manual/admin fact creation after containment must comply with GAP-025 Section 3.4.**
The initiating surface must collect explicit actual-attendance branch provenance for that
fact. The server/DB path must validate same-House branch integrity and existing caller
authority; current employee branch, current device branch, schedule, request branch, or
operator location cannot silently fill the value. The resulting MANUAL_ADMIN evidence
must carry the required actor/authorization/time audit fields before it can be
ESTABLISHED/SUFFICIENT.

This is a minimal producer-contract migration, not Historical DTR Write P1: it does not
add missing-fact remediation adjudication, correction proposal/finalization, HR-4
approval, or hidden-fact branch-limited create semantics.

For **pre-existing legacy manual facts** that were canonicalized without approved
provenance, an ordinary value-only edit may advance the same canonical fact revision
while preserving its existing UNATTRIBUTED evidence basis. It must not silently invent
branch provenance. A later operation that intends to establish/change attendance
location belongs to the separately governed correction/provenance path.

The current UI may therefore require one bounded actual-attendance branch input for new
manual creation. Other UI/product behavior remains unchanged.

### 9.3 Legacy browser Daily DTR — must be migrated or retired before privilege cutover

`payroll/dtr-today/page.client.tsx` cannot keep raw browser DML after containment.

Preferred bounded disposition:

- remove direct mutation from the browser path and route writes through the same
  authenticated server-side canonical command adapter;
- preserve current UI behavior only where it remains authorized;
- if the route is demonstrably dead/unreachable at the implementation head, retire its
  write path explicitly instead of preserving a bypass.

No client-side secret or service-role token may be introduced.

### 9.4 DTR Bulk browser + service API — must be contained before P1

The two bulk implementations must converge on one **authenticated,
server-authoritative** command-backed write path. The API already has an authenticated
user session before it obtains a service client, so the future attendance write must use
the authenticated RPC wrapper rather than `service_role`.

Requirements:

- browser direct delete/insert is removed or made unreachable;
- API no longer uses `service_role` for attendance mutation and no longer directly
  delete/inserts overlapping `dtr_segments`;
- per result, use deterministic operation identity; the request/batch authorization
  reference is not assumed to identify one attendance fact. The initiating browser/server
  flow must create stable per-save/per-result operation IDs **before** the mutation call
  and reuse them on transport retry; generating a fresh UUID inside each server retry is
  not idempotency;
- legacy replacement semantics are expressed as canonical retire/replace operations,
  not raw delete/reinsert;
- because the current bulk save does not carry an approved one-to-one predecessor fact
  identity, **employee + date + time similarity must not be used to infer that a recreated
  row is the same canonical fact**. Default bulk replacement semantics are: retire the
  currently replaced canonical facts and create new canonical facts for submitted
  replacement rows, with no provenance inheritance. A same-fact revision is permitted
  only if a future exact-head implementation can carry and validate explicit one-to-one
  predecessor identity under GAP-025;
- if explicit actual-attendance branch provenance is absent, new canonical state remains
  UNATTRIBUTED rather than inferring current employee branch;
- `dtr_entries` compatibility updates must be included in the same database transaction
  as the corresponding canonical attendance replacement when the current bulk contract
  treats them as one save. A successful canonical commit followed by a failed
  `dtr_entries` write is not an acceptable "complete" result. If implementation proves
  `dtr_entries` is independently derived/rebuildable instead, that disposition must be
  documented and tested before removing it from the transaction.

### 9.5 Timezone repair — remove raw bypass

The existing raw update procedure must not retain authority to mutate P1-covered rows.

Plan one approved audited maintenance path that:

- requires explicit House and bounded target set;
- uses canonical command/revision/generation controls;
- records repair reason / operation identity;
- does not rewrite immutable history;
- fails stale rather than overwriting newer canonical state;
- can be transactionally dry-run/verify before commit.

The old raw SQL must be retired or changed to a diagnostic-only procedure before
authenticated/service-role raw DML is revoked.

## 10. Bootstrap / backfill contract

### 10.1 Kiosk bootstrap — durable-link proof, not JSON promotion

For current `source='system'` rows, `metadata.segmentId` may be used only to locate a
**migration candidate**. It is not by itself sufficient provenance.

To become established kiosk evidence, each required logical observation must pass all of:

- candidate event and segment are same House + employee;
- candidate event has event-time branch in that House;
- event `occurred_at` exactly matches the applicable current segment boundary being
  migrated;
- a trustworthy non-empty opaque producer source identity exists and is unique under its
  approved House + source namespace;
- original occurrence time is present and immutable;
- the migration writes a new durable canonical observation/evidence/fact relationship so
  future classification no longer depends on the JSON segment pointer;
- OPEN has exactly one established IN and zero OUT;
- COMPLETED has exactly one established IN and one established OUT;
- no established branch disagreement exists.

At this planning checkpoint, 17/37 system segments satisfy the stable-ID prerequisite for
all required observations (16 closed + 1 open); 20/37 do not. Those counts are evidence,
not a frozen migration allowlist: implementation must re-evaluate the exact live rows.

Rows that fail any requirement still receive canonical value/fact representation where
that mapping is deterministic, but their kiosk evidence remains unresolved/insufficient
or their frame remains unproved, so the projection is UNATTRIBUTED. No database event ID,
row order, timestamp proximity, or `metadata.segmentId` alone may be invented as a
replacement DEC-019 source identity.

### 10.2 Manual legacy subset

Current manual legacy rows have no approved durable historical branch provenance.

For these rows:

- create canonical value/fact state only if the identity/replacement mapping is
  deterministically provable;
- create a sealed current evidence frame with the correct OPEN/COMPLETED mode but **no
  fabricated governing evidence membership** when no approved provenance exists;
- do **not** create established branch provenance or fake MANUAL_ADMIN evidence merely to
  satisfy storage shape;
- the Gate-A classifier must therefore produce UNATTRIBUTED for that empty/unproved
  frame;
- preserve the legacy compatibility row;
- no current employee branch backfill.

### 10.3 Rebuild verification

After bootstrap:

- every migrated active compatibility row has exactly one stable canonical fact bridge;
- no Gate-B-created/backfilled canonical revision depends on that mutable compatibility
  row through legacy `dtr_segment_id`;
- every canonical active fact has an exact current revision/frame;
- projection rebuild is deterministic;
- branch reader shows only ATTRIBUTED facts;
- owner/manager global reader may inspect authorized UNATTRIBUTED/CONFLICT state;
- repeated bootstrap is idempotent.

## 11. Database privilege transition

### 11.1 Authenticated

Only after **all** authenticated write paths have migrated/retired:

- revoke **every raw mutation-capable table privilege** from `authenticated`, including
  `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE`; also remove unnecessary
  `REFERENCES`/`TRIGGER` privileges so the remaining grant is intentionally bounded
  rather than inherited from historical `GRANT ALL` posture;
- remove write policies that are no longer reachable/needed;
- preserve required SELECT until the later consumer-cutover gates;
- grant only the approved canonical mutation RPC(s) needed by authenticated server
  adapters.

### 11.2 service_role

`service_role` bypasses RLS, so RLS is not containment.

After this slice, `service_role` must **not** remain a generic attendance mutation
principal. Its only approved attendance mutation use is the kiosk wrapper because the
existing kiosk API is device-token/service backed. Bulk moves to the authenticated
wrapper; manual is authenticated; repair is administrative/break-glass.

The implementation must:

- migrate kiosk to the kiosk-specific command wrapper;
- move bulk attendance mutation off service_role to the authenticated bulk wrapper;
- retire raw repair writes;
- prove repository search contains no remaining overlapping service-role raw
  `dtr_segments` DML;
- revoke raw mutation-capable `dtr_segments` privileges from the application
  `service_role`, including `INSERT`, `UPDATE`, `DELETE`, and `TRUNCATE`, while
  retaining only verified read privileges if still required.

A shared `service_role` credential is trusted infrastructure transport, **not end-user
business identity**. The database cannot reconstruct the kiosk token's application-side
peppered hash verification from the JWT alone without duplicating a server secret, so
this plan does not invent a second token authority in PostgreSQL.

Instead the kiosk wrapper must:

- be executable only by `service_role`;
- require the server-verified device ID plus House/branch context;
- re-read `hr_kiosk_devices` and require that device to be active and match the supplied
  House + branch;
- require stable operation/source identity and original occurrence time;
- enforce same-House employee/fact linkage;
- create canonical observation/evidence itself from that verified device context;
- never treat a caller-supplied lane or branch as established merely because
  `service_role` supplied it.

The existing API continues to verify the plaintext kiosk token/pepper before invoking the
wrapper. A stolen service-role credential remains a high-privilege infrastructure
incident; this slice removes its **raw attendance bypass** and forces any attendance write
through canonical invariants, but does not claim to cryptographically distinguish
multiple application routes that share the same database role.

Important PostgreSQL/Supabase limitation: database superuser/owner authority cannot be
made non-bypassable through ordinary grants/RLS. DEC-017's operational-principal proof
therefore applies to application/automation principals. Direct administrator emergency
SQL remains an explicitly audited break-glass governance boundary, not a normal producer.

### 11.3 Gate-E boundary

This slice does not remove all direct reads, raw diagnostic access, or every legacy base
interface. It contains mutation authority required before P1. Gate E remains responsible
for final broad raw/base-access security cutover.

## 12. Authorization / identity

- House remains tenant boundary.
- No cross-House mutation.
- Branch is provenance/restriction, never tenant authority.
- Authenticated HR write adapters preserve existing HR capability checks.
- New manual/admin fact creation additionally requires explicit actual-attendance branch
  provenance as already mandated by GAP-025; this is provenance input, not authorization
  derived from current employee assignment.
- Kiosk authorization remains device-token + House + branch device authority.
- `service_role` is not end-user business identity. Kiosk token/device authentication
  remains server-authoritative; the kiosk DB wrapper independently cross-checks the
  active device House/branch and enforces canonical mutation invariants. Bulk/manual use
  authenticated wrappers instead of service-role attendance mutation.
- No identity lookup/merge/normalization semantics change.
- No shared-device staff session behavior is introduced in this slice.

## 13. Concurrency / idempotency

Required database controls:

- shared House + employee mutation serialization for all operations capable of changing
  candidate/evidence coverage;
- deterministic lock order: acquire the House+employee mutation domain before mutable
  fact/evidence/generation work, then retain Gate-A's established frame/fact/evidence
  ordering inside that domain;
- expected fact revision CAS when a workflow mutates from a previously observed existing
  fact state;
- expected employee generation when a decision was made against a previously observed
  candidate/evidence universe; ordinary producer ingestion instead locks and advances the
  current generation atomically;
- a durable mutation-operation ledger (or equivalent database uniqueness) keyed by
  **House + producer namespace + operation ID**, storing employee, request fingerprint,
  outcome, and resulting fact/revision identifiers. A replay with the same key and same
  fingerprint returns the prior outcome; the same key with different material input
  fails closed;
- kiosk observation uniqueness uses stable producer source identity;
- duplicate online request and offline replay return the already-applied result;
- bulk retry deduplicates per employee/result operation, not merely per request batch;
- stale repair/bulk/manual updates fail rather than latest-write-win;
- projection update/rebuild participates in the transaction or is guarded so consumers
  never observe raw-only committed attendance.

## 14. Error / fallback behavior

- Fail closed on stale expected revision/generation.
- Fail closed on missing required producer identity.
- Fail closed on cross-House or invalid producer authority.
- Fail closed on invalid/missing branch provenance when a producer attempts established
  attribution.
- Do not fall back from command failure to raw DML.
- Existing readers may continue using legacy rows during staged rollout; write fallback is
  prohibited after that producer migrates.
- Rollback must never silently restore broad raw write authority while P1 is enabled.

## 15. Environment / feature flags

No client-visible feature flag is required for this infrastructure slice.

If a temporary server-side rollout gate is needed for producer-by-producer migration, it
must:

- default to old producer behavior only **before** privilege cutover and before P1;
- be server-only;
- never bypass the canonical command once raw DML is revoked;
- be removed or frozen OFF at slice exit.

P1 remains separately disabled/not implemented.

## 16. Frontend / routes / components

Expected runtime touch set for the later implementation, subject to exact-head inventory:

- manual DTR server actions / helper;
- legacy Daily DTR client write adapter;
- bulk page/API consolidation;
- kiosk HTTP/service/repository;
- timezone repair script/runbook.

No product redesign is authorized.

## 17. Server / client boundary

- Browser code must not directly mutate `dtr_segments`.
- Authenticated user writes terminate at a server action/route that invokes the canonical
  DB command under the caller's authenticated identity or an explicitly bounded secure
  adapter.
- Kiosk routes may use service-role transport only after device-token authority has been
  verified; actual attendance mutation occurs through the kiosk-specific database
  wrapper, which revalidates active device/House/branch context.
- Bulk routes must use the authenticated caller wrapper for attendance mutation even if a
  service client remains necessary for separately audited read-only compatibility work.
- No service-role secret reaches the client.

## 18. Data / persistence classification

- Gate-A canonical tables: authoritative operational/audit state.
- `dtr_segments`: compatibility operational representation during staged migration,
  not independent canonical mutation truth.
- `hr_kiosk_events`: source/audit evidence input, not canonical fact truth.
- `dtr_entries`: compatibility summary/input surface, not canonical fact truth.
- operation/idempotency state introduced by the command: authoritative mutation-control
  state, append-only or uniquely keyed, not cache.

## 19. Tests required before runtime convergence

### 19.1 Static / unit

- writer inventory contract test;
- no browser direct `dtr_segments` DML remains;
- no migrated service path uses raw DML;
- command signature/types contract;
- migration ordering / grants / RLS / PostgREST reload;
- exact command error mapping;
- existing UI validation and kiosk behavior regressions;
- privilege test proving `authenticated` cannot INSERT/UPDATE/DELETE/**TRUNCATE** raw
  `dtr_segments` after cutover;
- wrapper-authority tests proving an authenticated/manual caller cannot select kiosk or
  bulk provenance by changing input labels;
- manual-create tests requiring explicit authorized actual-attendance branch, while
  value-only edits of legacy UNATTRIBUTED facts do not invent provenance;
- bulk replacement tests proving employee/day/time similarity does not inherit fact
  identity or branch provenance.

### 19.2 Database integration

Use executable PostgreSQL/Supabase-capable tests for:

- create/open;
- close;
- canonical manual unresolved write;
- kiosk retry idempotency;
- offline duplicate replay;
- bulk per-result retry;
- stale value revision;
- stale employee generation;
- House mismatch;
- invalid branch provenance;
- compatibility-row bridge consistency and uniqueness;
- proof that Gate-B-created/backfilled canonical fact revisions keep legacy
  `dtr_segment_id` NULL;
- fact retirement + legacy row replacement without FK blockage;
- atomic rollback on projection/evidence failure;
- raw authenticated DML denied after cutover;
- raw application `service_role` DML path absent/denied where grants permit, including
  TRUNCATE;
- canonical internal engine not directly executable by browser/application roles;
- producer-specific wrappers callable only by their intended principal class and unable
  to forge another lane's established provenance;
- no direct canonical-table grants.

### 19.3 Concurrency

A real two-session database harness is required for:

- same employee, two independent create attempts;
- close vs repair/update;
- bulk replace vs kiosk late/offline replay;
- two cross-date mutations sharing employee generation;
- duplicate producer operation identity race;
- projection rebuild vs active mutation.

Exactly one compatible state may commit where CAS/generation requires exclusivity; stale
competitors must fail deterministically.

## 20. Preview / staging UAT

This slice is infrastructure-heavy.

Automated Preview/staging UAT should prove:

- manual DTR create/update still works through command;
- kiosk online IN/OUT still works;
- offline queue replay is idempotent;
- bulk replacement remains behaviorally compatible for authorized use;
- unauthorized direct browser/raw calls fail;
- no raw-only fact is created;
- projection/reader state matches canonical authority.

Human UAT is needed only for observable kiosk/manual/bulk behavior that cannot be
deterministically verified by integration tests; do not require fabricated payroll or
attendance events solely for UAT.

## 21. Production verification

After future owner-approved deployment:

- verify migration/grants/function signatures;
- verify raw authenticated write denial;
- verify active kiosk/manual/bulk producer health;
- verify projection rebuild consistency;
- verify no orphan compatibility rows or canonical facts;
- verify no new UNATTRIBUTED/CONFLICT spike beyond expected migrated legacy/manual cases;
- verify logs for stale/idempotency/authorization errors;
- keep P1 disabled until the containment exit checklist is signed off.

## 22. Deployment sequence

The implementation must be ordered to avoid breaking live writers:

1. exact-head re-inventory and freeze writer/principal matrix;
2. add command/private helpers/idempotency/bridge additively;
3. backfill only provable canonical authority;
4. migrate kiosk to command and verify;
5. migrate authenticated manual paths and verify;
6. migrate/retire browser direct writers;
7. migrate bulk to the authenticated command path and verify service-role attendance
   write escalation is removed;
8. migrate/retire repair writer;
9. prove repository/database no-bypass matrix;
10. revoke authenticated raw DML;
11. bound service-role raw DML as far as platform ownership permits;
12. repeat producer regression + DB integration + concurrency tests;
13. rebuild/verify projection;
14. Production deploy under explicit owner release approval;
15. verify post-deploy containment;
16. only then mark Historical Daily DTR Write P1 as the next authorized planning/runtime
    candidate.

Do not revoke raw DML before its dependent writers have migrated.

## 23. Rollback / kill switch

Rollback is two-stage:

- before privilege cutover: producer adapters may be rolled back to the previous build
  only while raw DML is still intentionally available and P1 remains disabled;
- after privilege cutover: rollback must preserve canonical command containment. Do not
  restore broad authenticated/service-role raw DML as a convenience rollback.

If the canonical command is unhealthy after cutover, disable affected attendance writes
(fail closed) and repair/roll forward. Do not reopen the bypass.

## 24. Cleanup

At slice exit:

- remove temporary migration feature toggles;
- retire duplicate browser/bulk raw write code;
- retire raw timezone repair mutation SQL;
- remove obsolete write RLS policies/grants;
- preserve needed read compatibility until later gates;
- update runbooks to use canonical maintenance command;
- keep writer inventory and verification evidence durable.

## 25. Acceptance criteria

The future runtime slice is complete only when:

1. all active attendance writers at the exact head are inventoried;
2. every overlapping application principal uses the canonical command or is proven
   database-enforced as disjoint;
3. browser direct attendance DML is gone;
4. authenticated raw DML over protected `dtr_segments` state is revoked;
5. kiosk service-role flow cannot bypass canonical fact/evidence/projection, and bulk is
   no longer a service-role attendance mutator;
6. raw repair mutation is retired;
7. only the DEC-019-compliant kiosk bootstrap subset is established; all other kiosk
   legacy state remains fail-closed/UNATTRIBUTED;
8. manual legacy state is not given invented branch provenance;
9. canonical projection is deterministic and current;
10. retries are idempotent and stale mutations fail;
11. two-session concurrency proofs pass;
12. no active producer creates a projection-invisible/raw-only fact;
13. P1 is still not implemented inside this slice;
14. Gate C/D/E behavior remains unauthorized.

## 26. Explicit out of scope

- Historical Daily DTR Write P1 implementation;
- correction proposal/finalization UI;
- DEC-014 missing-fact remediation UI/runtime;
- HR-4 product workflow;
- Daily DTR canonical read cutover (Gate C);
- all-consumer migration (Gate D);
- final broad raw/base read-security cutover (Gate E);
- payroll calculation changes;
- schedule/roster behavior;
- employee identity changes;
- POS/Operations/Finance work;
- Telegram/Mini App work.

## 27. Governance / authorization boundary

This plan applies already-approved DEC-017 / GAP-024 / GAP-025 / DEC-018 sequencing and
does not create a new business rule.

No runtime, migration, grant, RPC, API, UI, or test implementation is authorized until
this planning artifact is reviewed, converged, and explicitly owner-approved for Runtime.

## 28. Deferred work

After this containment foundation is implemented, deployed, and proven:

1. separately plan/execute Historical Daily DTR Write P1 using the canonical command;
2. complete remaining Gate-B producer/backfill/rebuild work;
3. Gate C Daily DTR read cutover;
4. Gate D all-consumer migration;
5. Gate E final broad raw/base-access security cutover.

## 29. Initial adversarial review checklist

Before this plan may converge, fresh review must specifically challenge:

- whether every raw writer/principal is inventoried;
- whether the compatibility bridge can survive delete/recreate flows;
- whether canonical fact creation can be made idempotent without inventing attendance
  identity;
- whether kiosk online and offline paths truly provide stable source identities;
- whether manual legacy bootstrap accidentally attributes current branch;
- whether bulk `dtr_entries` can diverge from canonical attendance;
- whether `service_role` containment is being overstated given PostgreSQL ownership;
- whether command + projection update is atomic;
- whether rollback reopens a bypass;
- whether the plan accidentally pulls P1 correction semantics into the pre-P1 slice.

## 30. Current residual planning risks

- The exact canonical command SQL signature is intentionally not frozen beyond its logical
  contract; implementation review may choose equivalent strongly typed parameters.
- Supabase administrative/database-owner authority is an unavoidable break-glass boundary;
  the plan targets application/automation principals and must document this explicitly.
- Current kiosk `metadata.segmentId` is only a candidate-locator during migration, not
  durable future source identity or sufficient provenance. The current planning snapshot
  shows only 17/37 system segments with stable opaque identity on every required event.
- Manual legacy rows remain unattributed unless approved provenance exists.
- `dtr_entries` compatibility coupling requires careful transactional design in the
  implementation slice.
- Existing migration-history drift means broad linked `db push` remains unsafe until
  separately reconciled; future runtime deployment must use controlled migration
  application as Gate A did.


## 31. Planning Review & Fix Log

### Round 1 — material corrections

**P1 — raw TRUNCATE bypass omitted.** Live grants include TRUNCATE for both
`authenticated` and `service_role`. Revoking only INSERT/UPDATE/DELETE would leave a
database-level destructive bypass outside RLS. The plan now requires revocation/testing
of TRUNCATE and intentional cleanup of legacy REFERENCES/TRIGGER grants.

**P1 — producer lane could be self-asserted.** A generic callable command accepting a
lane/namespace as trusted authority would allow one caller class to request another
producer's provenance semantics. The plan now uses one private canonical engine behind
producer-specific authorized wrappers and explicitly denies lane strings as authority.

**P1 — legacy manual canonicalization shape was underspecified.** Gate-A current facts
need a sealed evidence frame, but manual legacy rows lack approved branch provenance. The
plan now requires an empty/unproved sealed frame (correct completion mode, no fabricated
evidence membership), yielding UNATTRIBUTED deterministically.

**P2 — generation CAS was over-applied.** Kiosk ingestion cannot reasonably know a
candidate/evidence generation before every scan. The plan now distinguishes optimistic
workflows based on a prior universe (later P1) from ordinary producer ingestion: both
serialize and advance generation, but only the former must supply an expected generation.

**P2 — bulk compatibility atomicity was too permissive.** A canonical attendance commit
followed by failed `dtr_entries` persistence could leave the current bulk contract
partially saved. The plan now requires the compatibility write in the same DB transaction
unless implementation first proves it independently rebuildable and changes that
disposition through review.

**P2 — idempotency contract lacked mismatch detection.** The durable operation identity
is now explicitly keyed by House + producer namespace + operation ID with a request
fingerprint; same-key/different-input replays fail closed.


### Round 2 — material corrections

**P1 — current JSON kiosk linkage was over-promoted.** GAP-025 explicitly rejects
`metadata.segmentId` as sufficient canonical integrity infrastructure, and DEC-019
requires a trustworthy namespaced opaque source identity plus original occurrence time.
Live evidence shows all 73 linked clock events structurally match House/employee/timestamp
and branch, but only 44/73 carry `clientId`; only 17/37 current system segments have a
stable opaque identity on every required governing observation. The plan now treats the
JSON link only as a migration candidate locator, requires creation of new durable
canonical linkage, establishes only the DEC-019-compliant subset, and leaves the other
system rows fail-closed/UNATTRIBUTED.


### Round 3 — material corrections

**P1 — future manual create violated GAP-025.** The prior draft allowed new manual facts
to stay UNATTRIBUTED because the current UI lacks explicit branch provenance. GAP-025
Section 3.4 already requires every future manual/admin-created fact to explicitly identify
actual attendance branch. The plan now requires a bounded provenance input for new manual
creation while keeping legacy value-only edits UNATTRIBUTED unless a separately governed
location operation establishes provenance.

**P1 — bulk replacement could accidentally invent same-fact identity.** GAP-025 states
employee/date/time similarity and recreated segment IDs do not prove semantic attendance
fact identity. The current bulk save does not carry an approved predecessor mapping. The
plan now defaults bulk replacement to retire old canonical facts + create new facts, with
no provenance inheritance; same-fact revision requires explicit one-to-one predecessor
identity.

**P2 — compatibility bridge lacked one-row uniqueness.** A nullable FK alone would allow
two live `dtr_segments` rows to point to one canonical fact. The plan now freezes a
one-live-compatibility-row-per-canonical-fact uniqueness invariant.

**P2 — operation IDs could still be regenerated on retry.** Manual/bulk initiating flows
must create and retain logical operation IDs before transport/server retries; a fresh UUID
per retry is explicitly not idempotent.

**P2 — kiosk namespace mapping was implicit.** The plan now freezes current online
`clientId` and offline `clientEventId` (forwarded as `clientId`) as one versioned
logical scan identity family, while requiring a new namespace for a future materially
different producer.


### Round 4 — material corrections

**P1 — shared service_role trust was overstated.** A PostgreSQL `service_role` JWT does
not identify which Next.js route performed application-side business authentication. The
plan previously implied producer wrappers could fully solve that distinction in-database.
The revised plan moves bulk attendance writes back to the already authenticated caller
wrapper, keeps manual authenticated, reserves service_role attendance mutation for kiosk
only, and makes repair admin-only. The kiosk wrapper cross-checks active device
House/branch and canonical source identity while the existing server retains token/pepper
verification. This removes the raw service-role bypass without inventing a second token
authority or falsely claiming a compromised service credential is harmless.

**P2 — function EXECUTE defaults were underspecified.** The plan now requires explicit
REVOKE from PUBLIC/anon/authenticated/service_role on the private engine/helpers before
role-specific wrapper grants.


### Round 5 — material correction

**P1 — reverse legacy FK could defeat the compatibility bridge.** Gate-A
`hr_attendance_fact_revisions.dtr_segment_id` is optional but uses
`ON DELETE RESTRICT`. If Gate B populated it while also promising bulk compatibility
row replacement, the canonical history itself could block the delete/recreate path. The
plan now freezes Gate-B-created/backfilled revisions with `dtr_segment_id = NULL` and
uses only the forward `dtr_segments.canonical_fact_id` bridge for mutable compatibility
mapping.
