import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildEmployeePhotoPath, getEmployeePhotoObjectKey } from "@/lib/hr/employee-photo";

describe("employee photo path helpers", () => {
  it("builds canonical photo path for an employee id", () => {
    assert.equal(
      buildEmployeePhotoPath("00000000-0000-4000-8000-000000000999"),
      "employee-photos/00000000-0000-4000-8000-000000000999.jpg",
    );
  });

  it("normalizes object key input", () => {
    assert.equal(getEmployeePhotoObjectKey("employee-photos/emp-1.jpg"), "employee-photos/emp-1.jpg");
    assert.equal(getEmployeePhotoObjectKey("emp-1"), "employee-photos/emp-1.jpg");
  });
});
