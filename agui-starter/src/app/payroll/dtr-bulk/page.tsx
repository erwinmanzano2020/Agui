"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../../../components/ui/page-header";
import { Toast } from "../../../components/ui/toast";
import { supabase } from "../../../lib/supabase";

/** ===== Types ===== */
type Emp = { id: string; code?: string | null; full_name: string };

/** Per-day editable cell: up to two segments (IN1/OUT1, IN2/OUT2) */
type DayCell = { in1: string; out1: string; in2: string; out2: string };

type Mode = "all" | "single" | "csv";

/** ===== Date helpers ===== */
function iso(d: Date) {
  const z = new Date(d);
  z.setHours(0, 0, 0, 0);
  return z.toISOString().slice(0, 10);
}
function daysForWeek(startIso: string) {
  const start = new Date(startIso);
  start.setHours(0, 0, 0, 0);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(iso(d));
  }
  return out;
}
function daysForMonth(ym: string /* YYYY-MM */) {
  const [y, m] = ym.split("-").map((x) => parseInt(x, 10));
  const last = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let day = 1; day <= last; day++) out.push(iso(new Date(y, m - 1, day)));
  return out;
}
const pad2 = (n: number) => String(n).padStart(2, "0");
function toHHMM(isoStr?: string | null) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function toISO(date: string /* YYYY-MM-DD */, hhmm: string) {
  // Accepts "7", "730", "7:30", "07:30"
  const m = hhmm.trim().match(/^(\d{1,2})(:?)(\d{0,2})$/);
  if (!m) return null;
  const hh = Math.min(23, parseInt(m[1] || "0", 10))
    .toString()
    .padStart(2, "0");
  const mmRaw = m[3] ? parseInt(m[3], 10) : 0;
  const mm = Math.min(59, isNaN(mmRaw) ? 0 : mmRaw)
    .toString()
    .padStart(2, "0");
  return new Date(`${date}T${hh}:${mm}:00`).toISOString();
}

/** ===== CSV helpers ===== */
function toCSV(rows: Array<Record<string, string>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h] ?? "")).join(",")),
  ].join("\n");
}
function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function parseCSV(text: string) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return { headers: [], rows: [] as string[][] };
  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          q = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === ",") {
          out.push(cur);
          cur = "";
        } else if (ch === '"') {
          q = true;
        } else {
          cur += ch;
        }
      }
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

/** ===== Small time input ===== */
function TimeInput(props: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onFocus?: () => void;
  ["data-row"]?: number;
  ["data-col"]?: number;
  dense?: boolean;
  disabled?: boolean;
}) {
  const pad = props.dense ? "px-2 py-0.5" : "px-2 py-1";
  return (
    <div data-row={props["data-row"]} data-col={props["data-col"]}>
      <input
        disabled={props.disabled}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        onKeyDown={props.onKeyDown}
        onFocus={props.onFocus}
        className={`w-full rounded-xl ${pad} bg-background border border-border
                       focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring
                       text-[0.93em] ${props.disabled ? "opacity-50 pointer-events-none" : ""}`}
        inputMode="numeric"
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (!v) return;
          const m = v.match(/^(\d{1,2})(:?)(\d{0,2})$/);
          if (m) {
            const hh = Math.min(23, parseInt(m[1] || "0", 10))
              .toString()
              .padStart(2, "0");
            const mmRaw = m[3] ? parseInt(m[3], 10) : 0;
            const mm = Math.min(59, isNaN(mmRaw) ? 0 : mmRaw)
              .toString()
              .padStart(2, "0");
            props.onChange(`${hh}:${mm}`);
          }
        }}
      />
    </div>
  );
}

export default function DtrBulkPage() {
  /** ===== Toolbar state ===== */
  const [mode, setMode] = useState<Mode>("all");
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay(); // 0 Sun
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    return iso(start);
  });
  const [ym, setYm] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");

  /** ===== Payroll run awareness (from URL) ===== */
  const params = useSearchParams();
  const runStart = params.get("start"); // e.g. 2025-10-08
  const runEnd = params.get("end"); // e.g. 2025-10-10
  const inRun = (d: string) =>
    !(runStart && runEnd) ? true : d >= runStart && d <= runEnd;

  /** ===== Density / UI ===== */
  const [density, setDensity] = useState<"comfortable" | "dense">(
    "comfortable",
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    msg: string;
  } | null>(null);
  const [activeRow, setActiveRow] = useState<number | null>(null);

  /** ===== Data state ===== */
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(true);
  const [loadingDtr, setLoadingDtr] = useState(true);

  // grid: empId -> day -> DayCell
  const [grid, setGrid] = useState<Record<string, Record<string, DayCell>>>({});

  /** ===== Derived days, scope ===== */
  const days = useMemo(() => {
    if (mode === "single") return daysForMonth(ym);
    return daysForWeek(weekStart);
  }, [mode, ym, weekStart]);

  const scopedEmployees = useMemo(() => {
    if (mode === "single" && selectedEmpId) {
      const e = employees.find((x) => x.id === selectedEmpId);
      return e ? [e] : [];
    }
    return employees;
  }, [mode, employees, selectedEmpId]);

  /** ===== Load employees once ===== */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingEmps(true);
      const { data, error } = await supabase
        .from("employees")
        .select("id, code, full_name")
        .order("full_name", { ascending: true });
      if (cancelled) return;
      if (error) {
        setToast({
          kind: "error",
          msg: `Load employees failed: ${error.message}`,
        });
        setLoadingEmps(false);
        return;
      }
      const emps = (data ?? []) as Emp[];
      setEmployees(emps);
      if (!selectedEmpId && emps.length) setSelectedEmpId(emps[0].id);
      setLoadingEmps(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ===== Init grid for current scope ===== */
  useEffect(() => {
    if (!scopedEmployees.length || !days.length) return;
    const base: Record<string, Record<string, DayCell>> = {};
    for (const e of scopedEmployees) {
      base[e.id] = {};
      for (const d of days)
        base[e.id][d] = { in1: "", out1: "", in2: "", out2: "" };
    }
    setGrid(base);
  }, [scopedEmployees, days]);

  /** ===== Load existing DTR for scope ===== */
  useEffect(() => {
    let cancelled = false;
    if (!scopedEmployees.length || !days.length) return;

    (async () => {
      setLoadingDtr(true);

      const from = days[0];
      const to = days[days.length - 1];

      if (mode === "single" && selectedEmpId) {
        // Load up to TWO segments per day for the selected employee
        const { data, error } = await supabase
          .from("dtr_segments")
          .select("employee_id, work_date, start_at, end_at")
          .eq("employee_id", selectedEmpId)
          .gte("work_date", from)
          .lte("work_date", to)
          .order("work_date", { ascending: true })
          .order("start_at", { ascending: true });

        if (cancelled) return;
        if (error) {
          setToast({
            kind: "error",
            msg: `Load segments failed: ${error.message}`,
          });
          setLoadingDtr(false);
          return;
        }

        setGrid((prev) => {
          const next = { ...prev };
          const byDay = new Map<
            string,
            Array<{ start_at: string | null; end_at: string | null }>
          >();
          (data ?? []).forEach((r: any) => {
            const d = String(r.work_date);
            if (!byDay.has(d)) byDay.set(d, []);
            byDay.get(d)!.push({ start_at: r.start_at, end_at: r.end_at });
          });

          const eid = selectedEmpId;
          if (!next[eid]) next[eid] = {};
          for (const d of days) {
            const list = (byDay.get(d) || []).slice(0, 2);
            const s1 = list[0];
            const s2 = list[1];
            next[eid][d] = {
              in1: s1 ? toHHMM(s1.start_at) : "",
              out1: s1 ? toHHMM(s1.end_at) : "",
              in2: s2 ? toHHMM(s2.start_at) : "",
              out2: s2 ? toHHMM(s2.end_at) : "",
            };
          }
          return next;
        });

        setLoadingDtr(false);
        return;
      }

      // Weekly "all employees": keep IN/OUT (first-in/last-out) from dtr_entries
      const q = supabase
        .from("dtr_entries")
        .select("employee_id, work_date, time_in, time_out")
        .gte("work_date", from)
        .lte("work_date", to);

      const { data, error } = await q;

      if (cancelled) return;
      if (error) {
        setToast({ kind: "error", msg: `Load DTR failed: ${error.message}` });
        setLoadingDtr(false);
        return;
      }

      setGrid((prev) => {
        const next = { ...prev };
        for (const row of data ?? []) {
          const eid = row.employee_id as string;
          const wd = String(row.work_date);
          if (!next[eid]) continue;
          if (!next[eid][wd])
            next[eid][wd] = { in1: "", out1: "", in2: "", out2: "" };
          next[eid][wd].in1 = row.time_in ? toHHMM(row.time_in) : "";
          next[eid][wd].out1 = row.time_out ? toHHMM(row.time_out) : "";
        }
        return next;
      });

      setLoadingDtr(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, selectedEmpId, scopedEmployees, days]);

  /** ===== Save (bulk) ===== */
  async function handleSave() {
    try {
      setSaving(true);

      if (mode === "single" && scopedEmployees[0]) {
        // Delete+insert segments per day (up to two), and also upsert dtr_entries time_in/out
        const e = scopedEmployees[0];
        for (const d of days) {
          if (runStart && runEnd && !inRun(d)) continue; // skip days outside run

          const cell = grid[e.id]?.[d] ?? {
            in1: "",
            out1: "",
            in2: "",
            out2: "",
          };

          // Wipe existing segments for that day
          const del = await supabase
            .from("dtr_segments")
            .delete()
            .eq("employee_id", e.id)
            .eq("work_date", d);
          if (del.error) throw del.error;

          const inserts: Array<{
            employee_id: string;
            work_date: string;
            start_at: string;
            end_at: string | null;
          }> = [];

          if (cell.in1 && cell.out1) {
            const s = toISO(d, cell.in1);
            const e1 = toISO(d, cell.out1);
            if (s && e1)
              inserts.push({
                employee_id: e.id,
                work_date: d,
                start_at: s,
                end_at: e1,
              });
          }
          if (cell.in2 && cell.out2) {
            const s = toISO(d, cell.in2);
            const e2 = toISO(d, cell.out2);
            if (s && e2)
              inserts.push({
                employee_id: e.id,
                work_date: d,
                start_at: s,
                end_at: e2,
              });
          }

          if (inserts.length > 0) {
            const ins = await supabase.from("dtr_segments").insert(inserts);
            if (ins.error) throw ins.error;
          }

          // Also reflect first-in / last-out on dtr_entries for convenience
          const firstInISO = inserts.length ? inserts[0].start_at : null;
          const lastOutISO = inserts.length
            ? inserts[inserts.length - 1].end_at
            : null;

          const up = await supabase.from("dtr_entries").upsert(
            {
              employee_id: e.id,
              work_date: d,
              time_in: firstInISO,
              time_out: lastOutISO,
            },
            { onConflict: "employee_id,work_date" },
          );
          if (up.error) throw up.error;
        }

        setToast({ kind: "success", msg: "Saved!" });
        setSaving(false);
        // reload segments for the month
        setYm((m) => m);
        return;
      }

      // Weekly "all employees": upsert time_in/out (uses IN1/OUT1)
      const payload: Array<{
        employee_id: string;
        work_date: string;
        time_in: string | null;
        time_out: string | null;
      }> = [];
      for (const e of scopedEmployees) {
        const perDay = grid[e.id] || {};
        for (const d of days) {
          if (runStart && runEnd && !inRun(d)) continue; // skip days outside run
          const cell = perDay[d] || { in1: "", out1: "", in2: "", out2: "" };
          if (
            (cell.in1 && cell.in1.trim()) ||
            (cell.out1 && cell.out1.trim())
          ) {
            payload.push({
              employee_id: e.id,
              work_date: d,
              time_in: toISO(d, cell.in1 || "") ?? null,
              time_out: toISO(d, cell.out1 || "") ?? null,
            });
          }
        }
      }
      const { error } = await supabase
        .from("dtr_entries")
        .upsert(payload, { onConflict: "employee_id,work_date" });

      if (error) throw error;
      setToast({ kind: "success", msg: "Saved!" });
    } catch (err: any) {
      setToast({ kind: "error", msg: `Save failed: ${err.message ?? err}` });
    } finally {
      setSaving(false);
    }
  }

  /** ===== Export current scope to CSV (keeps IN1/OUT1) ===== */
  function handleExportCsv() {
    const rows: Array<Record<string, string>> = [];
    for (const e of scopedEmployees) {
      for (const d of days) {
        const cell = grid[e.id]?.[d] ?? {
          in1: "",
          out1: "",
          in2: "",
          out2: "",
        };
        rows.push({
          employee_id: e.id,
          employee_code: e.code || "",
          work_date: d,
          time_in: cell.in1 || "",
          time_out: cell.out1 || "",
        });
      }
    }
    download(
      `dtr_${mode === "single" ? selectedEmpId : "all"}_${days[0]}_${days[days.length - 1]}.csv`,
      toCSV(rows),
    );
  }

  /** ===== Import CSV (employee_code or employee_id + work_date + time_in/out) ===== */
  async function handleImportCsv(file: File) {
    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);

      // Accept headers: employee_id OR employee_code, work_date, time_in, time_out
      const h = headers.map((x) => x.trim().toLowerCase());
      const idx = (name: string) => h.indexOf(name);

      const idIdx = idx("employee_id");
      const codeIdx = idx("employee_code");
      const dateIdx = idx("work_date");
      const inIdx = idx("time_in");
      const outIdx = idx("time_out");

      if (
        (idIdx < 0 && codeIdx < 0) ||
        dateIdx < 0 ||
        inIdx < 0 ||
        outIdx < 0
      ) {
        setToast({
          kind: "error",
          msg: "CSV needs headers: employee_id OR employee_code, work_date, time_in, time_out",
        });
        return;
      }

      // build code->id map
      const byCode: Record<string, string> = {};
      for (const e of employees) if (e.code) byCode[e.code] = e.id;

      const payload: Array<{
        employee_id: string;
        work_date: string;
        time_in: string | null;
        time_out: string | null;
      }> = [];

      for (const r of rows) {
        const eid = idIdx >= 0 ? r[idIdx] : byCode[r[codeIdx]];
        if (!eid) continue;
        const wd = r[dateIdx];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(wd)) continue;

        payload.push({
          employee_id: eid,
          work_date: wd,
          time_in: toISO(wd, (r[inIdx] || "").trim() || "") ?? null,
          time_out: toISO(wd, (r[outIdx] || "").trim() || "") ?? null,
        });
      }

      if (!payload.length) {
        setToast({ kind: "error", msg: "No valid rows to import." });
        return;
      }

      const { error } = await supabase
        .from("dtr_entries")
        .upsert(payload, { onConflict: "employee_id,work_date" });

      if (error) throw error;

      setToast({ kind: "success", msg: `Imported ${payload.length} rows` });

      // Reload current scope after import
      setWeekStart((w) => w);
      setYm((m) => m);
    } catch (e: any) {
      setToast({ kind: "error", msg: `Import failed: ${e.message ?? e}` });
    }
  }

  /** ===== Keyboard nav for weekly table ===== */
  const tableRef = useRef<HTMLDivElement>(null);
  const COLS_PER_DAY = 2;
  const totalCols = 1 + days.length * COLS_PER_DAY;
  function focusCell(row: number, col: number) {
    const el = tableRef.current?.querySelector<HTMLInputElement>(
      `[data-row="${row}"][data-col="${col}"] input`,
    );
    el?.focus();
    el?.select();
  }
  function handleMove(e: React.KeyboardEvent, row: number, col: number) {
    const key = e.key;
    if (key === "Enter") {
      e.preventDefault();
      focusCell(Math.min(row + 1, scopedEmployees.length - 1), col);
      return;
    }
    if (key === "Tab") {
      e.preventDefault();
      const next = Math.min(col + 1, totalCols - 1);
      focusCell(row, Math.max(1, next));
      return;
    }
    if (key === "ArrowRight") {
      e.preventDefault();
      focusCell(row, Math.min(col + 1, totalCols - 1));
      return;
    }
    if (key === "ArrowLeft") {
      e.preventDefault();
      focusCell(row, Math.max(1, col - 1));
      return;
    }
    if (key === "ArrowDown") {
      e.preventDefault();
      focusCell(Math.min(row + 1, scopedEmployees.length - 1), col);
      return;
    }
    if (key === "ArrowUp") {
      e.preventDefault();
      focusCell(Math.max(0, row - 1), col);
      return;
    }
  }

  /** ===== Update helper ===== */
  function updateCell(
    empId: string,
    day: string,
    part: "in1" | "out1" | "in2" | "out2",
    val: string,
  ) {
    setGrid((g) => ({
      ...g,
      [empId]: { ...g[empId], [day]: { ...g[empId]?.[day], [part]: val } },
    }));
  }

  /** ===== Render ===== */
  const anyLoading = loadingEmps || loadingDtr;

  return (
    <>
      <PageHeader
        title="DTR Bulk Entry"
        subtitle={
          mode === "csv"
            ? "CSV import/export — employee_id/employee_code, work_date, time_in, time_out"
            : "Fast entry: Tab → next • Enter/↓ → next row • Ctrl/Cmd+S to save"
        }
        actions={
          <>
            <button
              className="btn btn-ghost"
              onClick={() =>
                setDensity((d) =>
                  d === "comfortable" ? "dense" : "comfortable",
                )
              }
              title="Toggle density"
            >
              {density === "comfortable" ? "Compact" : "Comfortable"}
            </button>
            <button className="btn btn-ghost" onClick={handleExportCsv}>
              Export CSV
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || anyLoading}
            >
              {saving ? "Saving…" : "Save All"}
            </button>
            <button className="btn btn-ghost" onClick={() => history.back()}>
              Back
            </button>
          </>
        }
      >
        {/* ===== Toolbar (mode + date + employee + import) ===== */}
        <div className="card p-3 mb-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm">Mode</label>
            <select
              className="select w-44"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              <option value="all">All employees (Weekly)</option>
              <option value="single">Per employee (Monthly)</option>
              <option value="csv">CSV import/export</option>
            </select>

            {mode === "all" && (
              <>
                <label className="text-sm ml-2">Week starting</label>
                <input
                  type="date"
                  className="input w-44"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                />
              </>
            )}

            {mode === "single" && (
              <>
                <label className="text-sm ml-2">Month</label>
                <input
                  type="month"
                  className="input w-44"
                  value={ym}
                  onChange={(e) => setYm(e.target.value)}
                />
                <label className="text-sm">Employee</label>
                <select
                  className="select w-64"
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} {e.code ? `(${e.code})` : ""}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div className="flex-1" />
            <label className="btn btn-ghost cursor-pointer">
              Import CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImportCsv(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          {mode !== "csv" && runStart && runEnd && (
            <div className="text-xs text-muted-foreground mt-2">
              Current payroll run:{" "}
              <span className="font-medium text-foreground">
                {new Date(runStart).toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>{" "}
              –{" "}
              <span className="font-medium text-foreground">
                {new Date(runEnd).toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {/* ===== Main content by mode ===== */}
        {mode === "csv" ? (
          <div className="card p-6 text-sm text-muted-foreground">
            Import a CSV file or Export the current scope with the buttons
            above. After importing, data is saved immediately and the grid will
            reload for your current scope.
          </div>
        ) : anyLoading ? (
          <div className="card p-8 text-center text-muted-foreground">
            Loading…
          </div>
        ) : mode === "single" ? (
          <MonthSingleTable
            days={days}
            employee={scopedEmployees[0]}
            grid={grid}
            updateCell={updateCell}
            density={density}
            onSave={handleSave}
            inRun={inRun}
          />
        ) : (
          <div className="card p-3">
            <div
              className={`overflow-auto rounded-2xl ${
                density === "dense" ? "text-[13px]" : "text-sm"
              }`}
              ref={tableRef}
            >
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b border-border">
                    <th
                      className={`px-3 ${
                        density === "dense" ? "py-1.5" : "py-2"
                      } text-left w-56`}
                    >
                      Employee
                    </th>
                    {days.map((d) => (
                      <th
                        key={d}
                        className={`px-3 ${
                          density === "dense" ? "py-1.5" : "py-2"
                        } text-center`}
                        colSpan={2}
                      >
                        <div className="font-medium">
                          {new Date(d).toLocaleDateString("en-PH", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          IN / OUT
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scopedEmployees.map((e, r) => (
                    <tr
                      key={e.id}
                      className={`border-b border-border/60 transition-colors ${
                        activeRow === r ? "bg-muted/60" : "hover:bg-muted/50"
                      }`}
                    >
                      <td
                        className={`px-3 ${
                          density === "dense" ? "py-1.5" : "py-2"
                        } whitespace-nowrap`}
                      >
                        <div className="font-medium">{e.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.code || e.id}
                        </div>
                      </td>

                      {days.map((d, dayIndex) => {
                        const baseCol = 1 + dayIndex * 2;
                        const cell = grid[e.id]?.[d] ?? {
                          in1: "",
                          out1: "",
                          in2: "",
                          out2: "",
                        };
                        const disabled = !inRun(d);
                        return (
                          <td
                            key={d}
                            className={`px-2 ${
                              density === "dense" ? "py-1" : "py-1.5"
                            }`}
                          >
                            <div className="grid grid-cols-2 gap-2">
                              <TimeInput
                                value={cell.in1}
                                placeholder="08:00"
                                onChange={(v) => updateCell(e.id, d, "in1", v)}
                                onKeyDown={(ev) => handleMove(ev, r, baseCol)}
                                onFocus={() => setActiveRow(r)}
                                data-row={r}
                                data-col={baseCol}
                                dense={density === "dense"}
                                disabled={disabled}
                              />
                              <TimeInput
                                value={cell.out1}
                                placeholder="17:00"
                                onChange={(v) =>
                                  updateCell(e.id, d, "out1", v)
                                }
                                onKeyDown={(ev) =>
                                  handleMove(ev, r, baseCol + 1)
                                }
                                onFocus={() => setActiveRow(r)}
                                data-row={r}
                                data-col={baseCol + 1}
                                dense={density === "dense"}
                                disabled={disabled}
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-muted-foreground mt-3">
              Tip: Click first cell → use Tab to move across the week, Enter to
              go to the next employee.
            </div>
          </div>
        )}
      </PageHeader>

      {toast && (
        <Toast
          kind={toast.kind}
          message={toast.msg}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

/** ===============================
 *  Per-Employee Month Table
 *  - IN1/OUT1 + optional IN2/OUT2
 *  - Alt+↓ copies value to next day (same column)
 *  - Disables cells outside ?start=&end=
 *  =============================== */
function MonthSingleTable({
  days,
  employee,
  grid,
  updateCell,
  density,
  onSave,
  inRun,
}: {
  days: string[];
  employee: { id: string; full_name: string; code?: string | null } | undefined;
  grid: Record<string, Record<string, DayCell>>;
  updateCell: (
    empId: string,
    day: string,
    part: "in1" | "out1" | "in2" | "out2",
    val: string,
  ) => void;
  density: "comfortable" | "dense";
  onSave: () => void;
  inRun: (d: string) => boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rowPad = density === "dense" ? "py-1.5" : "py-2";
  const inputPad = density === "dense" ? "px-2 py-0.5" : "px-2 py-1";
  const [showSplit, setShowSplit] = useState(true);

  // Ctrl/Cmd+S save
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave]);

  function focusCell(r: number, c: number) {
    const el = ref.current?.querySelector<HTMLInputElement>(
      `[data-r="${r}"][data-c="${c}"]`,
    );
    el?.focus();
    el?.select();
  }

  function onKey(
    e: React.KeyboardEvent<HTMLInputElement>,
    r: number,
    c: number,
    day: string,
    part: "in1" | "out1" | "in2" | "out2",
  ) {
    // Alt+ArrowDown: copy to next day (same column)
    if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault();
      const input = e.currentTarget.value;
      const nextIndex = Math.min(r + 1, days.length - 1);
      const nextDay = days[nextIndex];
      updateCell(employee!.id, nextDay, part, input);
      focusCell(nextIndex, c);
      return;
    }

    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      focusCell(Math.min(r + 1, days.length - 1), c);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusCell(Math.max(r - 1, 0), c);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const maxCol = showSplit ? 3 : 1; // 0..3 or 0..1
      const next = e.shiftKey ? Math.max(c - 1, 0) : Math.min(c + 1, maxCol);
      focusCell(r, next);
    }
  }

  if (!employee) {
    return (
      <div className="card p-6 text-sm text-muted-foreground">
        Select an employee.
      </div>
    );
  }

  return (
    <div className="card p-3">
      <div className="px-3 pb-2 text-sm text-muted-foreground flex items-center gap-3">
        <div>
          Editing:{" "}
          <span className="font-medium text-foreground">
            {employee.full_name}
          </span>{" "}
          <span className="text-muted-foreground">
            ({employee.code || employee.id})
          </span>
        </div>
        <label className="ml-auto inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="accent-foreground"
            checked={showSplit}
            onChange={(e) => setShowSplit(e.target.checked)}
          />
          Show IN2/OUT2
        </label>
      </div>

      <div className="overflow-auto rounded-2xl" ref={ref}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border">
              <th className={`px-3 ${rowPad} text-left w-44`}>Day</th>
              <th className={`px-3 ${rowPad} text-left w-36`}>IN 1</th>
              <th className={`px-3 ${rowPad} text-left w-36`}>OUT 1</th>
              {showSplit && (
                <>
                  <th className={`px-3 ${rowPad} text-left w-36`}>IN 2</th>
                  <th className={`px-3 ${rowPad} text-left w-36`}>OUT 2</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {days.map((d, r) => {
              const cell = grid[employee.id]?.[d] ?? {
                in1: "",
                out1: "",
                in2: "",
                out2: "",
              };
              const date = new Date(d);
              const dayNum = String(date.getDate()).padStart(2, "0");
              const wk = date.toLocaleDateString("en-PH", {
                weekday: "short",
              });
              const disabled = !inRun(d);

              return (
                <tr
                  key={d}
                  className={`border-b border-border/60 ${
                    disabled ? "opacity-60" : "hover:bg-muted/50"
                  }`}
                >
                  {/* Day column */}
                  <td className={`px-3 ${rowPad} whitespace-nowrap`}>
                    <div className="font-medium">
                      {dayNum}{" "}
                      <span className="text-muted-foreground">{wk}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {date.toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </td>

                  {/* IN 1 */}
                  <td className={`px-3 ${rowPad}`}>
                    <input
                      disabled={disabled}
                      value={cell.in1}
                      placeholder="08:00"
                      onChange={(e) =>
                        updateCell(employee.id, d, "in1", e.target.value)
                      }
                      onKeyDown={(ev) => onKey(ev, r, 0, d, "in1")}
                      className={`w-36 rounded-xl ${inputPad} bg-background border border-border
                                      focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring ${
                                        disabled ? "opacity-50 pointer-events-none" : ""
                                      }`}
                      inputMode="numeric"
                      data-r={r}
                      data-c={0}
                      onBlur={(e) => {
                        const isoVal = toISO(d, e.target.value);
                        if (isoVal) {
                          const normalized = toHHMM(isoVal);
                          updateCell(employee.id, d, "in1", normalized);
                        }
                      }}
                    />
                  </td>

                  {/* OUT 1 */}
                  <td className={`px-3 ${rowPad}`}>
                    <input
                      disabled={disabled}
                      value={cell.out1}
                      placeholder="12:00"
                      onChange={(e) =>
                        updateCell(employee.id, d, "out1", e.target.value)
                      }
                      onKeyDown={(ev) =>
                        onKey(ev, r, showSplit ? 1 : 1, d, "out1")
                      }
                      className={`w-36 rounded-xl ${inputPad} bg-background border border-border
                                      focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring ${
                                        disabled ? "opacity-50 pointer-events-none" : ""
                                      }`}
                      inputMode="numeric"
                      data-r={r}
                      data-c={1}
                      onBlur={(e) => {
                        const isoVal = toISO(d, e.target.value);
                        if (isoVal) {
                          const normalized = toHHMM(isoVal);
                          updateCell(employee.id, d, "out1", normalized);
                        }
                      }}
                    />
                  </td>

                  {/* IN 2 */}
                  {showSplit && (
                    <>
                      <td className={`px-3 ${rowPad}`}>
                        <input
                          disabled={disabled}
                          value={cell.in2}
                          placeholder="13:00"
                          onChange={(e) =>
                            updateCell(employee.id, d, "in2", e.target.value)
                          }
                          onKeyDown={(ev) => onKey(ev, r, 2, d, "in2")}
                          className={`w-36 rounded-xl ${inputPad} bg-background border border-border
                                          focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring ${
                                            disabled ? "opacity-50 pointer-events-none" : ""
                                          }`}
                          inputMode="numeric"
                          data-r={r}
                          data-c={2}
                          onBlur={(e) => {
                            const isoVal = toISO(d, e.target.value);
                            if (isoVal) {
                              const normalized = toHHMM(isoVal);
                              updateCell(employee.id, d, "in2", normalized);
                            }
                          }}
                        />
                      </td>

                      {/* OUT 2 */}
                      <td className={`px-3 ${rowPad}`}>
                        <input
                          disabled={disabled}
                          value={cell.out2}
                          placeholder="17:30"
                          onChange={(e) =>
                            updateCell(employee.id, d, "out2", e.target.value)
                          }
                          onKeyDown={(ev) => onKey(ev, r, 3, d, "out2")}
                          className={`w-36 rounded-xl ${inputPad} bg-background border border-border
                                          focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring ${
                                            disabled ? "opacity-50 pointer-events-none" : ""
                                          }`}
                          inputMode="numeric"
                          data-r={r}
                          data-c={3}
                          onBlur={(e) => {
                            const isoVal = toISO(d, e.target.value);
                            if (isoVal) {
                              const normalized = toHHMM(isoVal);
                              updateCell(employee.id, d, "out2", normalized);
                            }
                          }}
                        />
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground mt-3">
        Tips: <b>Alt+↓</b> to copy the current time to the next day • Enter/↓
        next day • ↑ previous • Tab switches between columns • Ctrl/Cmd+S saves
        all.
      </div>
    </div>
  );
}
