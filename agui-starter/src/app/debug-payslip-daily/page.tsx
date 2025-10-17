"use client";
import React from "react";

type Row = {
  date: string;
  rate: number;
  isPresent: boolean;
  pay: number;
};
type ApiRes = {
  basis: "daily";
  daysPresent: number;
  gross: number;
  breakdown: Row[];
};

function isApiRes(value: unknown): value is ApiRes {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.basis === "daily" &&
    typeof record.daysPresent === "number" &&
    typeof record.gross === "number" &&
    Array.isArray(record.breakdown) &&
    record.breakdown.every((row) =>
      row &&
      typeof row === "object" &&
      typeof (row as Record<string, unknown>).date === "string" &&
      typeof (row as Record<string, unknown>).rate === "number" &&
      typeof (row as Record<string, unknown>).isPresent === "boolean" &&
      typeof (row as Record<string, unknown>).pay === "number",
    )
  );
}

export default function DebugPayslipDaily() {
  const [employeeId, setEmployeeId] = React.useState<string>("");
  const [from, setFrom] = React.useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [to, setTo] = React.useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [presentDays, setPresentDays] = React.useState<string>(""); // comma-separated YYYY-MM-DD
  const [loading, setLoading] = React.useState(false);
  const [res, setRes] = React.useState<ApiRes | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    setRes(null);
    try {
      const pd = presentDays
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const r = await fetch("/api/payslip/daily", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ employeeId, from, to, presentDays: pd }),
      });

      const json: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const message =
          typeof json === "object" && json && "error" in json
            ? String((json as Record<string, unknown>).error)
            : typeof json === "object" && json && "detail" in json
              ? String((json as Record<string, unknown>).detail)
              : `HTTP ${r.status}`;
        const msg = message || `HTTP ${r.status}`;
        throw new Error(msg);
      }
      if (isApiRes(json)) {
        setRes(json);
      } else {
        throw new Error("Invalid response payload");
      }
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">
        Debug: Daily Payslip (Mixed Rates)
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Employee ID</label>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="uuid or numeric id"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">From (YYYY-MM-DD)</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To (YYYY-MM-DD)</label>
          <input
            type="date"
            className="w-full border rounded px-3 py-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="text-xs text-muted-foreground">
            Present Days (comma-separated)
          </label>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="e.g. 2025-10-09, 2025-10-10"
            value={presentDays}
            onChange={(e) => setPresentDays(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            These are the days counted as present. The API pulls the as-of{" "}
            <b>daily_rate</b> per date from <code>dtr_with_rates</code>.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          className="px-4 py-2 rounded bg-black text-white"
          onClick={run}
          disabled={loading}
        >
          {loading ? "Computing…" : "Compute"}
        </button>
        {err && <div className="text-danger text-sm">{err}</div>}
      </div>

      {res && (
        <div className="space-y-3">
          <div className="text-sm">
            <div>
              <b>Basis:</b> {res.basis}
            </div>
            <div>
              <b>Days Present:</b> {res.daysPresent}
            </div>
            <div>
              <b>Gross:</b> ₱
              {res.gross.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>

          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-2">Date</th>
                  <th className="text-right p-2">As-of Rate</th>
                  <th className="text-center p-2">Present?</th>
                  <th className="text-right p-2">Pay</th>
                </tr>
              </thead>
              <tbody>
                {res.breakdown.map((r) => (
                  <tr key={r.date} className="border-t">
                    <td className="p-2">{r.date}</td>
                    <td className="p-2 text-right">
                      ₱
                      {r.rate.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-2 text-center">
                      {r.isPresent ? "✓" : "—"}
                    </td>
                    <td className="p-2 text-right">
                      ₱
                      {r.pay.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
                {res.breakdown.length === 0 && (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={4}>
                      No DTR rows in range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
