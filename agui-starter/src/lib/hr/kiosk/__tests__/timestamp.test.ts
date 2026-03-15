import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeKioskTimestamp, parseKioskTimestamp } from "@/lib/hr/kiosk/timestamp";

describe("kiosk timestamp parsing", () => {
  it("normalizes postgres UTC timestamps to RFC3339", () => {
    assert.equal(normalizeKioskTimestamp("2026-03-05 22:14:39+00"), "2026-03-05T22:14:39Z");
    assert.equal(normalizeKioskTimestamp("2026-03-05 22:14:39+00:00"), "2026-03-05T22:14:39Z");
  });

  it("keeps existing iso values parseable", () => {
    const parsed = parseKioskTimestamp("2026-03-05T22:14:39.000Z");
    assert.ok(parsed instanceof Date);
    assert.equal(parsed?.toISOString(), "2026-03-05T22:14:39.000Z");
  });

  it("returns null for invalid values", () => {
    assert.equal(parseKioskTimestamp("not-a-time"), null);
    assert.equal(parseKioskTimestamp(null), null);
    assert.equal(parseKioskTimestamp(undefined), null);
  });
});
