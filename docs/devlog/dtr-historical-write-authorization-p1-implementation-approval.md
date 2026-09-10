# Historical Daily DTR Write Authorization P1 — Implementation Approval

## 1. Purpose and status

**Status: Implementation Approval Only**

This record approves exactly one future bounded urgent Foundation Security Correction:
historical Daily DTR write authorization. It freezes that correction's boundary but does
not implement code, schema, migration, RLS, grants, RPCs, APIs, repositories, UI, tests,
generated types, database operations, or runtime.

The risk was recorded as the P1 adjacent finding in the merged
[GAP-024 plan](./gap-024-daily-dtr-branch-enforcement-plan.md): affected write-target
resolution paths use current employee branch state, although a person's current branch
does not prove authority to mutate a historical attendance fact from another event-time
branch. The owner separately authorized this correction on 2026-09-10.

## 2. Exact approved boundary

The future P1 runtime task must freeze and enforce all of these rules:

- current `employee.branch_id` is not historical attendance ownership;
- current employee branch assignment cannot independently authorize historical mutation;
- requested-house authorization must be valid first, before branch restriction is
  evaluated;
- branch-limited mutation authority must derive from the canonical historical attendance
  fact and applicable GAP-025 evidence;
- **UNATTRIBUTED** or **CONFLICT** must fail closed for branch-limited mutation unless a
  separately authorized correction/finalization contract permits resolution;
- existing owner/manager house-wide authority remains unchanged;
- no cross-house access is permitted;
- no identity contract changes are permitted;
- no payroll computation changes are permitted;
- no unrelated Daily DTR read implementation is permitted; and
- no GAP-024 Option D projection implementation is permitted in the P1 runtime PR unless
  an approved dependency explicitly requires it and it is separately authorized.

The future correction must preserve GAP-025 temporal attribution, House tenancy,
owner/manager authority, and scope-first/no-leak behavior. When historical branch
authority cannot safely be established, it must fail closed without disclosing hidden
out-of-scope branch, source, record, existence, count, or audit metadata.

## 3. Required future focused verification

The separately tasked runtime PR must add focused positive and negative-path tests for:

1. an employee moved from P3 to Main after historical attendance at P3;
2. current Main assignment does not authorize a Main-limited actor to edit the prior P3
   fact;
3. a prior P3-limited actor cannot edit a current Main fact merely because the employee
   used to be assigned to P3;
4. **UNATTRIBUTED** and **CONFLICT** fail closed;
5. zero allowed branch scope denies;
6. a cross-house target denies;
7. legitimate owner/manager house-wide behavior is preserved; and
8. denial does not leak hidden out-of-scope branch metadata.

These are future implementation requirements. This documentation approval adds no tests.

## 4. Separation from GAP-024 Option D

This P1 is independently bounded and must receive a separate future Codex task and PR.
It is the recommended first runtime priority after the governance approval merges, but
it must not be bundled into GAP-024 Gate A or any other Option D read/projection slice to
reduce PR count.

After the separate P1 correction, the ordered GAP-024 Option D gates may proceed under
their own
[Implementation Approval](./gap-024-daily-dtr-branch-enforcement-implementation-approval.md).
This P1 authorization neither implements nor accelerates those gates.

## 5. Non-change and risk statement

- **Changed:** governance authorizes one future correction to historical Daily DTR
  mutation authorization and freezes its fail-closed test boundary.
- **Not changed:** no runtime or test is implemented; no schema, migration, RLS, grant,
  RPC, API, repository, UI, generated type, payroll computation, identity, read-path,
  GAP-024 projection, POS, Operations, or Finance behavior changes.
- **Risk checked:** house authorization precedes branch restriction, current assignment
  cannot rewrite historical authority, ambiguous historical facts deny branch-limited
  mutation, cross-house access denies, owner/manager authority is preserved, and denial
  cannot leak hidden metadata.
