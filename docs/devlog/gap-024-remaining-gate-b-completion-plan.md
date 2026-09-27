# GAP-024 Remaining Gate B Completion Planning

**Planning phase only. No runtime/product behavior, database mutation, merge, or deployment is implemented by this document.**

## 0. Planning identity and durable baseline

- Project: **Agui**
- Repository: `erwinmanzano2020/Agui`
- Active system phase: **HR System — end-to-end MVP / Foundation Security Correction**
- Active GAP-024 sequence: **Gate A → Gate B → Gate C → Gate D → Gate E**
- Current bounded target: **Remaining Gate B**
- Planning base: `develop` at
  `a95c3c921e067297f4f033620fe2f4ede7e7c5aa`
  (Historical Daily DTR Write P1 squash merge, PR #514)
- Hosted planning PR: **#515 — Plan GAP-024 Remaining Gate B completion**
- Planning branch: `codex/plan-gap-024-remaining-gate-b`
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

No current open PR was found for Remaining Gate B, so this is the first planning pass for
this bounded target.

## 1. Objective

Close the owner-approved **Remaining Gate B** obligation by proving, against the exact
post-P1 system, that canonical attendance authority is complete, deterministic,
non-bypassable, producer-compatible, replay/idempotency-safe, and ready for the later
Gate C read cutover.

This is deliberately a **verification/closure-first slice**.

Current repository and Production evidence already show the pre-P1 containment runtime
performed the canonical bootstrap/backfill and producer migration. Therefore this plan
does **not** presume another schema migration, another data backfill, or another product
behavior change is needed. The future verification Runtime must first prove the existing
released mechanisms satisfy the Remaining Gate-B acceptance contract.

If that exact-head proof exposes a concrete producer/runtime defect, execution must stop
and return to planning rather than silently broadening this closure slice.

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
| Kiosk event/device telemetry | `src/lib/hr/kiosk/repository.ts` | auxiliary event + device timestamp writes; must remain database-disjoint from canonical attendance mutation |
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

The future Remaining Gate-B verification Runtime may change **tests, CI verification, and
governance evidence only** unless this plan is explicitly reopened.

It must:

1. re-inventory every active attendance writer at the exact Runtime head;
2. classify each as:
   - canonical command producer;
   - P1 correction/remediation producer;
   - database-disjoint auxiliary writer; or
   - blocker;
3. run the complete scoped Gate-A + Gate-B + P1 migration chain on a disposable database;
4. prove bootstrap/backfill/reconcile idempotency against representative legacy
   manual/system fixtures;
5. prove projection rebuild determinism from the resulting durable authority;
6. prove all command producers immediately leave canonical facts/revisions/frames and
   projection coherent;
7. prove replay/same-operation retry returns one logical result;
8. prove same-operation/different-input fails closed;
9. prove multi-session races do not produce raw-only, duplicate, or stale-visible facts;
10. prove P1 correction/remediation preserves the same canonical/projection invariants;
11. prove current direct table/RPC grants still prevent mutation bypass;
12. prove canonical branch/global readers observe only their approved state;
13. compare read-only Production counts/grants/migration history before closure;
14. record an explicit Remaining Gate-B completion/blocked verdict.

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
- a new migration merely to mark Gate B complete.

## 8. Existing contracts consumed

### Manual/admin

Request authority remains House-first and branch-restricted. Explicit actual branch is
required for established manual provenance. Current-day ordinary create uses
`hr_create_manual_attendance`. Historical existing facts use P1 correction; historical
missing attendance uses owner/manager remediation.

### Kiosk

The service derives device House/branch from the authenticated device, uses stable
`clientId` / offline `clientEventId` as operation identity, and calls
`hr_apply_kiosk_attendance_scan`. Exact retries must be idempotent. Auxiliary
`hr_kiosk_events` logging and device last-event timestamps are not an alternate
attendance-fact writer and must be proven database-disjoint.

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

**None planned.**

Remaining Gate B is not a new product/backend contract. It verifies the released
Gate-A/Gate-B/P1 contracts together.

If Runtime proof demonstrates that a currently active producer cannot satisfy the frozen
contract without a backend/schema change, the slice is blocked and must return to
planning. Do not improvise a new RPC, table, privilege, attribution rule, or mutation
lane inside the verification PR.

## 10. Data / store impact

### Authoritative operational state

No new authoritative state is planned.

Existing canonical attendance tables and P1 case/event tables remain authoritative.

### Convenience / compatibility state

`dtr_segments` and `dtr_entries` remain compatibility surfaces. Their existing
bridging/atomic compatibility behavior must be verified, not redefined.

### Audit / telemetry state

`hr_attendance_mutation_operations` remains the durable operation-idempotency ledger.
Kiosk event/device telemetry remains auxiliary and must not acquire attendance authority.

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
- public/anon cannot call canonical mutation wrappers;
- authenticated can call only the approved authenticated wrappers;
- kiosk service_role can call only the approved kiosk mutation wrapper among ordinary
  producer commands;
- maintenance repair remains unavailable to normal application roles;
- private producer/P1 helpers remain non-callable;
- P1 case tables have no direct authenticated mutation lane;
- canonical readers preserve branch-limited versus house-global behavior.

## 16. Operational writes

No new operational write is introduced.

The test harness may write only to an isolated disposable Supabase/PostgreSQL database.

Production verification remains read-only.

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

Future Runtime should extend existing tests rather than create parallel architecture.

Minimum static assertions:

- repository writer inventory includes all exact-head producer paths;
- no application code performs raw `dtr_segments`/`dtr_entries` mutation;
- current wrappers and intended grants remain frozen;
- P1 immediate-update bypass remains retired;
- timezone repair remains command-only;
- legacy browser attendance writers remain retired;
- Daily DTR/payroll raw **reads** are explicitly recognized as later Gate C/D scope, not
  misclassified as Gate-B writer failures.

## 25. Integration / backend tests

Do **not** fork a third independent attendance fixture/harness that can drift from the
already released Gate-B and P1 proofs.

The preferred implementation is one closure workflow that:

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
6. executes the existing Gate-B concurrency harness;
7. executes the existing P1 concurrency harness using its distinct fixture IDs/state;
8. runs a **small Remaining-Gate-B closure verifier** for only the missing cross-slice
   assertions: full bridge coverage, semantic rebuild determinism, reader parity,
   operation/grant no-bypass posture, and auxiliary-writer disjointness.

This ordering matters: seeding all representative “legacy” rows only **after** the
reconcile migration would not test backfill at all and would produce a false Gate-B
closure proof.

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

## 26. Production-shaped baseline verification

Before release approval, read-only Production checks must confirm:

- expected Gate-A/Gate-B/P1 migration history;
- `dtr_segments total = linked`;
- active facts = current projection rows;
- no active fact missing a current projection;
- no unbridged compatibility segment;
- no direct app-role raw DTR mutation privilege;
- canonical wrapper/grant/search_path posture;
- P1 case/event table RLS and direct-DML denial;
- no unexpected ATTRIBUTED/UNATTRIBUTED/CONFLICT transition since planning baseline;
- Vercel Production still serves the intended released application baseline before any
  separate later cutover.

A changed count is not automatically an error if legitimate attendance has occurred.
Verification must compare relational invariants, not freeze business row counts forever.

## 27. Preview / staging UAT

Because this slice plans no user-visible behavior, human UAT is not mandatory solely to
repeat already-proven P1 UI workflows.

Preview/staging verification should instead prove:

- exact-head build/checks are green;
- no new product route/UI behavior is introduced;
- disposable DB integrated harness passes;
- Preview root/smoke remains healthy if Vercel builds the verification PR;
- runtime logs contain no new warning/error/fatal condition attributable to the slice.

If Runtime unexpectedly changes product behavior, this UAT contract is invalid and
planning must reopen.

## 28. Production verification

No synthetic operational write is required.

At closure:

- re-fetch Production application deployment;
- inspect recent warning/error/fatal logs;
- run the read-only database invariant/grant checks in Section 26;
- confirm no migration/product deployment was required by this verification-only slice;
- record exact evidence and Gate-B completion status.

## 29. Deployment / data deployment sequence

Planned sequence for the future verification Runtime:

1. branch from then-current `develop`;
2. add/extend only verification tests/workflow and governance evidence;
3. run Review & Fix to exact-head convergence;
4. run scoped integrated disposable DB proof;
5. build/Preview check if automatically applicable;
6. perform read-only Production baseline comparison;
7. request owner release approval;
8. merge the verification/closure PR only after approval;
9. **do not apply a Production migration** unless planning has been reopened;
10. **do not promote a new Production application artifact merely for test/docs-only
    changes**;
11. re-check Production health/read-only invariants;
12. record Remaining Gate B closed;
13. leave Gate C unauthorized until the owner separately approves its planning/runtime
    progression.

## 30. Cleanup

Future Runtime must:

- leave no disposable test data outside the isolated DB;
- stop the disposable Supabase stack;
- keep no temporary rollout flag;
- introduce no UAT account/device into Production;
- retain no stale test-only RPC/grant in product migrations;
- update only durable status/roadmap records needed to express Gate-B closure.

## 31. Rollback / kill switch

No new Production behavior means there is no new product kill switch.

If verification exposes a defect:

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
2. every writer is command-compatible or database-disjoint;
3. integrated Gate-A/Gate-B/P1 migration replay succeeds;
4. representative legacy bootstrap/backfill is deterministic and idempotent;
5. every test producer leaves canonical authority + projection coherent;
6. P1 correction/remediation maintains the same invariants;
7. replay/idempotency mismatch tests pass;
8. real independent-session race tests pass;
9. deterministic rebuild reproduces identical current authority;
10. branch/global canonical reader assertions pass;
11. insufficient/conflicting provenance fails closed;
12. direct authenticated/service-role raw DTR mutation remains denied;
13. private helpers remain private;
14. no active fact lacks current projection;
15. no compatibility row is unbridged;
16. no active producer can create raw-only/projection-invisible attendance;
17. no Gate C/D/E behavior was pulled forward;
18. exact-head CI is green;
19. material review threads = 0;
20. current Roadmap/HR status and detailed plan agree;
21. read-only Production verification has no blocker.

## 33. Governance / authorization boundary

This planning PR may define and refine only Remaining Gate-B verification/closure.

It does not:

- implement the future Runtime;
- mark Remaining Gate B complete;
- merge itself;
- authorize Gate C;
- authorize any Production mutation;
- resume POS or another system phase.

After this plan converges, the only next action is explicit owner approval of the planning
contract. A later bounded verification Runtime PR is required.

## 34. Deferred work

Explicitly deferred:

1. Gate C canonical Daily DTR facts-only read cutover;
2. Gate D all-consumer read migration/disposition;
3. Gate E final broad raw/base-access cutover;
4. HR-4 approval product implementation;
5. GAP-026;
6. unrelated HR/POS/Operations/Finance work.

## 35. Initial residual risks to carry into Runtime

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

Fresh review is required on the replacement exact head.
