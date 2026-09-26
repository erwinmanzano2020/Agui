# Historical Daily DTR Write P1 — Runtime Implementation

## Status

**CONTROLLED UAT + FINAL RELEASE REVIEW CONVERGED — READY FOR OWNER RELEASE APPROVAL.
Production remains unchanged and no merge/release is authorized until the owner explicitly
approves the exact release actions.**

Runtime base:

`develop @ 4830a905061323819996624545e907aad4668680`

Runtime PR:

**#514 — Implement Historical Daily DTR Write P1**

Latest fully reviewed Runtime code candidate before this governance-only synchronization:

`6ba5f6f69423a9cbe64bae58c0ff8754471c4eaa`

Approved planning authority:

`docs/devlog/historical-daily-dtr-write-p1-implementation-plan.md`

This Runtime task implements only the owner-approved Historical Daily DTR Write P1
contract. Production rollout is not authorized by Runtime convergence alone.

## Runtime authorization verified

- PR #513 planning contract was explicitly owner-approved on 2026-09-25.
- PR #513 was squash-merged as
  `4830a905061323819996624545e907aad4668680`.
- `develop` was verified to point exactly at that merge before Runtime began.
- Gate-A canonical authority and Gate-B pre-P1 containment are already released.
- OD-P1-01 Option A+ is frozen.
- Runtime continues in the single authorized Draft PR #514; no duplicate Runtime PR was
  created.

## Implemented Runtime scope

The current Runtime branch implements:

- immutable P1 correction/remediation cases plus append-only lifecycle events;
- exact-fact write authorization through a private resolver aligned to Gate-A protected
  canonical readers;
- narrow authenticated correction/remediation RPC wrappers plus private P1 finalization
  primitives;
- Gate-B House+employee advisory serialization and existing operation-ledger idempotency;
- OD-P1-01 Option A+:
  - ordinary manual-create is current Asia/Manila business-date only for all callers;
  - past existing visible facts use correction;
  - past missing attendance uses owner/manager DEC-018 remediation;
  - future ordinary create/remediation fails closed;
- legacy immediate-update RPC cutover so authenticated callers cannot bypass P1
  proposal/finalization;
- conservative payroll-impact classification and fail-closed HR-4 dependency behavior;
- bounded Daily DTR correction/remediation UI using canonical facts rather than legacy
  segment IDs;
- canonical-reader pagination so more than 200 visible facts are not silently omitted;
- historical fact rendering independent of the employee's current roster assignment;
- generated database types;
- static/action tests plus a real independent-session PostgreSQL P1 contract/concurrency
  harness;
- preservation of the released Gate-B concurrency/no-bypass suite.

Explicit non-scope remains unchanged from the approved planning artifact.

## Runtime Review & Fix Log

### Round 1 — initial exact-head CI failures

Initial Runtime head
`c8b0ecb90e0c61c8dda5eccc8ab47f789901d998` exposed three bounded defects:

1. **P2 — validation/revalidation test behavior.**
   The action test expected multiple Zod issues from one malformed request and compiled
   Node tests had no real Next cache revalidation runtime.
   Fixed by deterministic validation assertions and a test-safe DTR revalidation helper.

2. **P2 — Gate-A reader regression rule was stale.**
   The historical test prohibited every production Gate-A reader call even though the
   approved P1 server adapter must consume the protected canonical reader.
   Fixed by allowing exactly the approved `attendance-p1-server.ts` adapter and no other
   production caller.

3. **P1 — P1 DB harness called intentionally private authorization helpers as
   `authenticated`.**
   That confused private-helper inaccessibility with application behavior.
   Fixed by asserting those helpers remain non-executable while driving behavior only
   through public wrappers.

### Round 2 — no-leak / idempotency review

Fresh review found:

1. **P1 — hidden correction-case finalization could create an operation-ledger oracle.**
   A guessed case ID was able to reach retry-ledger creation before exact-fact visibility
   was re-established.
   Fixed by resolving the underlying fact through the private exact-fact authorization
   boundary before locks/ledger persistence and re-resolving again after serialization.
   The DB harness now proves hidden proposal/finalization attempts collapse to
   `TARGET_UNAVAILABLE` and create no useful operation record.

2. **P1 — the test scalar helper rolled back mutation RPCs.**
   The harness captured IDs from transactions that were then rolled back, producing false
   downstream failures.
   Fixed by committing mutation RPC helper calls; read-only assertions remain separate.

3. **P1 — UI retry operation IDs changed after any action-state transition.**
   A failed/partial attempt could receive a fresh operation ID on retry and lose the
   server's idempotency key.
   Fixed by retaining operation IDs across errors and rotating them only after success.

### Round 3 — completeness / temporal-boundary review

Fresh review found:

1. **P2 — canonical Daily DTR reads stopped after 200 facts.**
   The 201st+ visible fact could lose its correction control.
   Fixed with bounded pagination and a 201-row regression test.

2. **P1 — same-day missing employee lookup had a distinguishable not-found response.**
   Fixed by normalizing it to the same generic authorization response as an out-of-scope
   target.

3. **P1 — DEC-018 remediation accepted current/future dates and future UI exposed the
   remediation form.**
   Fixed at both database and server/UI boundaries: remediation is past-date only and
   future attendance creation/remediation fails closed.

### Round 4 — approval-base / historical-visibility review

Fresh review found:

1. **P1 — future HR-4 remediation approval was not bound to the latest adjudicated
   candidate universe.**
   Fixed by binding the HR-4 proposal fingerprint to the immutable proposal plus the
   latest adjudication resolver version, digest, and candidate generation. The DB harness
   models an approved provider and proves the stored decision reference matches that exact
   reviewed base.

2. **P1 — correction UI visibility could depend on the employee's current roster.**
   A historically visible canonical fact could disappear after the employee moved current
   branches.
   Fixed by separately rendering canonical facts that are authorized by historical
   attendance attribution but absent from the current roster; current assignment is not
   treated as historical provenance.

### Round 6 — independent correction-staleness review

Fresh review against the owner-approved plan found one **P1 correctness defect** in the
previous Runtime candidate: correction finalization treated value CAS and semantic
evidence-basis state as universal dependencies for every correction kind. That could
falsely stale a value-only correction after an unrelated location/evidence change, or
falsely stale a location-only correction after an unrelated value change.

Fixed by:

- making the private P1 finalization primitive explicit about
  `CORRECTION_VALUE | CORRECTION_LOCATION | CORRECTION_COMBINED`;
- validating only the approved dependency base for each correction kind;
- recomputing correction shape from immutable base/proposed snapshots rather than
  unrelated current-state differences;
- preserving the newest non-dependent current state when finalizing; and
- adding real DB-harness proofs in both directions:
  value-only survives an unrelated evidence-basis change, and location-only survives an
  unrelated value-revision change.

Replacement exact code head:
`6ba5f6f69423a9cbe64bae58c0ff8754471c4eaa`.

At that head, Preflight #922, Gate B DB Concurrency #60, and P1 Historical DTR DB
Concurrency #48 all passed; exact-head Vercel Preview reached READY; HTTP 200 and runtime
log/error checks were clean. A fresh post-fix review found no additional material
P0/P1/P2 defect in the approved slice.

### Round 5 — final code-head review

Fresh adversarial review of code candidate
`189ca2f677d1c3b28ef745edc1620d5448750cc2` found no additional material P0/P1/P2
implementation defect in the approved P1 scope after the fixes above.

At that exact code head:

- **Preflight #917: SUCCESS**
  - npm install
  - lint
  - typecheck
  - Next.js build
  - compiled Node tests
- **Gate B DB Concurrency #55: SUCCESS**
- **P1 Historical DTR DB Concurrency #43: SUCCESS**
- PR #514 remained mergeable with zero material review threads.

## Exact-head Preview verification

The former Vercel daily deployment-quota blocker cleared during this Runtime convergence
run. Exact code head `6ba5f6f69423a9cbe64bae58c0ff8754471c4eaa` produced Preview deployment
`dpl_7peikcDme8hiTVQ7xJg6Mrt7EtPd`, which reached **READY**.

Verification on that exact code head:

- Preview root returned HTTP 200 through the expected unauthenticated welcome path;
- checked Preview warning/error/fatal runtime logs were empty;
- checked runtime error clusters were empty;
- Preflight #922: SUCCESS;
- Gate B DB Concurrency #60: SUCCESS;
- P1 Historical DTR DB Concurrency #48: SUCCESS;
- PR #514 remained mergeable with zero material review threads.

Production remains unchanged. No P1 migration has been applied to Production and no
Production feature/behavior has been enabled.

## Controlled UAT convergence — 2026-09-26

Controlled UAT ran only against the isolated `agui-p1-uat` Supabase project
(`ectzbcijqhegoamtaqgo`); Production remained on the released Gate-B pre-P1 migration
set.

Focused acceptance evidence:

- existing-fact location correction: **PASS / FINALIZED**;
- owner/manager remediation candidate review: **PASS**;
- distinct-new path: **PASS / FAIL-CLOSED** — adjudication reached
  `ADJUDICATED_DISTINCT`, finalization returned
  `APPROVAL_DEPENDENCY_UNAVAILABLE`, and no resulting fact was created;
- stale/retry path: **PASS after Review & Fix**.

The stale/retry UAT exposed one P1 client defect: after a correct `STALE` response, the
client reused the consumed remediation operation identity and required a manual
Distinct → Existing toggle. Runtime fixes now:

- rotate operation identities after `STALE` as well as success;
- reset the remediation decision from the refreshed candidate universe; and
- cover both behaviors with regression tests.

The exact tested code head is
`97a3370ea56209b66fb936806da7532671a788bb`. Its stale retry used a new operation
identity and durably recorded `ADJUDICATED_EXISTING` then `FINALIZED` with route
`CORRECTION`; no duplicate/new fact was created.

Final UAT log review also found disposable-UAT identity-enum drift
(`entity_identifier_type` lacked Production's lowercase `email` and `auth_uid`
labels). The temporary UAT project was brought to Production enum parity only. No
Production schema or PR product-code change was made by that environment correction.

Exact-head evidence before this governance-only synchronization:

- Preflight #928: SUCCESS;
- Gate B DB Concurrency #66: SUCCESS;
- P1 Historical DTR DB Concurrency #54: SUCCESS;
- Vercel deployment `dpl_8otsaBaMnhnoQH9qNDGaXSEEKG9F`: READY;
- stable Preview alias resolved to that exact head;
- material review threads: zero.

The governance-only synchronization after UAT does not invalidate the focused runtime UAT;
it requires the normal new-head CI/Preview/final release review before owner approval.

## Final exact-head release review — 2026-09-26

The governance-synchronized candidate completed a fresh release review with no new
material P0/P1/P2 finding.

Verified before this final governance-only status sync:

- PR #514 exact head `ec066165df534023af75e91571904fd1baa33407` was open, Draft,
  mergeable, and had zero material review threads;
- Preflight #931: SUCCESS;
- Gate B DB Concurrency #69: SUCCESS;
- P1 Historical DTR DB Concurrency #57: SUCCESS;
- exact-head Vercel Preview `dpl_7juRMyHaFSpLeBM6QYBznwrA87Eu`: READY;
- GitHub Vercel status: SUCCESS;
- Preview root: HTTP 200;
- authenticated Daily DTR refresh returned HTTP 200 on
  `/company/p1-uat-house/hr/dtr`;
- the authenticated log window contained no `auth_uid` or
  `entity_identifier_type` warning and no warning/error/fatal entry;
- Preview remained bound to isolated UAT Supabase
  `ectzbcijqhegoamtaqgo`;
- Production migration history still ended at released Gate-B pre-P1 containment, and
  P1 correction/remediation tables/RPCs were absent from Production.

UAT advisor findings were reviewed against Production and the approved migration/grant
contract. The P1 case/event tables intentionally use RLS plus revoked direct table
privileges, and the narrow authenticated SECURITY DEFINER wrappers intentionally expose
only the approved correction/remediation commands with fixed search paths. Broader
pre-existing Production advisor debt remains outside this P1 slice and is not represented
as newly introduced P1 release debt.

The final documentation sync is governance-only and does not invalidate the exact tested
runtime/UAT behavior. It requires only the normal exact-head CI/Preview verification before
the owner release action is executed.

## Exact next action

Stop at the explicit owner release gate. After owner approval, re-fetch the exact PR head,
verify no drift, squash-merge PR #514, apply only the three unapplied P1 migrations in the
approved order, verify grants/RPCs/schema cache, deploy the exact merge build to Production,
and execute the approved post-deploy verification sequence.
