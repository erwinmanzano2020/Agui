"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { resolveEffectiveShift } from "@/lib/shifts";

type Emp = {
  id: string;
  code: string;
  full_name: string;
  rate_per_day: number;
};

type Dtr = {
  employee_id: string;
  work_date: string;
  minutes_regular: number;
  minutes_ot: number;
  minutes_late?: number | null;
  minutes_undertime?: number | null;
};

type Ded = { employee_id: string; effective_date: string; amount: number };

type AttMode = "PRORATE" | "DEDUCTION";

type PreviewRow = {
  employee_id: string;
  name: string;
  reg: number;
  ot: number;
  lateUTMins: number;
  lateUTValue: number;
  basicPay: number;
  otPay: number;
  gross: number;
  otherDeductions: number;
  deductions: number;
  net: number;
};

type PayrollSettingsRow = {
  standard_minutes_per_day?: number | null;
  ot_multiplier?: number | null;
  attendance_mode?: string | null;
};

// advance a YYYY-MM-DD date by 1 day (UTC-safe)
function nextDayISO(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

export default function PayrollPreviewPageClient() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("ALL");
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const [fallbackStd, setFallbackStd] = useState<number>(630);
  const [otMultiplier, setOtMultiplier] = useState<number>(1.0);
  const [attMode, setAttMode] = useState<AttMode>("DEDUCTION");

  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
          { data: empsData, error: empsError },
          { data: setData, error: settingsError },
        ] = await Promise.all([
          sb
            .from("employees")
            .select("id, code, full_name, rate_per_day")
            .neq("status", "archived")
            .order("full_name"),
          sb
            .from("settings_payroll")
            .select("standard_minutes_per_day, ot_multiplier, attendance_mode")
            .eq("id", 1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (empsError) {
          setErr(empsError.message);
          setEmps([]);
        } else {
          setEmps((empsData || []) as Emp[]);
        }

        if (settingsError) {
          setErr((prev) => prev ?? settingsError.message);
        } else if (setData) {
          const settings = setData as PayrollSettingsRow;
          if (settings.standard_minutes_per_day)
            setFallbackStd(settings.standard_minutes_per_day);
          if (settings.ot_multiplier != null)
            setOtMultiplier(Number(settings.ot_multiplier));
          if (settings.attendance_mode) {
            setAttMode(
              String(settings.attendance_mode).toUpperCase() === "PRORATE"
                ? "PRORATE"
                : "DEDUCTION",
            );
          }
        }
      } catch (error: unknown) {
        if (!cancelled)
          setErr(
            error instanceof Error
              ? error.message
              : "Failed to load payroll preview data.",
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
    setRows([]);

    const empIds = employeeId === "ALL" ? emps.map((e) => e.id) : [employeeId];
    if (empIds.length === 0) {
      setLoading(false);
      return;
    }

    const toNext = nextDayISO(to); // exclusive upper bound

    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase is not configured. Check environment variables.");
      setLoading(false);
      return;
    }

    try {
      const [{ data: dtrData, error: dtrError }, { data: dedData, error: dedError }]
        = await Promise.all([
          sb
            .from("dtr_entries")
            .select(
              "employee_id, work_date, minutes_regular, minutes_ot, minutes_late, minutes_undertime",
            )
            .in("employee_id", empIds)
            .gte("work_date", from)
            .lt("work_date", toNext), // [from, next)
          sb
            .from("payroll_deductions")
            .select("employee_id, effective_date, amount")
            .in("employee_id", empIds)
            .gte("effective_date", from)
            .lt("effective_date", toNext), // [from, next)
        ]);

      if (dtrError || dedError) {
        throw new Error(dtrError?.message ?? dedError?.message ?? "Failed to load payroll preview data.");
      }

      const dtr = (dtrData ?? []) as Dtr[];
      const deds = (dedData ?? []) as Ded[];

      // group DTR by employee
      const dtrByEmp = new Map<string, Dtr[]>();
      for (const id of empIds) dtrByEmp.set(id, []);
      for (const r of dtr) {
        if (!dtrByEmp.has(r.employee_id)) dtrByEmp.set(r.employee_id, []);
        dtrByEmp.get(r.employee_id)!.push(r);
      }

      // sum Deductions by employee
      const dedByEmp = new Map<string, number>();
      for (const id of empIds) dedByEmp.set(id, 0);
      for (const r of deds) {
        dedByEmp.set(
          r.employee_id,
          (dedByEmp.get(r.employee_id) || 0) + Number(r.amount || 0),
        );
      }

      // Presence-aware compute
      const out: PreviewRow[] = [];

      for (const eId of empIds) {
        const emp = emps.find((e) => e.id === eId);
        if (!emp) continue;

        const entriesAll = dtrByEmp.get(eId) ?? [];
        const entries = entriesAll.filter(
          (r) =>
            Number(r.minutes_regular || 0) > 0 || Number(r.minutes_ot || 0) > 0,
        );

        let totalReg = 0;
        let totalOT = 0;
        let basicPay = 0;
        let otPay = 0;
        let lateUTMins = 0;
        let lateUTValue = 0;

        for (const r of entries) {
          const reg = Math.max(0, Number(r.minutes_regular || 0));
          const ot = Math.max(0, Number(r.minutes_ot || 0));
          totalReg += reg;
          totalOT += ot;

          // Per-day context
          const eff = await resolveEffectiveShift(eId, r.work_date);
          const standard = eff.standard_minutes ?? fallbackStd;
          const perMinute = emp.rate_per_day / standard;

          // Derived shortfall (present days only)
          const capped = Math.min(reg, standard);
          const shortfall = Math.max(0, standard - capped);

          if (attMode === "PRORATE") {
            basicPay += perMinute * capped;
          } else {
            basicPay += emp.rate_per_day;
            lateUTMins += shortfall;
            lateUTValue += perMinute * shortfall;
          }

          otPay += perMinute * ot * otMultiplier;
        }

        const otherDeds = dedByEmp.get(eId) || 0;
        const gross = basicPay + otPay;
        const totalDeductions =
          otherDeds + (attMode === "DEDUCTION" ? lateUTValue : 0);
        const net = Math.max(0, gross - totalDeductions);

        out.push({
          employee_id: eId,
          name: `${emp.full_name} (${emp.code})`,
          reg: totalReg,
          ot: totalOT,
          lateUTMins,
          lateUTValue,
          basicPay,
          otPay,
          gross,
          otherDeductions: otherDeds,
          deductions: totalDeductions,
          net,
        });
      }

      setRows(out);
    } catch (error: unknown) {
      setErr(
        error instanceof Error
          ? error.message
          : "Failed to generate payroll preview.",
      );
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    let reg = 0,
      ot = 0,
      basic = 0,
      otp = 0,
      gross = 0,
      lateM = 0,
      lateV = 0,
      otherD = 0,
      ded = 0,
      net = 0;
    for (const r of rows) {
      reg += r.reg;
      ot += r.ot;
      basic += r.basicPay;
      otp += r.otPay;
      gross += r.gross;
      lateM += r.lateUTMins || 0;
      lateV += r.lateUTValue || 0;
      otherD += r.otherDeductions || 0;
      ded += r.deductions;
      net += r.net;
    }
    return { reg, ot, basic, otp, gross, lateM, lateV, otherD, ded, net };
  }, [rows]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Payroll Preview</h1>

      {err && (
        <div className="mb-3 text-sm text-red-600">{err}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <select
          className="border rounded px-3 py-2 md:col-span-2"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        >
          <option value="ALL">All employees</option>
          {emps.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name} ({e.code})
            </option>
          ))}
        </select>
        <input
          className="border rounded px-3 py-2"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <button
          className="bg-green-600 text-white rounded px-3 py-2"
          onClick={run}
          disabled={loading}
        >
          {loading ? "Running…" : "Run"}
        </button>
      </div>

      <div className="text-xs text-gray-600 mb-3">
        Fallback standard mins: {fallbackStd} • OT multiplier:{" "}
        {otMultiplier.toFixed(2)}× • Attendance mode: {attMode}
      </div>

      <div className="border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Employee</th>
              <th className="p-2 text-right">Regular mins</th>
              <th className="p-2 text-right">OT mins</th>
              <th className="p-2 text-right">Late/UT mins</th>
              <th className="p-2 text-right">Late/UT value</th>
              <th className="p-2 text-right">Basic Pay</th>
              <th className="p-2 text-right">OT Pay</th>
              <th className="p-2 text-right">Gross</th>
              <th className="p-2 text-right">Other Deductions</th>
              <th className="p-2 text-right">Total Deductions</th>
              <th className="p-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.employee_id} className="border-t">
                <td className="p-2">{r.name}</td>
                <td className="p-2 text-right">{r.reg}</td>
                <td className="p-2 text-right">{r.ot}</td>
                <td className="p-2 text-right">{r.lateUTMins}</td>
                <td className="p-2 text-right">₱{r.lateUTValue.toFixed(2)}</td>
                <td className="p-2 text-right">₱{r.basicPay.toFixed(2)}</td>
                <td className="p-2 text-right">₱{r.otPay.toFixed(2)}</td>
                <td className="p-2 text-right">₱{r.gross.toFixed(2)}</td>
                <td className="p-2 text-right">
                  ₱{r.otherDeductions.toFixed(2)}
                </td>
                <td className="p-2 text-right">₱{r.deductions.toFixed(2)}</td>
                <td className="p-2 text-right font-semibold">
                  ₱{r.net.toFixed(2)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td className="p-2" colSpan={11}>
                  No data.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 border-t">
                <td className="p-2 font-medium">Totals</td>
                <td className="p-2 text-right font-medium">{totals.reg}</td>
                <td className="p-2 text-right font-medium">{totals.ot}</td>
                <td className="p-2 text-right font-medium">{totals.lateM}</td>
                <td className="p-2 text-right font-medium">
                  ₱{totals.lateV.toFixed(2)}
                </td>
                <td className="p-2 text-right font-medium">
                  ₱{totals.basic.toFixed(2)}
                </td>
                <td className="p-2 text-right font-medium">
                  ₱{totals.otp.toFixed(2)}
                </td>
                <td className="p-2 text-right font-medium">
                  ₱{totals.gross.toFixed(2)}
                </td>
                <td className="p-2 text-right font-medium">
                  ₱{totals.otherD.toFixed(2)}
                </td>
                <td className="p-2 text-right font-medium">
                  ₱{totals.ded.toFixed(2)}
                </td>
                <td className="p-2 text-right font-semibold">
                  ₱{totals.net.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
