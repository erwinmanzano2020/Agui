# GAP-024 Gate C — Canonical Daily DTR Runtime

## Status

**RUNTIME + CONTROLLED UAT CONVERGED — OWNER RELEASE APPROVAL NEXT. Production unchanged.**

Validated Runtime head:
`7dc72c91900e3727193fc145bd875e2275cdda3c`.

Exact-head evidence:
- Preflight #1036 PASS;
- Gate B DB Concurrency #130 PASS;
- P1 Historical DTR DB Concurrency #118 PASS;
- Remaining Gate B DB Closure #60 PASS;
- Vercel exact-head deployment `dpl_76HqGYuFvgP5FVkjexNxhP6RC3we` READY;
- PR #520 mergeable;
- unresolved GitHub review threads: 0;
- Preview warning/error/fatal logs during human UAT: none.

Controlled UAT:
- live Preview no-write read-surface matrix: PASS;
- isolated `agui-p1-uat` same-day manual create contract: PASS;
- isolated historical remediation open/adjudicate flow: PASS;
- HR-4 payroll-impacting finalization fail-closed boundary:
  `APPROVAL_DEPENDENCY_UNAVAILABLE` as expected;
- no live VVS attendance write was performed.

Base: owner-approved Gate C planning squash merge
`bd90af64eafe1ca5204c47da05dbc0e10a829679`.

Current Runtime head at initial implementation checkpoint:
`c6e8304d7409fff6113569c14e116afa829ee9f0`.

## Implemented boundary

- Daily DTR attendance result rows now originate only from the released canonical attendance
  readers through a dedicated HR **read** access decision.
- HR **write** access is resolved separately and controls correction/capture/remediation
  affordances only.
- The result surface no longer uses raw `dtr_segments`, active-roster cards,
  schedule/overtime derivation, or compatibility/debug rows as attendance authority.
- Employee names/codes are enriched only after the canonical reader establishes the
  authorized fact employee IDs.
- Arbitrary employee filter IDs are ignored unless already present in the visible
  canonical result.
- P1 existing-fact corrections remain on the proposal/finalization path.
- Option A+ same-day manual capture is preserved as a separate current-write workflow using
  current HR write scope and explicit actual-attendance branch.
- Owner/manager historical missing-attendance remediation remains a separate DEC-018
  workflow and is not inferred from missing result rows.

## Runtime file surface

- `agui-starter/src/app/company/[slug]/hr/dtr/page.tsx`
- `agui-starter/src/app/company/[slug]/hr/dtr/view-model.ts`
- `agui-starter/src/app/company/[slug]/hr/dtr/__tests__/view-model.test.ts`
- `agui-starter/src/lib/hr/employees-server.ts`

No migration, new RPC, RLS/grant change, role/capability change, payroll semantic change,
Gate D/E consumer migration, POS, Operations, or Finance work is included.

## Review & Fix checkpoint

Initial focused review verified:

- read/write authority is separated;
- branch-limited correction requires visible ATTRIBUTED fact + allowed write branch;
- read-only visible facts do not receive mutation controls;
- same-day capture target display is independent of hidden attendance existence;
- raw compatibility data does not decide result visibility/counts/cards;
- historical remediation remains owner/manager only;
- correction still uses P1 proposal/finalization;
- explicit actual-attendance branch remains required for manual capture.

No surviving material Runtime finding has been identified at this checkpoint.

## Checks

Exact initial Runtime head checks are currently running:

- Preflight #1031;
- Gate B DB Concurrency #125;
- P1 Historical DTR DB Concurrency #113;
- Remaining Gate B DB Closure #55;
- Vercel exact-head Preview.

Runtime is not converged and no Production release is authorized until all required checks,
fresh review, Controlled UAT, and the release gate complete.


## Release readiness

Fresh release review after UAT found no new material P0/P1/P2 issue. Gate C Runtime and
Controlled UAT are converged. The next gate is explicit owner release approval for PR #520.

That approval may authorize squash-merge to `develop` and exact-merge deployment /
Production verification only. It does not authorize Gate D/E or unrelated scope.

### UAT environment security debt

The isolated `agui-p1-uat` fixture has pre-existing support tables with RLS disabled.
This was surfaced during UAT, was not changed by Gate C, and is not part of PR #520.
Do not enable RLS blindly: the UAT fixture needs explicit policies before any remediation.
