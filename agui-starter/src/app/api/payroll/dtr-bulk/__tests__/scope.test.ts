import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasOnlyAccessibleEmployeeIds } from "../route";

describe("DTR Bulk accessible employee scope", () => {
  it("rejects a caller set containing any out-of-scope employee id", () => {
    const accessible = new Map<string, string | null>([["employee-a", "branch-a"]]);
    assert.equal(hasOnlyAccessibleEmployeeIds(["employee-a"], accessible), true);
    assert.equal(hasOnlyAccessibleEmployeeIds(["employee-a", "employee-b"], accessible), false);
    assert.equal(hasOnlyAccessibleEmployeeIds(["employee-b"], accessible), false);
  });
});
