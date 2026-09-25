# Historical Daily DTR Write P1 — Runtime Implementation

## Status

**RUNTIME CODE + AUTOMATED CHECKS CONVERGED — PREVIEW GATE BLOCKED BY VERCEL DAILY
DEPLOYMENT QUOTA. Controlled UAT is not yet authorized.**

Runtime base:

`develop @ 4830a905061323819996624545e907aad4668680`

Runtime PR:

**#514 — Implement Historical Daily DTR Write P1**

Latest fully reviewed code candidate before this governance-only synchronization:

`189ca2f677d1c3b28ef745edc1620d5448750cc2`

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

## Preview blocker

The final Runtime Preview gate is currently blocked by an external Vercel account quota,
not a code/build failure.

Vercel's PR integration reports:

`Resource is limited - try again in 1 day (more than 100, code:
"api-deployments-free-per-day").`

Earlier superseded Runtime heads produced healthy READY previews, but the exact-head rule
forbids transferring a Preview PASS from an older head to the current Runtime head.
Therefore Runtime **must not** be declared READY FOR CONTROLLED UAT until an exact-current
head Preview is independently built and verified after the quota resets.

Production remains unchanged. No P1 migration has been applied to Production and no
Production feature/behavior has been enabled.

## Exact next action

After the Vercel daily deployment quota resets:

1. obtain an exact-current-head Preview for PR #514;
2. verify Preview READY/SUCCESS and HTTP behavior;
3. inspect warning/error/fatal runtime logs and runtime error clusters;
4. re-fetch PR #514, exact head, changed files, review threads, and CI;
5. only if every exact-head gate remains green, record Runtime convergence as
   **READY FOR CONTROLLED UAT**.

Do not merge PR #514 and do not apply P1 migrations to Production during Runtime.
