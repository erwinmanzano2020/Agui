"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { resolveEffectiveShift } from "@/lib/shifts";

/** ======= EDIT THIS TO CHANGE HEADER NAME ======= */
const COMPANY_NAME = "Vangie Store";
/** =============================================== */

type Emp = {
  id: string;
  code: string;
  full_name: string;
  rate_per_day: number;
};

type Dtr = {
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  minutes_regular: number | null;
  minutes_ot: number | null;
};

type Seg = {
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

type Slip = {
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
};

type AttMode = "PRORATE" | "DEDUCTION";

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const toNext = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  return { from, toNext };
}

function fmtHM(ts: string | null) {
  if (!ts) return "--";
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function peso(n: number) {
  return n.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  });
}

export default function PayslipPage() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [empId, setEmpId] = useState("");
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [loading, setLoading] = useState(false);

  const [standard, setStandard] = useState<number>(630);
  const [otMult, setOtMult] = useState<number>(1.0);
  const [attMode, setAttMode] = useState<AttMode>("DEDUCTION");

  const [dtrRows, setDtrRows] = useState<Dtr[]>([]);
  const [segments, setSegments] = useState<Seg[]>([]);
  const [deds, setDeds] = useState<Ded[]>([]);
  const [slip, setSlip] = useState<Slip | null>(null);

  const emp = useMemo(() => emps.find((e) => e.id === empId), [emps, empId]);

  const segMap = useMemo(() => {
    const m = new Map<string, Seg[]>();
    for (const s of segments) {
      if (!m.has(s.work_date)) m.set(s.work_date, []);
      m.get(s.work_date)!.push(s);
    }
    for (const [k, arr] of m) {
      arr.sort((a, b) => (a.start_at || "").localeCompare(b.start_at || ""));
      m.set(k, arr);
    }
    return m;
  }, [segments]);

  const dedGroups = useMemo(() => {
    type Group = { label: string; total: number; count: number };
    const map = new Map<string, Group>();

    for (const d of deds) {
      const raw = (d.type || "other").toString().trim().toLowerCase();
      const label =
        raw === "loan" ? "Loan" : raw === "goods" ? "Goods" : "Other";

      if (!map.has(label)) map.set(label, { label, total: 0, count: 0 });
      const g = map.get(label)!;
      g.total += Number(d.amount || 0);
      g.count += 1;
    }

    const order = ["Loan", "Goods", "Other"];
    return order
      .map((k) => map.get(k))
      .filter((g): g is Group => !!g && g.total > 0);
  }, [deds]);

  useEffect(() => {
    (async () => {
      const [{ data: empData }, { data: setData }] = await Promise.all([
        supabase
          .from("employees")
          .select("id, code, full_name, rate_per_day")
          .neq("status", "archived")
          .order("full_name"),
        supabase
          .from("settings_payroll")
          .select("standard_minutes_per_day, ot_multiplier, attendance_mode")
          .eq("id", 1)
          .maybeSingle(),
      ]);
      setEmps(empData || []);
      if (empData && empData[0]) setEmpId(empData[0].id);

      if (setData) {
        setStandard(Number(setData.standard_minutes_per_day ?? 630));
        setOtMult(Number(setData.ot_multiplier ?? 1.0));
        if (setData.attendance_mode) {
          setAttMode(
            String(setData.attendance_mode).toUpperCase() === "PRORATE"
              ? "PRORATE"
              : "DEDUCTION",
          );
        }
      }
    })();
  }, []);

  async function run() {
    if (!empId) return;
    setLoading(true);
    setSlip(null);

    const { from, toNext } = monthRange(month);

    const [{ data: dtr }, { data: segs }, { data: dedData }] =
      await Promise.all([
        supabase
          .from("dtr_entries")
          .select("work_date, time_in, time_out, minutes_regular, minutes_ot")
          .eq("employee_id", empId)
          .gte("work_date", from)
          .lt("work_date", toNext)
          .order("work_date"),
        supabase
          .from("dtr_segments")
          .select("work_date, start_at, end_at")
          .eq("employee_id", empId)
          .gte("work_date", from)
          .lt("work_date", toNext)
          .order("work_date")
          .order("start_at", { ascending: true }),
        supabase
          .from("payroll_deductions")
          .select("employee_id, effective_date, amount, note, type")
          .eq("employee_id", empId)
          .gte("effective_date", from)
          .lt("effective_date", toNext)
          .order("effective_date"),
      ]);

    const dtrRows_ = (dtr || []) as Dtr[];
    const segs_ = (segs || []) as Seg[];
    const deds_ = (dedData || []) as Ded[];

    setDtrRows(dtrRows_);
    setSegments(segs_);
    setDeds(deds_);

    let presentDays = 0,
      regSum = 0,
      otSum = 0,
      basicPay = 0,
      otPay = 0,
      shortMins = 0,
      shortVal = 0;

    for (const r of dtrRows_.filter(
      (r) => (r.minutes_regular || 0) > 0 || (r.minutes_ot || 0) > 0,
    )) {
      const reg = Math.max(0, Number(r.minutes_regular || 0));
      const ot = Math.max(0, Number(r.minutes_ot || 0));

      presentDays += 1;
      regSum += reg;
      otSum += ot;

      const eff = await resolveEffectiveShift(empId, r.work_date);
      const perDayStandard = eff?.standard_minutes ?? standard;
      const perMinute = (emp?.rate_per_day || 0) / perDayStandard;

      const capped = Math.min(reg, perDayStandard);
      const shortfall = Math.max(0, perDayStandard - capped);

      if (attMode === "PRORATE") {
        basicPay += perMinute * capped;
      } else {
        basicPay += emp?.rate_per_day || 0;
        shortMins += shortfall;
        shortVal += perMinute * shortfall;
      }

      otPay += perMinute * ot * otMult;
    }

    const otherDeds = deds_.reduce((s, d) => s + Number(d.amount || 0), 0);
    const gross = basicPay + otPay;
    const totalDeductions =
      (attMode === "DEDUCTION" ? shortVal : 0) + otherDeds;
    const net = Math.max(0, gross - totalDeductions);

    setSlip({
      presentDays,
      regSum,
      otSum,
      basicPay,
      otPay,
      shortMins,
      shortVal,
      otherDeds,
      gross,
      totalDeductions,
      net,
    });

    setLoading(false);
  }

  function dayLabel(dateISO: string) {
    const d = new Date(dateISO);
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }

  function rowSegments(dateISO: string, fallbackIn: string | null, fallbackOut: string | null) {
    const segs = segMap.get(dateISO) || [];
    const s1 = segs[0];
    const s2 = segs[1];
    return {
      in1: s1 ? fmtHM(s1.start_at) : fmtHM(fallbackIn),
      out1: s1 ? fmtHM(s1.end_at) : fmtHM(fallbackOut),
      in2: s2 ? fmtHM(s2.start_at) : "--",
      out2: s2 ? fmtHM(s2.end_at) : "--",
    };
  }

  return (
    <div className="max-w-5xl mx-auto p-6 print:p-0">
      <h1 className="text-2xl font-semibold mb-1">Payslip</h1>
      <div className="text-sm text-gray-700 mb-4">{COMPANY_NAME}</div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 mb-4 print:hidden">
        <select
          className="border rounded px-3 py-2"
          value={empId}
          onChange={(e) => setEmpId(e.target.value)}
        >
          <option value="">Select employee</option>
          {emps.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name} ({e.code})
            </option>
          ))}
        </select>

        <input
          type="month"
          className="border rounded px-3 py-2"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />

        <button
          className="bg-green-600 text-white rounded px-3 py-2"
          onClick={run}
          disabled={!empId || loading}
        >
          {loading ? "Loading…" : "Run"}
        </button>

        {slip && (
          <button
            className="bg-gray-700 text-white rounded px-3 py-2"
            onClick={() => window.print()}
          >
            Print
          </button>
        )}
      </div>

      {emp && slip && (
        <>
          {/* Header block */}
          <div className="mb-3 flex justify-between items-end">
            <div className="text-xs text-gray-600">
              Payslip for{" "}
              {new Date(`${month}-01`).toLocaleString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </div>
            <div className="text-right text-sm">
              <div>
                <span className="font-medium">Employee:</span> {emp.full_name}
              </div>
              <div>
                <span className="font-medium">Code:</span> {emp.code}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 border p-4 print:border-0">
            {/* DTR left */}
            <div>
              <h2 className="font-medium mb-2">DTR</h2>
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
                  {dtrRows.map((r) => {
                    const segs = rowSegments(r.work_date, r.time_in, r.time_out);
                    const isSun = new Date(r.work_date).getDay() === 0;
                    const trClass = isSun ? "bg-red-50 text-red-700" : "";
                    return (
                      <tr key={r.work_date} className={trClass}>
                        <td className="border p-1 text-center">{dayLabel(r.work_date)}</td>
                        <td className="border p-1 text-center">{segs.in1}</td>
                        <td className="border p-1 text-center">{segs.out1}</td>
                        <td className="border p-1 text-center">{segs.in2}</td>
                        <td className="border p-1 text-center">{segs.out2}</td>
                      </tr>
                    );
                  })}
                  {dtrRows.length === 0 && (
                    <tr>
                      <td className="border p-2 text-center" colSpan={5}>
                        No DTR entries in this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Computation right */}
            <div>
              <h2 className="font-medium mb-2">Payroll Computation</h2>
              <table className="w-full text-sm border">
                <tbody>
                  <tr><td className="border p-2">Days Present</td><td className="border p-2 text-right">{slip.presentDays}</td></tr>
                  <tr><td className="border p-2">Rate</td><td className="border p-2 text-right">Daily – {peso(emp.rate_per_day)}</td></tr>
                  <tr><td className="border p-2">Basic Pay</td><td className="border p-2 text-right">{peso(slip.basicPay)}</td></tr>
                  <tr><td className="border p-2">OT – <span className="text-gray-600">{slip.otSum} mins</span></td><td className="border p-2 text-right">{peso(slip.otPay)}</td></tr>
                  <tr className="font-semibold bg-yellow-50"><td className="border p-2">Gross</td><td className="border p-2 text-right">{peso(slip.gross)}</td></tr>
                  <tr><td className="border p-2 font-medium" colSpan={2}>Deductions</td></tr>
                  {attMode === "DEDUCTION" && slip.shortVal > 0 && (
                    <tr><td className="border p-2 pl-6">Late/UT – <span className="text-gray-600">{slip.shortMins} mins</span></td><td className="border p-2 text-right">{peso(slip.shortVal)}</td></tr>
                  )}
                  {dedGroups.map((g) => (
                    <tr key={g.label}><td className="border p-2 pl-6">{g.label}{g.count > 1 ? <span className="text-gray-500"> (×{g.count})</span> : null}</td><td className="border p-2 text-right">{peso(g.total)}</td></tr>
                  ))}
                  <tr className="font-semibold bg-yellow-50"><td className="border p-2">Total Deductions</td><td className="border p-2 text-right">{peso(slip.totalDeductions)}</td></tr>
                  <tr className="font-semibold bg-gray-100"><td className="border p-2">Net Pay</td><td className="border p-2 text-right">{peso(slip.net)}</td></tr>
                </tbody>
              </table>

              <div className="mt-6 text-xs text-gray-700 leading-relaxed">
                I acknowledge that the information stated in this payslip is true and correct, and I accept the computations of my compensation and deductions for the period indicated.
              </div>

              <div className="mt-8 grid grid-cols-2 gap-8 text-xs">
                <div>______________________________<div>Employee Signature / Date</div></div>
                <div className="text-right">______________________________<div>Manager / Owner</div></div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
