"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "../../../components/ui/page-header";
import { Toast } from "../../../components/ui/toast";
import { getManilaTimeString, toManilaTimestamp } from "@/lib/hr/timezone";
import type { ShiftSegment } from "@/lib/types";

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
function toHHMM(isoStr?: string | null) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  const manilaTime = getManilaTimeString(d);
  return manilaTime.slice(0, 5);
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
  return toManilaTimestamp(date, `${hh}:${mm}:00`);
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error ?? "unknown error");
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
}) {
  const pad = props.dense ? "px-2 py-0.5" : "px-2 py-1";
  return (
    <div data-row={props["data-row"]} data-col={props["data-col"]}>
      <input
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        onKeyDown={props.onKeyDown}
        onFocus={props.onFocus}
        className={`w-full rounded-xl ${pad} bg-background border border-border
                       focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring
                       text-[0.93em]`}
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

/** ========= Client Page ========= */
export default function DtrBulkClient() {
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

  /** ===== Density / UI ===== */
  const [density, setDensity] = useState<"comfortable" | "dense">(
    "comfortable",
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    msg: string;
  } | null>(null);

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

  // Ensure we always have a selected employee in single mode once data is available
  useEffect(() => {
    if (mode === "single" && !selectedEmpId && employees.length) {
      setSelectedEmpId(employees[0].id);
    }
  }, [mode, selectedEmpId, employees]);

  /** ===== Load employees once ===== */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingEmps(true);
      const response = await fetch("/api/hr/employees");
      const payload = (await response.json().catch(() => null)) as
        | { employees?: Emp[]; error?: string }
        | null;

      if (cancelled) return;

      if (!response.ok || !payload || payload.error) {
        setToast({
          kind: "error",
          msg: payload?.error ?? "Load employees failed",
        });
        setLoadingEmps(false);
        return;
      }

      const emps = (payload.employees ?? []).map((emp) => ({
        id: emp.id,
        code: emp.code ?? undefined,
        full_name: emp.full_name,
      } satisfies Emp));

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
    if (!scopedEmployees.length || !days.length) {
      setLoadingDtr(false);
      return;
    }

    (async () => {
      setLoadingDtr(true);

      const from = days[0];
      const to = days[days.length - 1];
      const fallbackEmpId =
        mode === "single" && !selectedEmpId && employees[0]
          ? employees[0].id
          : undefined;
      const singleEmployeeId =
        mode === "single" ? selectedEmpId || fallbackEmpId : undefined;

      try {
        if (mode === "single") {
          if (!singleEmployeeId) {
            if (!cancelled) setLoadingDtr(false);
            return;
          }
          const response = await fetch("/api/payroll/dtr-bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "load",
              mode: "single",
              from,
              to,
              employeeId: singleEmployeeId,
            }),
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload?.error || response.statusText);
          }

          setGrid((prev) => {
            const next = { ...prev };
            const byDay = new Map<
              string,
              Array<{ time_in: string | null; time_out: string | null }>
            >();
            const segmentRows = (payload.segments ?? []) as ShiftSegment[];
            segmentRows.forEach((row) => {
              const d = String(row.work_date);
              if (!byDay.has(d)) byDay.set(d, []);
              byDay.get(d)!.push({ time_in: row.time_in, time_out: row.time_out });
            });

            const eid = singleEmployeeId;
            if (!next[eid]) next[eid] = {};
            for (const d of days) {
              const list = (byDay.get(d) || []).slice(0, 2);
              const s1 = list[0];
              const s2 = list[1];
              next[eid][d] = {
                in1: s1 ? toHHMM(s1.time_in) : "",
                out1: s1 ? toHHMM(s1.time_out) : "",
                in2: s2 ? toHHMM(s2.time_in) : "",
                out2: s2 ? toHHMM(s2.time_out) : "",
              };
            }
            return next;
          });

          return;
        }

        const employeeIds = scopedEmployees.map((e) => e.id);
        const response = await fetch("/api/payroll/dtr-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "load",
            mode: "all",
            from,
            to,
            employeeIds,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || response.statusText);
        }

        setGrid((prev) => {
          const next = { ...prev };
          for (const row of (payload.entries ?? []) as Array<{
            employee_id: string;
            work_date: string;
            time_in: string | null;
            time_out: string | null;
          }>) {
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
      } catch (error: unknown) {
        if (!cancelled) {
          const message = formatError(error);
          console.error("Load DTR failed", error);
          setToast({ kind: "error", msg: `Load DTR failed: ${message}` });
        }
      } finally {
        if (!cancelled) setLoadingDtr(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, selectedEmpId, scopedEmployees, days, employees]);

  /** ===== Save (bulk) ===== */
  async function handleSave() {
    setSaving(true);
    try {
      if (mode === "single" && scopedEmployees[0]) {
        const response = await fetch("/api/payroll/dtr-bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save",
            mode: "single",
            employeeId: scopedEmployees[0].id,
            days,
            grid,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || response.statusText);
        }

        setToast({ kind: "success", msg: "Saved!" });
        setSaving(false);
        setYm((m) => m);
        return;
      }

      const response = await fetch("/api/payroll/dtr-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          mode: "all",
          employeeIds: scopedEmployees.map((e) => e.id),
          days,
          grid,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || response.statusText);
      }

      setToast({ kind: "success", msg: "Saved!" });
    } catch (error: unknown) {
      const message = formatError(error);
      console.error("Save DTR failed", error);
      setToast({ kind: "error", msg: `Save failed: ${message}` });
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

      const gridPayload: Record<string, Record<string, DayCell>> = {};
      for (const row of payload) {
        if (!gridPayload[row.employee_id]) gridPayload[row.employee_id] = {};
        gridPayload[row.employee_id][row.work_date] = {
          in1: row.time_in ? toHHMM(row.time_in) : "",
          out1: row.time_out ? toHHMM(row.time_out) : "",
          in2: "",
          out2: "",
        };
      }

      const response = await fetch("/api/payroll/dtr-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          mode: "all",
          employeeIds: Array.from(new Set(payload.map((p) => p.employee_id))),
          days: Array.from(new Set(payload.map((p) => p.work_date))).sort(),
          grid: gridPayload,
        }),
      });
      const resPayload = await response.json();
      if (!response.ok) {
        throw new Error(resPayload?.error || response.statusText);
      }

      setToast({ kind: "success", msg: `Imported ${payload.length} rows` });

      // Reload current scope after import
      setWeekStart((w) => w);
      setYm((m) => m);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error ?? "unknown error");
      setToast({ kind: "error", msg: `Import failed: ${message}` });
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
            : "Fast entry: Tab → next • Enter ↓ → next row • Ctrl/Cmd+S to save"
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
          {mode === "csv" && (
            <div className="text-xs text-muted-foreground mt-2">
              Expected columns: <code>employee_id</code> <em>or</em>{" "}
              <code>employee_code</code>, <code>work_date</code> (YYYY-MM-DD),{" "}
              <code>time_in</code>, <code>time_out</code>.
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
          />
        ) : (
          <div className="card p-3">
          <DtrWeeklyTable
            days={days}
            employees={scopedEmployees}
            density={density}
            grid={grid}
            updateCell={updateCell}
          />
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

/** ========== Weekly Table (extracted for clarity) ========== */
function DtrWeeklyTable({
  days,
  employees,
  density,
  grid,
  updateCell,
}: {
  days: string[];
  employees: Emp[];
  density: "comfortable" | "dense";
  grid: Record<string, Record<string, DayCell>>;
  updateCell: (
    empId: string,
    day: string,
    part: "in1" | "out1" | "in2" | "out2",
    val: string,
  ) => void;
}) {
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
      focusCell(Math.min(row + 1, employees.length - 1), col);
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
      focusCell(Math.min(row + 1, employees.length - 1), col);
      return;
    }
    if (key === "ArrowUp") {
      e.preventDefault();
      focusCell(Math.max(0, row - 1), col);
      return;
    }
  }

  return (
    <div>
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
                  <div className="text-xs text-muted-foreground">IN / OUT</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((e, r) => (
              <tr
                key={e.id}
                className={`border-b border-border/60 transition-colors hover:bg-muted/50`}
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
                          data-row={r}
                          data-col={baseCol}
                          dense={density === "dense"}
                        />
                        <TimeInput
                          value={cell.out1}
                          placeholder="17:00"
                          onChange={(v) => updateCell(e.id, d, "out1", v)}
                          onKeyDown={(ev) => handleMove(ev, r, baseCol + 1)}
                          data-row={r}
                          data-col={baseCol + 1}
                          dense={density === "dense"}
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
        Tip: Click first cell → Tab moves across the week; Enter moves to next
        employee.
      </div>
    </div>
  );
}

/** ===============================
 *  Per-Employee Month Table
 *  - IN1/OUT1 + optional IN2/OUT2
 *  - Alt+↓ copies value to next day (same column)
 *  =============================== */
function MonthSingleTable({
  days,
  employee,
  grid,
  updateCell,
  density,
  onSave,
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
              const wk = date.toLocaleDateString("en-PH", { weekday: "short" });

              return (
                <tr
                  key={d}
                  className="border-b border-border/60 hover:bg-muted/50"
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
                      value={cell.in1}
                      placeholder="08:00"
                      onChange={(e) =>
                        updateCell(employee.id, d, "in1", e.target.value)
                      }
                      onKeyDown={(ev) => onKey(ev, r, 0, d, "in1")}
                      className={`w-36 rounded-xl ${inputPad} bg-background border border-border
                                      focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring`}
                      inputMode="numeric"
                      data-r={r}
                      data-c={0}
                      onBlur={(e) => {
                        const isoVal = toISO(d, e.target.value);
                        if (isoVal)
                          updateCell(employee.id, d, "in1", toHHMM(isoVal));
                      }}
                    />
                  </td>

                  {/* OUT 1 */}
                  <td className={`px-3 ${rowPad}`}>
                    <input
                      value={cell.out1}
                      placeholder="12:00"
                      onChange={(e) =>
                        updateCell(employee.id, d, "out1", e.target.value)
                      }
                      onKeyDown={(ev) => onKey(ev, r, 1, d, "out1")}
                      className={`w-36 rounded-xl ${inputPad} bg-background border border-border
                                      focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring`}
                      inputMode="numeric"
                      data-r={r}
                      data-c={1}
                      onBlur={(e) => {
                        const isoVal = toISO(d, e.target.value);
                        if (isoVal)
                          updateCell(employee.id, d, "out1", toHHMM(isoVal));
                      }}
                    />
                  </td>

                  {/* IN 2 / OUT 2 */}
                  {showSplit && (
                    <>
                      <td className={`px-3 ${rowPad}`}>
                        <input
                          value={cell.in2}
                          placeholder="13:00"
                          onChange={(e) =>
                            updateCell(employee.id, d, "in2", e.target.value)
                          }
                          onKeyDown={(ev) => onKey(ev, r, 2, d, "in2")}
                          className={`w-36 rounded-xl ${inputPad} bg-background border border-border
                                          focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring`}
                          inputMode="numeric"
                          data-r={r}
                          data-c={2}
                          onBlur={(e) => {
                            const isoVal = toISO(d, e.target.value);
                            if (isoVal)
                              updateCell(employee.id, d, "in2", toHHMM(isoVal));
                          }}
                        />
                      </td>
                      <td className={`px-3 ${rowPad}`}>
                        <input
                          value={cell.out2}
                          placeholder="17:30"
                          onChange={(e) =>
                            updateCell(employee.id, d, "out2", e.target.value)
                          }
                          onKeyDown={(ev) => onKey(ev, r, 3, d, "out2")}
                          className={`w-36 rounded-xl ${inputPad} bg-background border border-border
                                          focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring`}
                          inputMode="numeric"
                          data-r={r}
                          data-c={3}
                          onBlur={(e) => {
                            const isoVal = toISO(d, e.target.value);
                            if (isoVal)
                              updateCell(
                                employee.id,
                                d,
                                "out2",
                                toHHMM(isoVal),
                              );
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
        Tips: <b>Alt+↓</b> copy to next day • Enter/↓ next day • ↑ previous •
        Tab switches columns • Ctrl/Cmd+S save.
      </div>
    </div>
  );
}
