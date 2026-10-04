import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { HrBranchAccessDecision } from "@/lib/hr/access";
import type { CanonicalAttendanceRow } from "@/lib/hr/attendance-p1-server";
import type { EmployeeListItem } from "@/lib/hr/employees-server";
import {
  applyCanonicalEmployeeFilter,
  canCaptureCurrentEmployee,
  canCorrectCanonicalFact,
  canonicalEmployeeIds,
  groupCanonicalAttendance,
} from "../view-model";

function fact(overrides: Partial<CanonicalAttendanceRow> = {}): CanonicalAttendanceRow {
  return {
    fact_id: "fact-1",
    employee_id: "emp-1",
    work_date: "2026-10-03",
    time_in: "2026-10-03T00:00:00Z",
    time_out: null,
    hours_worked: null,
    overtime_minutes: 0,
    status: "open",
    attribution_state: "ATTRIBUTED",
    active_branch_id: "branch-1",
    has_finalized_correction: false,
    ...overrides,
  };
}

function access(overrides: Partial<HrBranchAccessDecision> = {}): HrBranchAccessDecision {
  return {
    allowed: true,
    allowedByRole: false,
    allowedByPolicy: true,
    hasWorkspaceAccess: true,
    roles: ["staff"],
    normalizedRoles: ["staff"] as never,
    policyKeys: ["tiles.hr.read", "domain.hr.all", "hr.branch.branch-1"],
    entityId: "entity-1",
    branchId: null,
    isBranchLimited: true,
    allowedBranchIds: ["branch-1"],
    ...overrides,
  };
}

function employee(overrides: Partial<EmployeeListItem> = {}): EmployeeListItem {
  return {
    id: "emp-1",
    house_id: "house-1",
    code: "E001",
    entity_id: "entity-1",
    full_name: "Employee One",
    status: "active",
    branch_id: "branch-1",
    branch_name: "Branch One",
    rate_per_day: 450,
    ...overrides,
  };
}

describe("Gate C Daily DTR view model", () => {
  it("derives result employee identities only from visible canonical facts", () => {
    const rows = [
      fact(),
      fact({ fact_id: "fact-2", employee_id: "emp-2" }),
      fact({ fact_id: "fact-3", employee_id: "emp-1" }),
    ];

    assert.deepEqual(canonicalEmployeeIds(rows), ["emp-1", "emp-2"]);
    assert.equal(groupCanonicalAttendance(rows).get("emp-1")?.length, 2);
  });

  it("ignores arbitrary hidden employee filters instead of creating an existence oracle", () => {
    const rows = [fact()];
    const result = applyCanonicalEmployeeFilter(rows, "hidden-employee");

    assert.equal(result.selectedEmployeeId, "");
    assert.deepEqual(result.rows, rows);
  });

  it("filters only after the employee is already present in the visible canonical result", () => {
    const rows = [fact(), fact({ fact_id: "fact-2", employee_id: "emp-2" })];
    const result = applyCanonicalEmployeeFilter(rows, "emp-2");

    assert.equal(result.selectedEmployeeId, "emp-2");
    assert.deepEqual(result.rows.map((row) => row.fact_id), ["fact-2"]);
  });

  it("separates readable facts from write eligibility", () => {
    assert.equal(canCorrectCanonicalFact(fact(), access({ allowed: false })), false);
    assert.equal(
      canCorrectCanonicalFact(
        fact({ active_branch_id: "branch-2" }),
        access({ allowedBranchIds: ["branch-1"] }),
      ),
      false,
    );
    assert.equal(
      canCorrectCanonicalFact(
        fact({ attribution_state: "UNATTRIBUTED", active_branch_id: null }),
        access(),
      ),
      false,
    );
    assert.equal(canCorrectCanonicalFact(fact(), access()), true);
    assert.equal(
      canCorrectCanonicalFact(
        fact({ attribution_state: "UNATTRIBUTED", active_branch_id: null }),
        access({ allowedByRole: true, isBranchLimited: false }),
      ),
      true,
    );
  });

  it("uses current branch only for same-day capture eligibility", () => {
    assert.equal(canCaptureCurrentEmployee(employee(), access()), true);
    assert.equal(
      canCaptureCurrentEmployee(employee({ branch_id: "branch-2" }), access()),
      false,
    );
    assert.equal(
      canCaptureCurrentEmployee(employee({ branch_id: null }), access()),
      false,
    );
    assert.equal(
      canCaptureCurrentEmployee(
        employee({ branch_id: null }),
        access({ allowedByRole: true, isBranchLimited: false }),
      ),
      true,
    );
  });
});
