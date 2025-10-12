// agui-starter/src/app/payroll/payslip/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { resolveEffectiveShift } from "@/lib/shifts";
import { isPresent } from "@/lib/dtr";

/* ========= CONFIG ========= */
const COMPANY_NAME = "Vangie Store";
type AttMode = "PRORATE" | "DEDUCTION";

/* ========= TYPES ========= */
type Emp = {
  id: string;
  code: string;
  full_name: string;
  rate_per_day: number;
};

type Dtr = {
  employee_id: string;
  work_date: string; // YYYY-MM-DD
  time_in: string | null;
  time_out: string | null;
  minutes_regular: number | null;
  minutes_ot: number | null;
};

type Seg = {
  employee_id?: string;
  work_date: string;
  start_at: string | null;
  end_at: string | null;
};

type Ded = {
  employee_id: string;
  effective_date: string;
  type: string | null;
  amount: number | null;
};

type DedGroup = { label: string; total: number; count: number };

type Summary = {
  basic: number;
  otPay: number;
  gross: number;
  shortMins: number;
  shortVal: number;
  otherDeds: number;
  totalDeductions: number;
  net: number;
  presentDays: number;
  totalOT: number;
};

type RateBucket = {
  rate: number;
  days: number;
  total: number;
  from?: string | null; // inclusive YYYY-MM-DD
  to?: string | null; // inclusive YYYY-MM-DD
};

type PayslipBundle = {
  emp: Emp;
  month: string;
  dtrs: Dtr[];
  segs: Seg[];
  dedGroups: DedGroup[];
  rateBreakdown: RateBucket[];
  summary: Summary;
};

/* ========= HELPERS ========= */
function peso(n: number) {
  return `₱${(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
function fmtHM(ts: string | null) {
  if (!ts) return "--";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}
function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const to = `${nextY}-${String(nextM).padStart(2, "0")}-01`; // exclusive
  return { from, to };
}
function monthEnd(ym: string) {
  const { to } = monthRange(ym); // exclusive next-month day 1
  const d = new Date(to);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10); // inclusive last day
}
const pad2 = (n: number) => String(n).padStart(2, "0");
const wkdShort = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
const fmtLong = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

/* ========= THEME ========= */
const C = {
  brand: "#1B7F5C",
  brandDark: "#126048",
  mintBg: "#EAF7F1",
  mintSoft: "#F6FBF8",
  surface: "#FFFFFF",
  line: "#D7E9DF",
  text: "#0F172A",
  mute: "#546170",
  sunday: "#F1FBF6",
  grossRow: "#F2FBF6",
  netRow: "#E7F7EF",
};

/* ========= DTR SPLIT ========= */
function DTRSplit({
  month,
  dtrs,
  segs,
}: {
  month: string;
  dtrs: Dtr[];
  segs: Seg[];
}) {
  const segByDate = useMemo(() => {
    const m = new Map<string, Seg[]>();
    for (const s of segs) {
      const arr = m.get(s.work_date) || [];
      arr.push(s);
      m.set(s.work_date, arr);
    }
    return m;
  }, [segs]);

  const dtrMap = useMemo(() => {
    const m = new Map<
      string,
      { in1: string; out1: string; in2: string; out2: string }
    >();
    for (const r of dtrs) {
      const list = (segByDate.get(r.work_date) || []).slice(0, 2);
      const s1 = list[0];
      const s2 = list[1];
      m.set(r.work_date, {
        in1: s1 ? fmtHM(s1.start_at) : fmtHM(r.time_in),
        out1: s1 ? fmtHM(s1.end_at) : fmtHM(r.time_out),
        in2: s2 ? fmtHM(s2.start_at) : "--",
        out2: s2 ? fmtHM(s2.end_at) : "--",
      });
    }
    return m;
  }, [dtrs, segByDate]);

  const total = daysInMonth(month);
  const [y, m] = month.split("-").map(Number);

  const buildRows = (start: number, endIncl: number) => {
    const rows: JSX.Element[] = [];
    for (let day = start; day <= endIncl; day++) {
      const iso = `${y}-${pad2(m)}-${pad2(day)}`;
      const t = dtrMap.get(iso);
      const isSun = new Date(iso).getDay() === 0;
      rows.push(
        <tr key={day} style={{ background: isSun ? C.sunday : C.surface }}>
          <td className="td num">{pad2(day)}</td>
          <td className="td wk">{wkdShort(iso)}</td>
          <td className="td">{t?.in1 || "--"}</td>
          <td className="td">{t?.out1 || "--"}</td>
          <td className="td">{t?.in2 || "--"}</td>
          <td className="td">{t?.out2 || "--"}</td>
        </tr>,
      );
    }
    return rows;
  };

  return (
    <>
      <div className="dtr-split">
        <table className="dtr">
          <thead>
            <tr>
              <th className="th num">Day</th>
              <th className="th">WK</th>
              <th className="th">IN 1</th>
              <th className="th">OUT 1</th>
              <th className="th">IN 2</th>
              <th className="th">OUT 2</th>
            </tr>
          </thead>
          <tbody>{buildRows(1, Math.min(15, total))}</tbody>
        </table>
        <table className="dtr">
          <thead>
            <tr>
              <th className="th num">Day</th>
              <th className="th">WK</th>
              <th className="th">IN 1</th>
              <th className="th">OUT 1</th>
              <th className="th">IN 2</th>
              <th className="th">OUT 2</th>
            </tr>
          </thead>
          <tbody>{total > 15 ? buildRows(16, total) : null}</tbody>
        </table>
      </div>

      <style jsx>{`
        .dtr-split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          width: 100%;
        }
        .dtr {
          width: 100%;
          border-collapse: collapse;
          background: ${C.surface};
        }
        .th,
        .td {
          border: 1px solid ${C.line};
          padding: 4px 6px;
          font-size: 10px;
        }
        .num {
          text-align: center;
          width: 34px;
        }
        .wk {
          width: 48px;
        }
      `}</style>
    </>
  );
}

/* ========= PAYSLIP CARD ========= */
function PayslipCard({
  bundle,
  attMode,
}: {
  bundle: PayslipBundle;
  attMode: AttMode;
}) {
  const { emp, month, dedGroups, summary, dtrs, segs, rateBreakdown } = bundle;

  const rbSorted = [...rateBreakdown]
    .filter((b) => b.days > 0)
    .sort((a, b) => {
      const af = a.from || "";
      const bf = b.from || "";
      if (af && bf && af !== bf) return af < bf ? -1 : 1;
      if (a.rate !== b.rate) return a.rate - b.rate;
      return 0;
    });

  return (
    <section className="sheet">
      <header className="head">
        <div className="h-left">Payslip</div>
        <div className="h-right">
          <div className="company">{COMPANY_NAME}</div>
          <div className="period">
            {new Date(month + "-01").toLocaleString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
      </header>

      <section className="info">
        <div className="info-grid">
          <div className="pair">
            <div className="k">Employee</div>
            <div className="v">{emp.full_name}</div>
          </div>
          <div className="pair">
            <div className="k">Code</div>
            <div className="v">{emp.code}</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-h centered">Payroll Computation</div>

        <div className="comp-grid">
          <table className="tbl">
            <thead>
              <tr>
                <th className="th-sec">Earnings</th>
                <th className="th-sec"></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="td">Days Present</td>
                <td className="td right">{summary.presentDays}</td>
              </tr>

              {rbSorted.map((b, i) => (
                <tr key={`rb-${i}`}>
                  <td className="td">
                    <div>
                      ₱{b.rate.toLocaleString()} × {b.days}{" "}
                      {b.days === 1 ? "day" : "days"}
                    </div>
                    {(b.from || b.to) && (
                      <div className="rate-desc">
                        {b.from ? fmtLong(b.from) : "—"} to{" "}
                        {b.to ? fmtLong(b.to) : "—"}
                      </div>
                    )}
                  </td>
                  <td className="td right">{peso(b.total)}</td>
                </tr>
              ))}

              {summary.totalOT > 0 && summary.otPay > 0 && (
                <tr>
                  <td className="td">OT — {summary.totalOT} mins</td>
                  <td className="td right">{peso(summary.otPay)}</td>
                </tr>
              )}

              <tr className="gross">
                <td className="td strong">Gross</td>
                <td className="td right strong">{peso(summary.gross)}</td>
              </tr>
            </tbody>
          </table>

          <table className="tbl">
            <thead>
              <tr>
                <th className="th-sec">Deductions</th>
                <th className="th-sec"></th>
              </tr>
            </thead>
            <tbody>
              {attMode === "DEDUCTION" && summary.shortVal > 0 && (
                <tr>
                  <td className="td">
                    Late/UT — {summary.shortMins.toLocaleString()} mins
                  </td>
                  <td className="td right">{peso(summary.shortVal)}</td>
                </tr>
              )}
              {dedGroups.map((g) => (
                <tr key={g.label}>
                  <td className="td">
                    {g.label}
                    {g.count > 1 ? ` (×${g.count})` : ""}
                  </td>
                  <td className="td right">{peso(g.total)}</td>
                </tr>
              ))}
              <tr className="gross">
                <td className="td strong">Total Deductions</td>
                <td className="td right strong">
                  {peso(summary.totalDeductions)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <table className="tbl net-only">
          <tbody>
            <tr className="net">
              <td className="td strong">Net Pay</td>
              <td className="td right strong">{peso(summary.net)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="panel-h">DTR</div>
        <div className="pad">
          <DTRSplit month={bundle.month} dtrs={dtrs} segs={segs} />
          <div className="legend">* Sundays are lightly highlighted.</div>
        </div>
      </section>

      <section className="ack">
        I acknowledge that the information stated in this payslip is true and
        correct, and I accept the computations of my compensation and deductions
        for the period indicated.
      </section>

      <section className="signs">
        <div className="sig">
          <div className="line" />
          Employee Signature / Date
        </div>
        <div className="sig right">
          <div className="line" />
          Manager / Owner
        </div>
      </section>

      <style jsx>{`
        .sheet {
          width: 210mm;
          min-height: 297mm;
          box-sizing: border-box;
          padding: 8mm 8mm 10mm;
          background: ${C.surface};
          color: ${C.text};
          border: 1px solid ${C.line};
          border-radius: 10px;
          margin: 0 auto;
        }
        .head {
          display: grid;
          grid-template-columns: 1fr 1fr;
          align-items: end;
          margin-bottom: 6px;
        }
        .h-left {
          font-weight: 800;
          color: ${C.brandDark};
          font-size: 16pt;
          line-height: 1.15;
        }
        .h-right {
          text-align: right;
        }
        .company {
          color: ${C.brandDark};
          font-weight: 700;
        }
        .period {
          color: ${C.mute};
          font-size: 10pt;
        }
        .info {
          border: 1px solid ${C.line};
          border-radius: 8px;
          background: ${C.mintSoft};
          padding: 8px;
          margin: 6px 0 8px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .k {
          font-size: 8.5pt;
          color: ${C.mute};
        }
        .v {
          font-size: 11pt;
          font-weight: 600;
        }
        .panel {
          border: 1px solid ${C.line};
          border-radius: 8px;
          background: ${C.mintSoft};
          margin-bottom: 8px;
          overflow: hidden;
        }
        .panel-h {
          padding: 6px 8px;
          border-bottom: 1px solid ${C.line};
          background: ${C.mintBg};
          font-weight: 600;
          color: ${C.brandDark};
        }
        .panel-h.centered {
          text-align: center;
        }
        .pad {
          padding: 8px;
        }
        .legend {
          font-size: 8.5pt;
          color: ${C.mute};
          margin-top: 4px;
        }
        .comp-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 8px;
        }
        .tbl {
          width: 100%;
          border-collapse: collapse;
          background: ${C.surface};
        }
        .net-only {
          width: calc(100% - 16px);
          margin: 0 8px 8px;
        }
        .th-sec {
          text-align: left;
          padding: 6px 8px;
          font-weight: 700;
          color: ${C.brandDark};
          background: ${C.mintSoft};
          border-bottom: 1px solid ${C.line};
        }
        .td {
          border: 1px solid ${C.line};
          padding: 6px 8px;
          font-size: 10.5pt;
        }
        .right {
          text-align: right;
        }
        .strong {
          font-weight: 700;
        }
        .gross {
          background: ${C.grossRow};
        }
        .net {
          background: ${C.netRow};
        }
        .rate-desc {
          margin-top: 2px;
          font-size: 9pt;
          color: ${C.mute};
          line-height: 1.2;
        }
        .ack {
          font-size: 9.5pt;
          color: ${C.mute};
          border: 1px solid ${C.line};
          border-radius: 8px;
          background: ${C.surface};
          padding: 8px;
          margin: 6px 0 8px;
        }
        .signs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          font-size: 9.5pt;
          align-items: end;
          min-height: 56px;
          padding-top: 2px;
        }
        .sig {
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .sig .line {
          margin: 10px 0 6px 0;
          height: 1px;
          background: ${C.text};
        }
        .sig.right {
          text-align: right;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          .h1 {
            display: none !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .sheet {
            margin: 0 auto !important;
          }
        }
      `}</style>
    </section>
  );
}

/* ========= COVER & SUMMARY (bulk only) ========= */
function CoverPage({ month }: { month: string }) {
  return (
    <section className="sheet cover">
      <div className="center">
        <div className="brand">{COMPANY_NAME}</div>
        <div className="subtitle">Monthly Payslips</div>
        <div className="sub">
          {new Date(month + "-01").toLocaleString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </div>
        <div className="tiny">Generated by Agui Payroll System</div>
      </div>

      <style jsx>{`
        .sheet {
          width: 210mm;
          min-height: 297mm;
          padding: 0;
          display: grid;
          place-items: center;
          border: 1px solid ${C.line};
          border-radius: 10px;
          background: ${C.surface};
          margin: 8px auto;
        }
        .center {
          text-align: center;
        }
        .brand {
          color: ${C.brandDark};
          font-weight: 800;
          font-size: 26pt;
          margin-bottom: 6pt;
        }
        .subtitle {
          color: ${C.text};
          font-size: 13pt;
          margin-bottom: 4pt;
        }
        .sub {
          color: ${C.mute};
          font-size: 10pt;
          margin-bottom: 14pt;
        }
        .tiny {
          color: ${C.mute};
          font-size: 9pt;
        }
        @media print {
          .sheet {
            margin: 0 auto !important;
          }
        }
      `}</style>
    </section>
  );
}

function SummaryPage({ bundles }: { bundles: PayslipBundle[] }) {
  const rows = bundles.map((b) => ({
    name: `${b.emp.full_name} (${b.emp.code})`,
    gross: b.summary.gross,
    ded: b.summary.totalDeductions,
    net: b.summary.net,
    days: b.summary.presentDays,
  }));
  const totals = rows.reduce(
    (a, r) => ({
      gross: a.gross + r.gross,
      ded: a.ded + r.ded,
      net: a.net + r.net,
      days: a.days + r.days,
    }),
    { gross: 0, ded: 0, net: 0, days: 0 },
  );

  return (
    <section className="sheet">
      <header className="head">
        <div className="h-left">Summary</div>
        <div className="h-right">
          <div className="company">{COMPANY_NAME}</div>
        </div>
      </header>

      <table className="sum">
        <thead>
          <tr>
            <th className="th left">Employee</th>
            <th className="th right">Days</th>
            <th className="th right">Gross</th>
            <th className="th right">Deductions</th>
            <th className="th right">Net</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="td left">{r.name}</td>
              <td className="td right">{r.days}</td>
              <td className="td right">{peso(r.gross)}</td>
              <td className="td right">{peso(r.ded)}</td>
              <td className="td right">{peso(r.net)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="gross">
            <td className="td left strong">Totals</td>
            <td className="td right strong">{totals.days}</td>
            <td className="td right strong">{peso(totals.gross)}</td>
            <td className="td right strong">{peso(totals.ded)}</td>
            <td className="td right strong">{peso(totals.net)}</td>
          </tr>
        </tfoot>
      </table>

      <style jsx>{`
        .sheet {
          width: 210mm;
          min-height: 297mm;
          box-sizing: border-box;
          padding: 12mm;
          background: ${C.surface};
          color: ${C.text};
          border: 1px solid ${C.line};
          border-radius: 10px;
          margin: 8px auto;
        }
        .head {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: end;
          margin-bottom: 8px;
        }
        .h-left {
          font-weight: 800;
          color: ${C.brandDark};
          font-size: 18pt;
        }
        .h-right {
          text-align: right;
        }
        .company {
          color: ${C.brandDark};
          font-weight: 700;
        }
        .sum {
          width: 100%;
          border-collapse: collapse;
          background: ${C.surface};
          margin-top: 8px;
        }
        .th,
        .td {
          border: 1px solid ${C.line};
          padding: 6px 8px;
          font-size: 10.5pt;
        }
        .left {
          text-align: left;
        }
        .right {
          text-align: right;
        }
        .strong {
          font-weight: 700;
        }
        .gross {
          background: ${C.grossRow};
        }
        @media print {
          .sheet {
            margin: 0 auto !important;
          }
        }
      `}</style>
    </section>
  );
}

/* ========= PAGE ========= */
export default function PayslipPage() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [employeeId, setEmployeeId] = useState<"ALL" | string>("ALL");
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [attMode, setAttMode] = useState<AttMode>("DEDUCTION");
  const [fallbackStd, setFallbackStd] = useState<number>(630);
  const [otMultiplier, setOtMultiplier] = useState<number>(1.0);

  const [bundles, setBundles] = useState<PayslipBundle[]>([]);
  const [loading, setLoading] = useState(false);
  const pdfRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      if (!sb) {
        console.error("Supabase not configured");
        setEmps([]);
        return;
      }

      const { data: empData } = await sb
        .from("employees")
        .select("id, code, full_name, rate_per_day")
        .neq("status", "archived")
        .order("full_name");
      setEmps(empData || []);

      const { data: setData } = await sb
        .from("settings_payroll")
        .select("standard_minutes_per_day, ot_multiplier, attendance_mode")
        .eq("id", 1)
        .maybeSingle();

      if (setData?.standard_minutes_per_day)
        setFallbackStd(setData.standard_minutes_per_day);
      if (setData?.ot_multiplier != null)
        setOtMultiplier(Number(setData.ot_multiplier));
      if (setData?.attendance_mode) {
        setAttMode(
          String(setData.attendance_mode).toUpperCase() === "PRORATE"
            ? "PRORATE"
            : "DEDUCTION",
        );
      }
    })();
  }, []);

  async function run() {
    setLoading(true);
    setBundles([]);

    const ids = employeeId === "ALL" ? emps.map((e) => e.id) : [employeeId];
    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    const { from } = monthRange(month);
    const end = monthEnd(month); // inclusive

    const sb = getSupabase();
    if (!sb) {
      console.error("Supabase not configured");
      setLoading(false);
      return;
    }

    const [{ data: dtrData }, { data: segData }, { data: dedData }] =
      await Promise.all([
        sb
          .from("dtr_entries")
          .select(
            "employee_id, work_date, time_in, time_out, minutes_regular, minutes_ot",
          )
          .in("employee_id", ids)
          .gte("work_date", from)
          .lte("work_date", end)
          .order("work_date", { ascending: true }),
        sb
          .from("dtr_segments")
          .select("employee_id, work_date, start_at, end_at")
          .in("employee_id", ids)
          .gte("work_date", from)
          .lte("work_date", end)
          .order("work_date", { ascending: true })
          .order("start_at", { ascending: true }),
        sb
          .from("payroll_deductions")
          .select("employee_id, effective_date, amount, type")
          .in("employee_id", ids)
          .gte("effective_date", from)
          .lte("effective_date", end),
      ]);

    const allDTR = (dtrData || []) as Dtr[];
    const allSeg = (segData || []) as Seg[];
    const allDed = (dedData || []) as Ded[];

    const dtrByEmp = new Map<string, Dtr[]>(),
      segByEmp = new Map<string, Seg[]>(),
      dedByEmp = new Map<string, Ded[]>();

    for (const id of ids) {
      dtrByEmp.set(id, []);
      segByEmp.set(id, []);
      dedByEmp.set(id, []);
    }
    for (const r of allDTR) dtrByEmp.get(r.employee_id)!.push(r);
    for (const s of allSeg) segByEmp.get(String(s.employee_id))!.push(s);
    for (const d of allDed) dedByEmp.get(d.employee_id)!.push(d);

    const out: PayslipBundle[] = [];

    for (const id of ids) {
      const emp = emps.find((e) => e.id === id);
      if (!emp) continue;

      const dtrs = (dtrByEmp.get(id) || []).sort((a, b) =>
        a.work_date.localeCompare(b.work_date),
      );
      const segs = segByEmp.get(id) || [];
      const deds = dedByEmp.get(id) || [];

      // maps
      const segsByDate = new Map<string, Seg[]>();
      for (const s of segs) {
        if (!s.work_date) continue;
        const arr = segsByDate.get(s.work_date) || [];
        arr.push(s);
        segsByDate.set(s.work_date, arr);
      }
      const dtrByDate = new Map<string, Dtr>();
      for (const r of dtrs) dtrByDate.set(r.work_date, r);

      // utils to compute minutes worked per day
      function diffMinutes(aIso: string, bIso: string) {
        const a = new Date(aIso).getTime();
        const b = new Date(bIso).getTime();
        if (!isFinite(a) || !isFinite(b)) return 0;
        return Math.max(0, Math.round((b - a) / 60000));
      }
      function workedMinutesFor(date: string): number {
        const segs = segsByDate.get(date) || [];
        let mins = 0;
        for (const s of segs) {
          if (s.start_at && s.end_at) mins += diffMinutes(s.start_at, s.end_at);
        }
        if (mins > 0) return mins;
        const r = dtrByDate.get(date);
        if (r?.time_in && r?.time_out)
          return diffMinutes(r.time_in, r.time_out);
        return 0;
      }

      // All relevant dates = union of dtr rows + segments
      const allDatesSet = new Set<string>();
      for (const r of dtrs) allDatesSet.add(r.work_date);
      for (const s of segs) allDatesSet.add(s.work_date);
      const presentDates = Array.from(allDatesSet)
        .filter((d) => {
          const r = dtrByDate.get(d);
          return (
            workedMinutesFor(d) > 0 ||
            (r
              ? isPresent({ time_in: r.time_in, time_out: r.time_out })
              : false)
          );
        })
        .sort();

      // group deductions
      const m = new Map<string, { total: number; count: number }>();
      for (const d of deds) {
        const key = (d.type || "other").toLowerCase();
        const cur = m.get(key) || { total: 0, count: 0 };
        cur.total += Number(d.amount || 0);
        cur.count += 1;
        m.set(key, cur);
      }
      const labelFor = (k: string) =>
        k === "loan" ? "Loan" : k === "goods" ? "Goods" : "Other";
      const dedGroups: DedGroup[] = Array.from(m.entries())
        .map(([k, v]) => ({
          label: labelFor(k),
          total: v.total,
          count: v.count,
        }))
        .filter((g) => g.total > 0);

      // mixed-rate breakdown (client fallback) + date->rate map
      let rateBreakdown: RateBucket[] = [];
      const dateRate = new Map<string, number>();
      if (presentDates.length > 0) {
        try {
          const { data: rateRows } = await sb
            .from("dtr_with_rates")
            .select("work_date,daily_rate")
            .eq("employee_id", id)
            .in("work_date", presentDates)
            .order("work_date", { ascending: true });

          const map = new Map<number, string[]>();
          (rateRows || []).forEach((row: any) => {
            const rate = Number(row?.daily_rate ?? emp.rate_per_day ?? 0);
            dateRate.set(row.work_date, rate);
            if (!map.has(rate)) map.set(rate, []);
            map.get(rate)!.push(row.work_date);
          });

          rateBreakdown = Array.from(map.entries()).map(([rate, dates]) => {
            const sorted = dates.sort((a, b) => (a < b ? -1 : 1));
            const days = sorted.length;
            const total = rate * days;
            return {
              rate,
              days,
              total,
              from: sorted[0],
              to: sorted[sorted.length - 1],
            };
          });
        } catch {
          // ignore; we'll fallback to single rate if needed
        }
      }

      // Try API, but parse defensively and allow fallback
      let basic = 0;
      let apiUsed = false;
      try {
        const resp = await fetch("/api/payslip/daily", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            employeeId: id,
            from: month + "-01",
            to: end,
            presentDays: presentDates,
          }),
        });

        let json: any = {};
        const raw = await resp.text();
        try {
          json = raw ? JSON.parse(raw) : {};
        } catch {
          // non-JSON -> fallback
        }

        if (resp.ok && json && json.gross != null) {
          apiUsed = true;
          basic = Number(json.gross || 0);
          if (Array.isArray(json.spans)) {
            rateBreakdown = json.spans.map((s: any) => ({
              rate: Number(s.rate || 0),
              days: Number(s.days || s.count || 0),
              total: Number(
                s.total || Number(s.rate || 0) * Number(s.days || s.count || 0),
              ),
              from: s.from || null,
              to: s.to || null,
            }));
          } else if (Array.isArray(json.byRate)) {
            rateBreakdown = json.byRate.map((b: any) => ({
              rate: Number(b.rate || 0),
              days: Number(b.days || 0),
              total: Number(
                b.total || Number(b.rate || 0) * Number(b.days || 0),
              ),
            }));
          }
        }
      } catch {
        // swallow; fallback below
      }

      // ✅ Canonicalize basic: if breakdown totals > 0, prefer the sum (fixes "gross=0" API bug)
      const basicFromBreakdown = rateBreakdown.reduce(
        (s, b) =>
          s + (Number(b.total) || Number(b.rate || 0) * Number(b.days || 0)),
        0,
      );
      if (!apiUsed || basicFromBreakdown > 0) {
        basic =
          basicFromBreakdown ||
          presentDates.length * Number(emp.rate_per_day || 0);
        if (rateBreakdown.length === 0) {
          rateBreakdown = [
            {
              rate: Number(emp.rate_per_day || 0),
              days: presentDates.length,
              total: basic,
            },
          ];
        }
      }

      // OT & Late/UT
      let totalOT = 0,
        otPay = 0,
        shortMins = 0,
        shortVal = 0;

      for (const d of presentDates) {
        const eff = await resolveEffectiveShift(id, d);
        const perDayStd = eff?.standard_minutes ?? fallbackStd;

        const dayRate = dateRate.get(d) ?? emp.rate_per_day;
        const perMinute = perDayStd > 0 ? dayRate / perDayStd : 0;

        const worked = workedMinutesFor(d);
        const regCapped = Math.min(worked, perDayStd);
        const shortfall = Math.max(0, perDayStd - regCapped);
        const otMins = Math.max(0, worked - perDayStd);

        shortMins += shortfall;
        shortVal += perMinute * shortfall;

        totalOT += otMins;
        otPay += perMinute * otMins * otMultiplier;
      }

      const otherDeds = dedGroups.reduce((s, g) => s + g.total, 0);
      const gross = basic + otPay;
      const totalDeductions =
        (attMode === "DEDUCTION" ? shortVal : 0) + otherDeds;
      const net = Math.max(0, gross - totalDeductions);

      const presentDays = presentDates.length;
      const hasDTR = presentDays > 0;
      const hasDed = otherDeds > 0;
      if (employeeId === "ALL" && !hasDTR && !hasDed) continue;

      out.push({
        emp,
        month,
        dtrs,
        segs,
        dedGroups,
        rateBreakdown,
        summary: {
          basic,
          otPay,
          gross,
          shortMins,
          shortVal,
          otherDeds,
          totalDeductions,
          net,
          presentDays,
          totalOT,
        },
      });
    }

    setBundles(out);
    setLoading(false);
  }

  function downloadPDF() {
    window.print();
  }

  const bulkMode = employeeId === "ALL";
  const canDownload = bulkMode ? bundles.length > 0 : bundles.length === 1;

  return (
    <div className="wrap">
      <h1 className="h1">Payslip</h1>

      <div className="controls no-print">
        <select
          className="inp"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value as any)}
        >
          <option value="ALL">All employees</option>
          {emps.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name} ({e.code})
            </option>
          ))}
        </select>

        <input
          className="inp"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />

        <button className="btn" onClick={run} disabled={loading}>
          {loading ? "Running…" : "Run"}
        </button>
        <button
          className="btn outline"
          onClick={downloadPDF}
          disabled={!canDownload}
        >
          Download PDF
        </button>

        <div className="note">
          Mode: <b>{attMode}</b> • Std mins: {fallbackStd} • OT×{" "}
          {otMultiplier.toFixed(2)}
        </div>
      </div>

      <div ref={pdfRootRef}>
        {bundles.length === 0 ? (
          <div className="placeholder">
            No payslips. Select employee/month then Run.
          </div>
        ) : (
          <>
            {bulkMode && <CoverPage month={month} />}
            {bulkMode && <SummaryPage bundles={bundles} />}
            {bundles.map((b) => (
              <PayslipCard key={b.emp.id} bundle={b} attMode={attMode} />
            ))}
          </>
        )}
      </div>

      <style jsx>{`
        .wrap {
          max-width: 940px;
          margin: 0 auto;
          padding: 12px;
        }
        .h1 {
          font-size: 22px;
          font-weight: 800;
          color: ${C.brandDark};
          margin-bottom: 8px;
        }
        .controls {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          margin-bottom: 10px;
        }
        .inp {
          border: 1px solid ${C.line};
          border-radius: 8px;
          padding: 8px 10px;
          min-width: 220px;
          background: ${C.surface};
        }
        .btn {
          background: ${C.brand};
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 8px 14px;
          cursor: pointer;
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn.outline {
          background: ${C.surface};
          color: ${C.brandDark};
          border: 1px solid ${C.brand};
        }
        .note {
          margin-left: auto;
          color: ${C.mute};
          font-size: 12px;
        }
        .placeholder {
          border: 1px dashed ${C.line};
          color: ${C.mute};
          padding: 20px;
          border-radius: 10px;
          background: ${C.mintSoft};
        }

        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          .no-print {
            display: none !important;
          }
          .h1 {
            display: none !important;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .wrap {
            padding: 0 !important;
          }
          .sheet {
            box-shadow: none !important;
            break-inside: avoid;
          }
          .sheet:not(:last-child) {
            break-after: page;
          }
        }
      `}</style>
    </div>
  );
}
