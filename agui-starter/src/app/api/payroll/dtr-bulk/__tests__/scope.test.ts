import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasOnlyAccessibleEmployeeIds } from "../route";

const branchLimited = { allowUnassigned: false };

describe("DTR Bulk accessible employee scope", () => {
  it("allows a branch-limited request containing only an allowed employee", () => {
    const employees = new Map<string, string | null>([["allowed", "branch-a"]]);
    assert.equal(hasOnlyAccessibleEmployeeIds(["allowed"], employees, branchLimited), true);
  });

  it("denies missing, unassigned, out-of-scope, and mixed employee sets", () => {
    const employees = new Map<string, string | null>([
      ["allowed", "branch-a"],
      ["unassigned", null],
    ]);
    assert.equal(hasOnlyAccessibleEmployeeIds(["unassigned"], employees, branchLimited), false);
    assert.equal(hasOnlyAccessibleEmployeeIds(["allowed", "unassigned"], employees, branchLimited), false);
    assert.equal(hasOnlyAccessibleEmployeeIds(["missing"], employees, branchLimited), false);
    assert.equal(hasOnlyAccessibleEmployeeIds(["out-of-scope"], employees, branchLimited), false);
  });

  it("preserves unassigned employees for broad house authority", () => {
    const employees = new Map<string, string | null>([["unassigned", null]]);
    assert.equal(hasOnlyAccessibleEmployeeIds(["unassigned"], employees, { allowUnassigned: true }), true);
  });
});
