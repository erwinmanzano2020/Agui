import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertManilaReasonableSegment,
  normalizeManilaTimestamp,
  toManilaTimestamp,
  toManilaTimestamptz,
} from "../timezone";

describe("timezone helpers", () => {
  it("formats Manila timestamps with +08:00 offset", () => {
    const stamp = toManilaTimestamp("2024-10-01", "07:00");
    assert.equal(stamp, "2024-10-01T07:00:00+08:00");
  });

  it("supports the Manila timestamptz alias", () => {
    const stamp = toManilaTimestamptz("2024-10-01", "07:00");
    assert.equal(stamp, "2024-10-01T07:00:00+08:00");
  });

  it("normalizes timestamps without explicit offsets", () => {
    const normalized = normalizeManilaTimestamp("2024-10-01T07:00:00");
    assert.equal(normalized, "2024-10-01T07:00:00+08:00");
  });

  it("keeps timestamps that already have offsets", () => {
    const original = "2024-10-01T07:00:00+08:00";
    const normalized = normalizeManilaTimestamp(original);
    assert.equal(normalized, original);
  });

  it("uses fallback date for time-only inputs", () => {
    const normalized = normalizeManilaTimestamp("07:00:00", "2024-10-01");
    assert.equal(normalized, "2024-10-01T07:00:00+08:00");
  });

  it("flags segments that cross Manila dates or have UTC offsets", () => {
    const validation = assertManilaReasonableSegment(
      "2026-01-02T07:00:00+00:00",
      "2026-01-02T18:30:00+00:00",
      "2026-01-02",
    );
    assert.equal(validation.ok, false);
    assert.ok(validation.reasons.includes("unexpected_offset"));
    assert.ok(validation.reasons.includes("time_out_date_mismatch"));
  });
});
