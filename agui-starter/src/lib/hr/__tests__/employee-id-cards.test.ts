import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { orderEmployeeIdCards } from "@/lib/hr/employee-id-cards";

describe("orderEmployeeIdCards", () => {
  it("sorts by employee code then id", () => {
    const ordered = orderEmployeeIdCards([
      { id: "2", code: "EMP-010" },
      { id: "3", code: "" },
      { id: "1", code: "EMP-002" },
      { id: "0", code: "emp-002" },
    ]);

    assert.deepEqual(ordered.map((item) => item.id), ["3", "0", "1", "2"]);
  });
});
