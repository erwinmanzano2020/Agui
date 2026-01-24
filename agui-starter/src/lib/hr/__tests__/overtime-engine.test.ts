import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildZonedDateTime,
  computeOvertimeForDay,
  getDayOfWeekInTimeZone,
} from "../overtime-engine";

const basePolicy = {
  timezone: "Asia/Manila",
  ot_mode: "AFTER_SCHEDULE_END",
  min_ot_minutes: 10,
  rounding_minutes: 1,
  rounding_mode: "NONE",
};

describe("computeOvertimeForDay", () => {
  it("handles multiple segments with gaps and overtime after schedule end", () => {
    const result = computeOvertimeForDay({
      segments: [
        {
          time_in: "2024-10-01T09:00:00+08:00",
          time_out: "2024-10-01T12:00:00+08:00",
        },
        {
          time_in: "2024-10-01T13:00:00+08:00",
          time_out: "2024-10-01T18:00:00+08:00",
        },
        {
          time_in: "2024-10-01T18:30:00+08:00",
          time_out: "2024-10-01T19:00:00+08:00",
        },
      ],
      workDate: "2024-10-01",
      scheduleWindow: {
        start_time: "09:00",
        end_time: "17:00",
        timezone: "Asia/Manila",
      },
      policy: basePolicy,
    });

    assert.equal(result.worked_minutes_total, 510);
    assert.equal(result.worked_minutes_within_schedule, 420);
    assert.equal(result.overtime_minutes, 90);
  });

  it("drops overtime when below minimum threshold", () => {
    const result = computeOvertimeForDay({
      segments: [
        {
          time_in: "2024-10-01T16:30:00+08:00",
          time_out: "2024-10-01T17:05:00+08:00",
        },
      ],
      workDate: "2024-10-01",
      scheduleWindow: {
        start_time: "09:00",
        end_time: "17:00",
        timezone: "Asia/Manila",
      },
      policy: basePolicy,
    });

    assert.equal(result.overtime_minutes, 0);
  });

  it("warns when schedule is missing", () => {
    const result = computeOvertimeForDay({
      segments: [
        {
          time_in: "2024-10-01T09:00:00+08:00",
          time_out: "2024-10-01T10:00:00+08:00",
        },
      ],
      workDate: "2024-10-01",
      scheduleWindow: null,
      policy: basePolicy,
    });

    assert.equal(result.overtime_minutes, 0);
    assert.ok(result.warnings.includes("missing schedule window"));
  });

  it("ignores open segments for totals while warning", () => {
    const result = computeOvertimeForDay({
      segments: [
        {
          time_in: "2024-10-01T09:00:00+08:00",
          time_out: null,
        },
        {
          time_in: "2024-10-01T10:00:00+08:00",
          time_out: "2024-10-01T12:00:00+08:00",
        },
      ],
      workDate: "2024-10-01",
      scheduleWindow: {
        start_time: "09:00",
        end_time: "17:00",
        timezone: "Asia/Manila",
      },
      policy: basePolicy,
    });

    assert.equal(result.open_segments_count, 1);
    assert.equal(result.worked_minutes_total, 120);
    assert.ok(result.warnings.some((warning) => warning.includes("missing time_in/time_out")));
  });
});

describe("timezone helpers", () => {
  it("builds deterministic Manila timestamps", () => {
    const zoned = buildZonedDateTime("2024-10-01", "17:00", "Asia/Manila");
    assert.ok(zoned);
    assert.equal(zoned?.toISOString(), "2024-10-01T09:00:00.000Z");
  });

  it("resolves Manila day of week deterministically", () => {
    const dayOfWeek = getDayOfWeekInTimeZone("2024-10-01", "Asia/Manila");
    assert.equal(dayOfWeek, 2);
  });
});
