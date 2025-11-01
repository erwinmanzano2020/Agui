import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeIdentifier } from "../entity";

describe("normalizeIdentifier", () => {
  it("normalizes email", () => {
    assert.equal(
      normalizeIdentifier("email", "John@Example.COM "),
      "john@example.com",
    );
  });

  it("normalizes phone", () => {
    assert.equal(
      normalizeIdentifier("phone", "  (0917) 123-4567 "),
      "+09171234567",
    );
  });
});
