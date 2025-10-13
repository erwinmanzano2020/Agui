"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { resolveEffectiveShift } from "@/lib/shifts";
import { computeMinutes } from "@/lib/payroll";
import { sumFinishedMinutes, latestOut, Segment } from "@/lib/segments";

type SegmentRecord = { start_at: string; end_at: string | null };

type Emp = { id: string; code: string; full_name: string };

export default function PayrollDtrTodayPageClient() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  // simple manual entry (kept)
  const [timeIn, setTimeIn] = useState("07:00");
  const [timeOut, setTimeOut] = useState("17:00");

  // segments
  const [segments, setSegments] = useState<Segment[]>([]);
  const [hasOpen, setHasOpen] = useState(false);

  // info & results
  const [shiftInfo, setShiftInfo] = useState<{
    name: string | null;
    end: string | null;
    grace: number | null;
    std: number | null;
  } | null>(null);
  const [preview, setPreview] = useState<{
    regular: number;
    ot: number;
    total: number;
  } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      if (!sb) {
        setMsg("Supabase not configured");
        setEmps([]);
        return;
      }

      const { data } = await sb
        .from("employees")
        .select("id, code, full_name")
        .neq("status", "archived")
        .order("full_name");
      const employees = (data ?? []) as Emp[];
      setEmps(employees);
      if (employees[0]) setEmployeeId(employees[0].id);
    })();
  }, []);

  const loadSegments = useCallback(async () => {
    if (!employeeId || !date) return;
    const sb = getSupabase();
    if (!sb) {
      setMsg("Supabase not configured");
      setSegments([]);
      setHasOpen(false);
      return;
    }

    const { data } = await sb
      .from("dtr_segments")
      .select("start_at, end_at")
      .eq("employee_id", employeeId)
      .eq("work_date", date)
      .order("start_at", { ascending: true });
    const rows = (data ?? []) as SegmentRecord[];
    setSegments(rows);
    setHasOpen(rows.some((row) => row.end_at === null));
  }, [date, employeeId]);

  useEffect(() => {
    void loadSegments();
  }, [loadSegments]);

  async function clockIn() {
    setMsg(null);
    // prevent double-open
    if (hasOpen) {
      setMsg("There is already an open segment. Clock out first.");
      return;
    }

    const now = new Date();
    const startAt = new Date(
      `${date}T${now.toTimeString().slice(0, 8)}`,
    ).toISOString();
    const sb = getSupabase();
    if (!sb) {
      setMsg("Supabase not configured");
      return;
    }

    const { error } = await sb.from("dtr_segments").insert({
      employee_id: employeeId,
      work_date: date,
      start_at: startAt,
      end_at: null,
    });
    if (error) setMsg(error.message);
    await loadSegments();
  }

  async function clockOut() {
    setMsg(null);
    // find latest open
    const sb = getSupabase();
    if (!sb) {
      setMsg("Supabase not configured");
      return;
    }

    const { data: openSegment, error } = await sb
      .from("dtr_segments")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("work_date", date)
      .is("end_at", null)
      .order("start_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (error) {
      setMsg(error.message);
      return;
    }

    if (!openSegment) {
      setMsg("No open segment to close.");
      return;
    }

    const now = new Date();
    const endAt = new Date(
      `${date}T${now.toTimeString().slice(0, 8)}`,
    ).toISOString();

    const { error: updateError } = await sb
      .from("dtr_segments")
      .update({ end_at: endAt })
      .eq("id", openSegment.id);

    if (updateError) setMsg(updateError.message);
    await loadSegments();
  }

  // Preview based on MANUAL inputs (kept)
  async function runManualPreview(saveAfter = false) {
    setMsg(null);
    if (!employeeId || !date || !timeIn || !timeOut) return;
    const shift = await resolveEffectiveShift(employeeId, date);
    setShiftInfo({
      name: shift.name,
      end: shift.end_time,
      grace: shift.ot_grace_min,
      std: shift.standard_minutes ?? null,
    });

    const res = computeMinutes(
      date,
      new Date(`${date}T${timeIn}:00`),
      new Date(`${date}T${timeOut}:00`),
      shift,
    );
    setPreview(res);

    if (saveAfter) {
      const sb = getSupabase();
      if (!sb) {
        setMsg("Supabase not configured");
        return;
      }

      await sb.from("dtr_entries").upsert(
        {
          employee_id: employeeId,
          work_date: date,
          time_in: new Date(`${date}T${timeIn}:00`).toISOString(),
          time_out: new Date(`${date}T${timeOut}:00`).toISOString(),
          minutes_regular: res.regular,
          minutes_ot: res.ot,
        },
        { onConflict: "employee_id,work_date" },
      );
      setMsg("Saved ✔ (manual)");
    }
  }

  // Rollup segments → preview/save for the day
  async function rollupSegments(saveAfter = false) {
    setMsg(null);
    const shift = await resolveEffectiveShift(employeeId, date);
    setShiftInfo({
      name: shift.name,
      end: shift.end_time,
      grace: shift.ot_grace_min,
      std: shift.standard_minutes ?? null,
    });

    const totalMins = sumFinishedMinutes(segments);
    const lastOut = latestOut(segments);

    // If there are no finished segments, nothing to compute
    if (totalMins === 0 || !lastOut) {
      setPreview({ regular: 0, ot: 0, total: 0 });
      return;
    }

    // Reuse existing OT rule:
    // - if lastOut < end+grace => OT = 0, all regular
    // - else OT from END
    if (!shift.end_time || shift.ot_grace_min == null) {
      // Rest Day: all OT
      const res = { regular: 0, ot: totalMins, total: totalMins };
      setPreview(res);
      if (saveAfter) await saveRollup(res, segments);
      return;
    }

    const end = new Date(`${date}T${shift.end_time}`);
    const cutoff = new Date(end.getTime() + shift.ot_grace_min * 60000);

    let regular: number;
    let ot: number;

    if (lastOut < cutoff) {
      regular = totalMins;
      ot = 0;
    } else {
      // OT from END: split by END
      // Approximation: regular = minutes worked up to END (cap by total)
      // We don't need exact per-segment split for MVP payroll math.
      // Use: regular_cap = max(0, minutes from first IN across segments up to END)
      // A simple cap by (END - first start) may overcount breaks; better:
      // regular = min(totalMins, max(0, END - firstStartUsedWithinSegments))
      // For MVP, use:
      // regular = min(totalMins, minutes till END if we had been continuously working)
      // To stay conservative, we’ll compute regular = totalMins - minutes after END.
      // Minutes after END ≈ (lastOut - END) if lastOut > END else 0.
      const afterEnd = Math.max(
        0,
        Math.floor((lastOut.getTime() - end.getTime()) / 60000),
      );
      ot = afterEnd;
      regular = Math.max(0, totalMins - ot);
    }

    const res = { regular, ot, total: totalMins };
    setPreview(res);
    if (saveAfter) await saveRollup(res, segments);
  }

  async function saveRollup(
    res: { regular: number; ot: number; total: number },
    segs: Segment[],
  ) {
    // Persist last segment boundaries as time_in/out for reference
    const firstInISO =
      segs.find((s) => !!s.start_at)?.start_at ??
      new Date(`${date}T00:00:00`).toISOString();
    const lastOutISO =
      segs.filter((s) => !!s.end_at).slice(-1)[0]?.end_at ?? firstInISO;

    const sb = getSupabase();
    if (!sb) {
      setMsg("Supabase not configured");
      return;
    }

    await sb.from("dtr_entries").upsert(
      {
        employee_id: employeeId,
        work_date: date,
        time_in: firstInISO,
        time_out: lastOutISO,
        minutes_regular: res.regular,
        minutes_ot: res.ot,
        notes: "rollup",
      },
      { onConflict: "employee_id,work_date" },
    );
    setMsg("Saved ✔ (rollup)");
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">DTR Today</h1>

      {/* Employee + Date */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <select
          className="border rounded px-3 py-2"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        >
          {emps.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name} ({e.code})
            </option>
          ))}
        </select>
        <input
          className="border rounded px-3 py-2"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div />
      </div>

      {/* Shift info */}
      {shiftInfo && (
        <div className="mb-3 text-sm">
          {shiftInfo.name ? (
            <>
              Using shift: <b>{shiftInfo.name}</b> — End <b>{shiftInfo.end}</b>{" "}
              (+ grace <b>{shiftInfo.grace}m</b>) — Std mins{" "}
              <b>{shiftInfo.std ?? "—"}</b>
            </>
          ) : (
            <>
              <b>Rest Day</b> — all minutes count as OT
            </>
          )}
        </div>
      )}

      {/* Multi-punch controls */}
      <div className="border rounded p-3 mb-4">
        <div className="flex gap-2 mb-3">
          <button
            className="bg-gray-800 text-white rounded px-3 py-2"
            onClick={clockIn}
            disabled={hasOpen}
          >
            Clock In
          </button>
          <button
            className="bg-gray-600 text-white rounded px-3 py-2"
            onClick={clockOut}
            disabled={!hasOpen}
          >
            Clock Out
          </button>
          <button
            className="bg-blue-600 text-white rounded px-3 py-2"
            onClick={() => rollupSegments(false)}
          >
            Preview Rollup
          </button>
          <button
            className="bg-green-600 text-white rounded px-3 py-2"
            onClick={() => rollupSegments(true)}
          >
            Save Rollup
          </button>
        </div>

        <div className="text-sm mb-2">
          <b>Segments:</b>
        </div>
        <div className="text-sm">
          {segments.length === 0 ? (
            "No segments yet."
          ) : (
            <ul className="list-disc ml-5">
              {segments.map((s, i) => (
                <li key={i}>
                  IN: {new Date(s.start_at).toLocaleTimeString()} — OUT:{" "}
                  {s.end_at ? (
                    new Date(s.end_at).toLocaleTimeString()
                  ) : (
                    <i>OPEN</i>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Manual one-shot entry (kept for convenience) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <div className="text-xs mb-1">Time In (manual)</div>
          <input
            className="border rounded px-3 py-2 w-full"
            type="time"
            value={timeIn}
            onChange={(e) => setTimeIn(e.target.value)}
          />
        </div>
        <div>
          <div className="text-xs mb-1">Time Out (manual)</div>
          <input
            className="border rounded px-3 py-2 w-full"
            type="time"
            value={timeOut}
            onChange={(e) => setTimeOut(e.target.value)}
          />
        </div>
        <button
          className="bg-blue-500 text-white rounded px-3 py-2"
          onClick={() => runManualPreview(false)}
        >
          Preview
        </button>
        <button
          className="bg-green-500 text-white rounded px-3 py-2"
          onClick={() => runManualPreview(true)}
        >
          Save
        </button>
      </div>

      {/* Results */}
      {msg && <div className="text-green-700 text-sm mb-2">{msg}</div>}
      {preview && (
        <div className="border rounded p-3 text-sm">
          <div>
            <b>Regular mins:</b> {preview.regular}
          </div>
          <div>
            <b>OT mins:</b> {preview.ot}
          </div>
          <div>
            <b>Total mins:</b> {preview.total}
          </div>
        </div>
      )}
    </div>
  );
}
