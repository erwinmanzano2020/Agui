"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { resolveEffectiveShift } from "@/lib/shifts";

/** ======= EDIT THIS TO CHANGE HEADER NAME ======= */
const COMPANY_NAME = "Vangie Store";
/** =============================================== */

type Emp = {
  id: string;
  code: string;
  full_name: string;
  rate_per_day: number;
  status?: string;
};

type Dtr = {
  employee_id: string;
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  minutes_regular: number | null;
  minutes_ot: number | null;
};

type Seg = {
  employee_id: string;
  work_date: string;
  start_at: string | null;
  end_at: string | null;
};

type Ded = {
  employee_id: string;
  effective_date: string;
  amount: number;
  note?: string | null;
  type?: string | null;
};

type AttMode = "PRORATE" | "DEDUCTION";

function monthRange(ym: string) {
  // ym = "YYYY-MM"
  const [y, m] = ym.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const toNext = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  return { from, toNext };
}

function monthEnd(ym: string) {
  // ym = "YYYY-MM"
  const { toNext } = monthRange(ym);
  const d = new Date(toNext);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10); // inclusive last day
}

function fmtHM(ts: string | null) {
  if (!ts) return "--";
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// NOTE: we’ll keep your peso formatter here (with thousand separators)
// Later we can centralize this under a global currency/format setting.
function peso(n: number) {
  return n.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  });
}

export default function BulkPayslipPageClient() {
  // Controls
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [loading, setLoading] = useState(false);

  // Settings
  const [standard, setStandard] = useState<number>(630);
  const [otMult, setOtMult] = useState<number>(1.0);
  const [attMode, setAttMode] = useState<AttMode>("DEDUCTION");

  // Data
  const [emps, setEmps] = useState<Emp[]>([]);
  const [dtrRows, setDtrRows] = useState<Dtr[]>([]);
  const [segments, setSegments] = useState<Seg[]>([]);
  const [deds, setDeds] = useState<Ded[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Derived maps
  const dtrByEmp = useMemo(() => {
    const m = new Map<string, Dtr[]>();
    for (const r of dtrRows) {
      if (!m.has(r.employee_id)) m.set(r.employee_id, []);
      m.get(r.employee_id)!.push(r);
    }
    for (const [k, arr] of m) {
      arr.sort((a, b) => a.work_date.localeCompare(b.work_date));
      m.set(k, arr);
    }
    return m;
  }, [dtrRows]);

  const segsByEmp = useMemo(() => {
    const m = new Map<string, Map<string, Seg[]>>();
    for (const s of segments) {
      if (!m.has(s.employee_id)) m.set(s.employee_id, new Map());
      const inner = m.get(s.employee_id)!;
      if (!inner.has(s.work_date)) inner.set(s.work_date, []);
      inner.get(s.work_date)!.push(s);
    }
    // sort segments per day
    for (const inner of m.values()) {
      for (const [date, arr] of inner) {
        arr.sort((a, b) => (a.start_at || "").localeCompare(b.start_at || ""));
        inner.set(date, arr);
      }
    }
    return m;
  }, [segments]);

  const dedsByEmp = useMemo(() => {
    const m = new Map<string, Ded[]>();
    for (const d of deds) {
      if (!m.has(d.employee_id)) m.set(d.employee_id, []);
      m.get(d.employee_id)!.push(d);
    }
    return m;
  }, [deds]);

  // Load employees + settings once
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const sb = getSupabase();
      if (!sb) {
        if (!cancelled) {
          setErr("Supabase is not configured. Check environment variables.");
          setEmps([]);
        }
        return;
      }

      try {
        if (!cancelled) setErr(null);

        const [
          { data: empData, error: empError },
          { data: setData, error: setError },
        ] = await Promise.all([
          sb
            .from("employees")
            .select("id, code, full_name, rate_per_day, status")
            .neq("status", "archived")
            .order("full_name"),
          sb
            .from("settings_payroll")
            .select("standard_minutes_per_day, ot_multiplier, attendance_mode")
            .eq("id", 1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (empError) {
          setErr(empError.message);
          setEmps([]);
        } else {
          setEmps((empData || []) as Emp[]);
        }

        if (setError) {
          setErr((prev) => prev ?? setError.message);
        } else if (setData) {
          setStandard(Number(setData.standard_minutes_per_day ?? 630));
          setOtMult(Number(setData.ot_multiplier ?? 1.0));
          setAttMode(
            String(setData.attendance_mode || "")
              .toUpperCase()
              .startsWith("PRO")
              ? "PRORATE"
              : "DEDUCTION",
          );
        }
      } catch (error) {
        if (!cancelled)
          setErr(
            error instanceof Error
              ? error.message
              : "Failed to load payslip data.",
          );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function run() {
    setErr(null);
    setLoading(true);
    const { from, toNext } = monthRange(month);

    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase is not configured. Check environment variables.");
      setLoading(false);
      return;
    }

    try {
      // Pull all rows for the month (for all active employees)
      const [
        { data: dtrData, error: dtrError },
        { data: segData, error: segError },
        { data: dedData, error: dedError },
      ] = await Promise.all([
        sb
          .from("dtr_entries")
          .select(
            "employee_id, work_date, time_in, time_out, minutes_regular, minutes_ot",
          )
          .gte("work_date", from)
          .lt("work_date", toNext)
          .order("employee_id")
          .order("work_date"),
        sb
          .from("dtr_segments")
          .select("employee_id, work_date, start_at, end_at")
          .gte("work_date", from)
          .lt("work_date", toNext)
          .order("employee_id")
          .order("work_date")
          .order("start_at", { ascending: true }),
        sb
          .from("payroll_deductions")
          .select("employee_id, effective_date, amount, note, type")
          .gte("effective_date", from)
          .lt("effective_date", toNext)
          .order("employee_id")
          .order("effective_date"),
      ]);

      if (dtrError || segError || dedError) {
        throw new Error(
          dtrError?.message ??
            segError?.message ??
            dedError?.message ??
            "Failed to load payroll data.",
        );
      }

      setDtrRows((dtrData || []) as Dtr[]);
      setSegments((segData || []) as Seg[]);
      setDeds((dedData || []) as Ded[]);
    } catch (error) {
      setErr(
        error instanceof Error ? error.message : "Failed to load payroll data.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Compute a payslip summary for an employee (present-only)
  // Basic Pay comes from mixed-rate API (as-of daily rates). OT & late/UT keep your existing logic.
  async function computeSlip(e: Emp, rows: Dtr[]) {
    // Present dates (any minutes)
    const presentRows = rows.filter(
      (r) => (r.minutes_regular || 0) > 0 || (r.minutes_ot || 0) > 0,
    );
    const presentDates: string[] = [];
    {
      const seen = new Set<string>();
      for (const r of presentRows) {
        if (!seen.has(r.work_date)) {
          seen.add(r.work_date);
          presentDates.push(r.work_date);
        }
      }
    }

    // Call the mixed-rate API to get daily basic pay for the period
    const from = `${month}-01`;
    const to = monthEnd(month);
    let basicPayMixed = 0;
    let mixedDaysPresent = 0;

    try {
      const r = await fetch("/api/payslip/daily", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employeeId: e.id,
          from,
          to,
          presentDays: presentDates,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error || "Request failed");
      basicPayMixed = Number(json?.gross || 0);
      mixedDaysPresent = Number(json?.daysPresent || presentDates.length);
    } catch (err) {
      console.error("Mixed-rate API error:", err);
      // Fallback: use your old flat daily rate per present day
      basicPayMixed = presentDates.length * Number(e.rate_per_day || 0);
      mixedDaysPresent = presentDates.length;
    }

    // Keep your original OT + late/UT computations
    let regSum = 0,
      otSum = 0,
      otPay = 0,
      shortMins = 0,
      shortVal = 0;

    for (const r of presentRows) {
      const reg = Math.max(0, Number(r.minutes_regular || 0));
      const ot = Math.max(0, Number(r.minutes_ot || 0));

      regSum += reg;
      otSum += ot;

      // per-minute derived from current employee.rate_per_day (your existing approach)
      const eff = await resolveEffectiveShift(e.id, r.work_date);
      const perDayStandard = eff?.standard_minutes ?? standard;
      const perMinute = e.rate_per_day / perDayStandard;

      const capped = Math.min(reg, perDayStandard);
      const shortfall = Math.max(0, perDayStandard - capped);

      // DEDUCTION mode: add late/UT as a separate deduction (your current behavior)
      if (attMode === "DEDUCTION") {
        shortMins += shortfall;
        shortVal += perMinute * shortfall;
      } else {
        // PRORATE mode: we already got basic pay from mixed-rate API (presence-based),
        // so we do NOT additional-prorate here to avoid double-penalizing.
        // (If you prefer true per-minute proration by rate history, we can add that later.)
      }

      // OT pay (based on your current per-minute and multiplier)
      otPay += perMinute * ot * otMult;
    }

    const empDeds = dedsByEmp.get(e.id) || [];
    const otherDeds = empDeds.reduce((s, d) => s + Number(d.amount || 0), 0);
    const gross = basicPayMixed + otPay;
    const totalDeductions =
      (attMode === "DEDUCTION" ? shortVal : 0) + otherDeds;
    const net = Math.max(0, gross - totalDeductions);

    return {
      presentDays: mixedDaysPresent,
      regSum,
      otSum,
      basicPay: basicPayMixed,
      otPay,
      shortMins,
      shortVal,
      otherDeds,
      gross,
      totalDeductions,
      net,
    };
  }

  // Decide which employees actually have a payslip this month
  const employeesWithData = useMemo(() => {
    const set = new Set<string>();
    for (const r of dtrRows) {
      if ((r.minutes_regular || 0) > 0 || (r.minutes_ot || 0) > 0) {
        set.add(r.employee_id);
      }
    }
    for (const d of deds) set.add(d.employee_id); // if they only have deductions, include too
    return emps.filter((e) => set.has(e.id));
  }, [emps, dtrRows, deds]);

  // Group deductions by type for an employee
  function groupDedsForEmp(empId: string) {
    type Group = { label: string; total: number; count: number };
    const acc = new Map<string, Group>();
    const rows = dedsByEmp.get(empId) || [];
    for (const d of rows) {
      const raw = (d.type || "other").toString().trim().toLowerCase();
      const label =
        raw === "loan" ? "Loan" : raw === "goods" ? "Goods" : "Other";
      if (!acc.has(label)) acc.set(label, { label, total: 0, count: 0 });
      const g = acc.get(label)!;
      g.total += Number(d.amount || 0);
      g.count += 1;
    }
    const order = ["Loan", "Goods", "Other"];
    return order
      .map((k) => acc.get(k))
      .filter((g): g is Group => !!g && g.total > 0);
  }

  // Render helpers
  function dayLabel(dateISO: string) {
    const d = new Date(dateISO);
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }

  function rowSegments(empId: string, dateISO: string, r: Dtr) {
    const map = segsByEmp.get(empId);
    const list = map?.get(dateISO) || [];
    const s1 = list[0];
    const s2 = list[1];
    return {
      in1: s1 ? fmtHM(s1.start_at) : fmtHM(r.time_in),
      out1: s1 ? fmtHM(s1.end_at) : fmtHM(r.time_out),
      in2: s2 ? fmtHM(s2.start_at) : "--",
      out2: s2 ? fmtHM(s2.end_at) : "--",
    };
  }

  return (
    <div className="max-w-6xl mx-auto p-6 print:p-4">
      <h1 className="text-2xl font-semibold mb-1">Payslip (Bulk Export)</h1>
      <div className="text-sm text-gray-700 mb-4">{COMPANY_NAME}</div>

      {err && (
        <div className="mb-3 text-sm text-red-600 print:hidden">{err}</div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-2 mb-4 print:hidden">
        <input
          type="month"
          className="border rounded px-3 py-2"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        <button
          className="bg-green-600 text-white rounded px-3 py-2"
          onClick={run}
          disabled={loading}
        >
          {loading ? "Loading…" : "Run"}
        </button>
        {employeesWithData.length > 0 && (
          <button
            className="bg-gray-700 text-white rounded px-3 py-2"
            onClick={() => window.print()}
          >
            Print All
          </button>
        )}
        <div className="text-sm text-gray-600 ml-auto">
          {employeesWithData.length > 0
            ? `Ready: ${employeesWithData.length} payslip(s)`
            : "No payslips for this month yet"}
        </div>
      </div>

      {/* Payslips */}
      <div>
        {employeesWithData.map((e) => {
          const rows = dtrByEmp.get(e.id) || [];
          return (
            <PayslipCard
              key={e.id}
              emp={e}
              rows={rows}
              month={month}
              computeSlip={(rs) => computeSlip(e, rs)}
              groupDeds={() => groupDedsForEmp(e.id)}
              dayLabel={dayLabel}
              rowSegments={(r) => rowSegments(e.id, r.work_date, r)}
              attMode={attMode}
            />
          );
        })}

        {employeesWithData.length === 0 && (
          <div className="text-sm text-gray-600">
            Run for a month that has DTR or deductions.
          </div>
        )}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page {
            page-break-after: always;
          }
          table {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

/** Single payslip card with a page break for printing */
function PayslipCard(props: {
  emp: Emp;
  rows: Dtr[];
  month: string; // YYYY-MM
  attMode: AttMode;
  computeSlip: (rows: Dtr[]) => Promise<{
    presentDays: number;
    regSum: number;
    otSum: number;
    basicPay: number;
    otPay: number;
    shortMins: number;
    shortVal: number;
    otherDeds: number;
    gross: number;
    totalDeductions: number;
    net: number;
  }>;
  groupDeds: () => { label: string; total: number; count: number }[];
  dayLabel: (iso: string) => string;
  rowSegments: (r: Dtr) => {
    in1: string;
    out1: string;
    in2: string;
    out2: string;
  };
}) {
  const {
    emp,
    rows,
    month,
    computeSlip,
    groupDeds,
    dayLabel,
    rowSegments,
    attMode,
  } = props;
  const [summary, setSummary] = useState<null | Awaited<
    ReturnType<typeof computeSlip>
  >>(null);

  useEffect(() => {
    (async () => {
      const s = await computeSlip(rows);
      setSummary(s);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emp.id, rows.length, month, attMode]);

  const dGroups = groupDeds();

  // If no present days and no deductions, skip rendering entirely
  if (!summary) return null;
  if (summary.presentDays === 0 && dGroups.length === 0) return null;

  return (
    <div className="page border rounded p-4 mb-6">
      {/* Heading */}
      <div className="mb-2">
        <div className="text-lg font-semibold">Payslip</div>
        <div className="text-xs text-gray-600">
          {new Date(`${month}-01`).toLocaleString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      <div className="flex justify-between mb-3">
        <div className="text-sm text-gray-700">{/* left blank */}</div>
        <div className="text-right text-sm">
          <div>
            <span className="font-medium">Employee:</span> {emp.full_name}
          </div>
          <div>
            <span className="font-medium">Code:</span> {emp.code}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* DTR */}
        <div>
          <div className="font-medium mb-2">DTR</div>
          <table className="w-full text-xs border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1 w-16">Day</th>
                <th className="border p-1 text-center">IN 1</th>
                <th className="border p-1 text-center">OUT 1</th>
                <th className="border p-1 text-center">IN 2</th>
                <th className="border p-1 text-center">OUT 2</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const segs = rowSegments(r);
                const isSun = new Date(r.work_date).getDay() === 0;
                return (
                  <tr
                    key={`${r.employee_id}-${r.work_date}`}
                    className={isSun ? "bg-red-50 text-red-700" : ""}
                  >
                    <td className="border p-1 text-center">
                      {dayLabel(r.work_date)}
                    </td>
                    <td className="border p-1 text-center">{segs.in1}</td>
                    <td className="border p-1 text-center">{segs.out1}</td>
                    <td className="border p-1 text-center">{segs.in2}</td>
                    <td className="border p-1 text-center">{segs.out2}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td className="border p-2 text-center" colSpan={5}>
                    No DTR entries in this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Payroll computation */}
        <div>
          <div className="font-medium mb-2">Payroll Computation</div>
          <table className="w-full text-sm border">
            <tbody>
              <tr>
                <td className="border p-2">Days Present</td>
                <td className="border p-2 text-right">{summary.presentDays}</td>
              </tr>
              <tr>
                <td className="border p-2">Rate</td>
                <td className="border p-2 text-right">
                  Daily – {peso(emp.rate_per_day)}
                </td>
              </tr>
              <tr>
                <td className="border p-2">Basic Pay</td>
                <td className="border p-2 text-right">
                  {peso(summary.basicPay)}
                </td>
              </tr>
              <tr>
                <td className="border p-2">
                  OT –{" "}
                  <span className="text-gray-600">{summary.otSum} mins</span>
                </td>
                <td className="border p-2 text-right">{peso(summary.otPay)}</td>
              </tr>
              <tr className="font-semibold bg-yellow-50">
                <td className="border p-2">Gross</td>
                <td className="border p-2 text-right">{peso(summary.gross)}</td>
              </tr>

              <tr>
                <td className="border p-2 font-medium" colSpan={2}>
                  Deductions
                </td>
              </tr>
              {attMode === "DEDUCTION" && summary.shortVal > 0 && (
                <tr>
                  <td className="border p-2 pl-6">
                    Late/UT –{" "}
                    <span className="text-gray-600">
                      {summary.shortMins} mins
                    </span>
                  </td>
                  <td className="border p-2 text-right">
                    {peso(summary.shortVal)}
                  </td>
                </tr>
              )}
              {dGroups.map((g) => (
                <tr key={g.label}>
                  <td className="border p-2 pl-6">
                    {g.label}
                    {g.count > 1 ? (
                      <span className="text-gray-500"> (×{g.count})</span>
                    ) : null}
                  </td>
                  <td className="border p-2 text-right">{peso(g.total)}</td>
                </tr>
              ))}

              <tr className="font-semibold bg-yellow-50">
                <td className="border p-2">Total Deductions</td>
                <td className="border p-2 text-right">
                  {peso(summary.totalDeductions)}
                </td>
              </tr>
              <tr className="font-semibold bg-gray-100">
                <td className="border p-2">Net Pay</td>
                <td className="border p-2 text-right">{peso(summary.net)}</td>
              </tr>
            </tbody>
          </table>

          {/* Acknowledgement */}
          <div className="mt-6 text-xs text-gray-700 leading-relaxed">
            I acknowledge that the information stated in this payslip is true
            and correct, and I accept the computations of my compensation and
            deductions for the period indicated.
          </div>

          {/* Signatures */}
          <div className="mt-8 grid grid-cols-2 gap-8 text-xs">
            <div>
              ______________________________
              <div>Employee Signature / Date</div>
            </div>
            <div className="text-right">
              ______________________________
              <div>Manager / Owner</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
