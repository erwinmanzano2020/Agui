import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getEmployeeIdPhotoStatus, normalizeEmployeePhotoUrl, orderEmployeeIdCards } from "@/lib/hr/employee-id-cards";

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

describe("employee ID photo URL normalization", () => {
  it("normalizes valid photo URLs", () => {
    assert.equal(
      normalizeEmployeePhotoUrl(" https://example.com/photo.jpg "),
      "https://example.com/photo.jpg",
    );
  });

  it("returns null for invalid or unsupported URLs", () => {
    assert.equal(normalizeEmployeePhotoUrl(""), null);
    assert.equal(normalizeEmployeePhotoUrl("not-a-url"), null);
    assert.equal(normalizeEmployeePhotoUrl("file:///tmp/photo.jpg"), null);
  });

  it("derives a stable photo status", () => {
    assert.equal(getEmployeeIdPhotoStatus(""), "missing");
    assert.equal(getEmployeeIdPhotoStatus("not-a-url"), "invalid_url");
    assert.equal(getEmployeeIdPhotoStatus("https://example.com/photo.jpg"), "ready");
  });
});
