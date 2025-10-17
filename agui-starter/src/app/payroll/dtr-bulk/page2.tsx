"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { resolveEffectiveShift } from "@/lib/shifts";
import {
  computeMinutes,
  computeLateMinutes,
  computeUndertimeMinutes,
} from "@/lib/payroll";
import { Segment, toLocalHHMM, weekdayShort } from "@/lib/segments";

type SegmentRow = { work_date: string; start_at: string | null; end_at: string | null };

type Emp = { id: string; code: string; full_name: string };

function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m, 0).getDate();
}
function isoDate(ym: string, day: number) {
  const [y, m] = ym.split("-");
  return `${y}-${m}-${String(day).padStart(2, "0")}`;
}

// Per-day grid model: up to TWO segments (IN1/OUT1, IN2/OUT2)
type DayPunch = { in1: string; out1: string; in2: string; out2: string };

export default function DtrBulkPage() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [empId, setEmpId] = useState("");
  const [ym, setYm] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [grid, setGrid] = useState<Record<number, DayPunch>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const maxDay = useMemo(() => daysInMonth(ym), [ym]);

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
      if (employees[0]) setEmpId(employees[0].id);
    })();
  }, []);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    // DO NOT clear the banner here; saveAll() already manages msg visibility.
    // setMsg(null);

    const m: Record<number, DayPunch> = {};
    for (let d = 1; d <= maxDay; d += 1) {
      m[d] = { in1: "", out1: "", in2: "", out2: "" };
    }

    const first = isoDate(ym, 1);
    const last = isoDate(ym, maxDay);
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      setMsg("Supabase not configured");
      return;
    }

    const { data: segs, error } = await sb
      .from("dtr_segments")
      .select("work_date, start_at, end_at")
      .eq("employee_id", empId)
      .gte("work_date", first)
      .lte("work_date", last)
      .order("start_at", { ascending: true });

    if (error) {
      setLoading(false);
      setMsg(`Failed to load segments: ${error.message}`);
      return;
    }

    const byDate = new Map<string, Segment[]>();
    const segmentRows = (segs ?? []) as SegmentRow[];
    segmentRows.forEach((row) => {
      const key = row.work_date;
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push({ start_at: row.start_at ?? "", end_at: row.end_at });
    });

    for (let d = 1; d <= maxDay; d += 1) {
      const date = isoDate(ym, d);
      const segList = byDate.get(date) || [];
      const s1 = segList[0];
      const s2 = segList[1];
      m[d] = {
        in1: s1 ? toLocalHHMM(s1.start_at) : "",
        out1: s1 ? toLocalHHMM(s1.end_at) : "",
        in2: s2 ? toLocalHHMM(s2.start_at) : "",
        out2: s2 ? toLocalHHMM(s2.end_at) : "",
      };
    }

    setGrid(m);
    setLoading(false);
  }, [empId, maxDay, ym]);

  useEffect(() => {
    if (empId) {
      void loadMonth();
    }
  }, [empId, loadMonth]);

  function setCell(day: number, key: keyof DayPunch, val: string) {
    setGrid((g) => ({
      ...g,
      [day]: {
        ...(g[day] || { in1: "", out1: "", in2: "", out2: "" }),
        [key]: val,
      },
    }));
  }

  function fillDown(keys: (keyof DayPunch)[], val: string) {
    const m: Record<number, DayPunch> = { ...grid };
    for (let d = 1; d <= maxDay; d += 1) {
      m[d] = { ...(m[d] || { in1: "", out1: "", in2: "", out2: "" }) };
      for (const k of keys) m[d][k] = val;
    }
    setGrid(m);
  }

  function weekdayLabel(day: number) {
    const date = isoDate(ym, day);
    return `${day} (${weekdayShort(date)})`;
  }

  // Deterministic save with error reporting and late/undertime support
  async function saveAll() {
    if (!empId) return;
    setLoading(true);
    setMsg(null); // explicitly clear before saving so the success banner stays after

    const dayErrors: string[] = [];
    let savedCount = 0;

    const sb = getSupabase();
    if (!sb) {
      setMsg("Supabase not configured");
      setLoading(false);
      return;
    }

    for (let d = 1; d <= maxDay; d += 1) {
      const cell = grid[d];
      const date = isoDate(ym, d);

      try {
        // Replace that day's segments: delete then insert up to two finished segments
        const del = await sb
          .from("dtr_segments")
          .delete()
          .eq("employee_id", empId)
          .eq("work_date", date);
        if (del.error) throw del.error;

        const inserts: Array<{
          employee_id: string;
          work_date: string;
          start_at: string;
          end_at: string | null;
        }> = [];
        if (cell?.in1 && cell?.out1) {
          inserts.push({
            employee_id: empId,
            work_date: date,
            start_at: new Date(`${date}T${cell.in1}:00`).toISOString(),
            end_at: new Date(`${date}T${cell.out1}:00`).toISOString(),
          });
        }
        if (cell?.in2 && cell?.out2) {
          inserts.push({
            employee_id: empId,
            work_date: date,
            start_at: new Date(`${date}T${cell.in2}:00`).toISOString(),
            end_at: new Date(`${date}T${cell.out2}:00`).toISOString(),
          });
        }
        if (inserts.length > 0) {
          const ins = await sb.from("dtr_segments").insert(inserts);
          if (ins.error) throw ins.error;
        }

        // Read back segments we just saved
        const { data: segs2, error: segErr } = await sb
          .from("dtr_segments")
          .select("start_at, end_at")
          .eq("employee_id", empId)
          .eq("work_date", date)
          .order("start_at", { ascending: true });
        if (segErr) throw segErr;

        const segList = (segs2 || []) as Segment[];

        // If no finished segments → upsert zeros and continue
        const firstInISO = segList[0]?.start_at ?? null;
        const lastOutISO =
          segList.filter((s) => !!s.end_at).slice(-1)[0]?.end_at ?? null;

        if (!firstInISO || !lastOutISO) {
          const up0 = await sb.from("dtr_entries").upsert(
            {
              employee_id: empId,
              work_date: date,
              time_in: null,
              time_out: null,
              minutes_regular: 0,
              minutes_ot: 0,
              minutes_late: 0,
              minutes_undertime: 0,
              notes: "rollup",
            },
            { onConflict: "employee_id,work_date" },
          );
          if (up0.error) throw up0.error;
          continue;
        }

        // Use the SAME payroll compute you trust (grace handling, etc.)
        const shift = await resolveEffectiveShift(empId, date);
        const timeIn = new Date(firstInISO);
        const timeOut = new Date(lastOutISO);
        const { regular, ot } = computeMinutes(date, timeIn, timeOut, shift);

        // Optional extras: late/undertime (present-day only logic handled in helpers)
        const late = computeLateMinutes(date, timeIn, shift);
        const und = computeUndertimeMinutes(date, timeOut, shift);

        const up = await sb.from("dtr_entries").upsert(
          {
            employee_id: empId,
            work_date: date,
            time_in: timeIn.toISOString(),
            time_out: timeOut.toISOString(),
            minutes_regular: regular,
            minutes_ot: ot,
            minutes_late: late,
            minutes_undertime: und,
            notes: "rollup",
          },
          { onConflict: "employee_id,work_date" },
        );
        if (up.error) throw up.error;

        savedCount += 1;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error ?? "unknown error");
        dayErrors.push(`${date}: ${message}`);
      }
    }

    if (dayErrors.length > 0) {
      setMsg(
        `Saved ${savedCount} day(s), but ${dayErrors.length} error(s):\n${dayErrors.join(
          "\n",
        )}`,
      );
    } else {
      setMsg(`Saved month ✔ (${savedCount} day(s))`);
    }

    // Make sure user sees the message
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}

    setLoading(false);

    // Reload grid WITHOUT clearing the banner
    await loadMonth();
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-3">
        Bulk DTR (per employee, per month)
      </h1>

      {msg && (
        <div className="mb-4 p-3 rounded bg-success/10 border border-success/30 text-success whitespace-pre-wrap">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <select
          className="border rounded px-3 py-2"
          value={empId}
          onChange={(e) => setEmpId(e.target.value)}
        >
          {emps.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name} ({e.code})
            </option>
          ))}
        </select>

        <input
          className="border rounded px-3 py-2"
          type="month"
          value={ym}
          onChange={(e) => setYm(e.target.value)}
        />

        <div className="flex gap-2 flex-wrap">
          <input
            className="border border-border rounded px-2 py-2 w-28 bg-background text-foreground"
            placeholder="Fill IN1 (e.g. 07:00)"
            onBlur={(e) => {
              if (e.target.value) fillDown(["in1"], e.target.value);
            }}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            className="border rounded px-2 py-2 w-28"
            placeholder="Fill OUT1 (e.g. 12:00)"
            onBlur={(e) => {
              if (e.target.value) fillDown(["out1"], e.target.value);
            }}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            className="border rounded px-2 py-2 w-28"
            placeholder="Fill IN2 (e.g. 13:00)"
            onBlur={(e) => {
              if (e.target.value) fillDown(["in2"], e.target.value);
            }}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            className="border rounded px-2 py-2 w-28"
            placeholder="Fill OUT2 (e.g. 17:30)"
            onBlur={(e) => {
              if (e.target.value) fillDown(["out2"], e.target.value);
            }}
          />
        </div>

        <div className="text-sm text-muted-foreground self-center md:col-span-4">
          Tip: type then blur (leave the box) to fill down
        </div>
      </div>

      <div className="border border-border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="p-2 text-left">Day</th>
              <th className="p-2 text-left">IN 1</th>
              <th className="p-2 text-left">OUT 1</th>
              <th className="p-2 text-left">IN 2</th>
              <th className="p-2 text-left">OUT 2</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxDay }, (_, i) => i + 1).map((day) => (
              <tr key={day} className="border-t">
                <td className="p-2">{weekdayLabel(day)}</td>
                <td className="p-2">
                  <input
                    className="border border-border rounded px-2 py-1 w-28 bg-background text-foreground"
                    type="time"
                    value={grid[day]?.in1 || ""}
                    onChange={(e) => setCell(day, "in1", e.target.value)}
                  />
                </td>
                <td className="p-2">
                  <input
                    className="border border-border rounded px-2 py-1 w-28 bg-background text-foreground"
                    type="time"
                    value={grid[day]?.out1 || ""}
                    onChange={(e) => setCell(day, "out1", e.target.value)}
                  />
                </td>
                <td className="p-2">
                  <input
                    className="border border-border rounded px-2 py-1 w-28 bg-background text-foreground"
                    type="time"
                    value={grid[day]?.in2 || ""}
                    onChange={(e) => setCell(day, "in2", e.target.value)}
                  />
                </td>
                <td className="p-2">
                  <input
                    className="border border-border rounded px-2 py-1 w-28 bg-background text-foreground"
                    type="time"
                    value={grid[day]?.out2 || ""}
                    onChange={(e) => setCell(day, "out2", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 mt-3">
        <button
          type="button" /* prevent accidental form submit */
          className="bg-success text-success-foreground rounded px-4 py-2"
          onClick={saveAll}
          disabled={loading}
        >
          {loading ? "Saving…" : "Save All"}
        </button>
      </div>
    </div>
  );
}
