"use client";

import React from "react";

type PrimaryBasis = "hourly" | "daily" | "semi_monthly" | "monthly";

type Row = {
  dtr_id: string | number;
  employee_id: string | number;
  work_date: string;
  hourly_rate: number | null;
  daily_rate: number | null;
  semi_monthly_rate: number | null;
  monthly_rate: number | null;
  basis: PrimaryBasis;
  pay: number;
};

type Summary = {
  rows: Row[];
  totals: {
    gross: number;
    by_basis: Partial<Record<PrimaryBasis, number>>;
    count: number;
  };
};

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `₱${Number(n).toFixed(2)}`;
}

export default function PayrollSummaryPageClient() {
  const today = React.useMemo(() => new Date(), []);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const defaultTo = iso(today);
  const defaultFrom = iso(new Date(today.getTime() - 14 * 24 * 3600 * 1000));

  const [from, setFrom] = React.useState(defaultFrom);
  const [to, setTo] = React.useState(defaultTo);
  const [employeeId, setEmployeeId] = React.useState("");
  const [preferBasis, setPreferBasis] = React.useState<"" | PrimaryBasis>("");
  const [hoursPerDay, setHoursPerDay] = React.useState<number>(8); // NEW

  const [data, setData] = React.useState<Summary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      const params = new URLSearchParams({
        from,
        to,
        hoursPerDay: String(hoursPerDay),
      });
      if (employeeId.trim()) params.set("employeeId", employeeId.trim());
      if (preferBasis) params.set("preferBasis", preferBasis);
      const res = await fetch(`/api/payroll/summary?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch summary");
      setData(json as Summary);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to fetch summary");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Payroll Summary (Demo)</h1>

      {/* Controls */}
      <div className="border rounded p-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-sm mb-1">From</label>
            <input
              type="date"
              className="border rounded px-2 py-1 w-full"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">To</label>
            <input
              type="date"
              className="border rounded px-2 py-1 w-full"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Employee ID (optional)</label>
            <input
              className="border rounded px-2 py-1 w-full"
              placeholder="uuid or numeric id"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">
              Prefer Basis (optional)
            </label>
            <select
              className="border rounded px-2 py-1 w-full"
              value={preferBasis}
              onChange={(e) => setPreferBasis(e.target.value as any)}
            >
              <option value="">auto (monthly → hourly)</option>
              <option value="daily">daily</option>
              <option value="hourly">hourly</option>
              <option value="semi_monthly">semi_monthly</option>
              <option value="monthly">monthly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Hours/day for hourly</label>
            <input
              type="number"
              min={0}
              step="0.25"
              className="border rounded px-2 py-1 w-full"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="pt-3">
          <button
            className="bg-green-600 text-white rounded px-3 py-1 disabled:opacity-60"
            onClick={run}
            disabled={loading}
          >
            {loading ? "Loading…" : "Run"}
          </button>
        </div>
      </div>

      {/* Error */}
      {err && <div className="text-sm text-red-600">Error: {err}</div>}

      {/* Totals */}
      {data && (
        <div className="border rounded p-3">
          <h2 className="font-medium mb-2">Totals</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-gray-600">Rows</div>
              <div className="font-medium">{data.totals.count}</div>
            </div>
            <div>
              <div className="text-gray-600">Gross</div>
              <div className="font-medium">{fmt(data.totals.gross)}</div>
            </div>
            <div>
              <div className="text-gray-600">By Basis</div>
              <div className="space-y-1">
                {(
                  [
                    "hourly",
                    "daily",
                    "semi_monthly",
                    "monthly",
                  ] as PrimaryBasis[]
                ).map((b) => (
                  <div key={b} className="flex justify-between">
                    <span className="capitalize">{b.replace("_", " ")}</span>
                    <span className="font-medium">
                      {fmt((data.totals.by_basis as any)?.[b] ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rows */}
      {data && (
        <div className="border rounded p-3">
          <h2 className="font-medium mb-2">Rows</h2>
          {data.rows.length === 0 ? (
            <div className="text-sm text-gray-600">No rows.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-2 font-medium">Date</th>
                    <th className="p-2 font-medium">Employee</th>
                    <th className="p-2 font-medium">Basis</th>
                    <th className="p-2 font-medium">Hourly</th>
                    <th className="p-2 font-medium">Daily</th>
                    <th className="p-2 font-medium">Semi-Monthly</th>
                    <th className="p-2 font-medium">Monthly</th>
                    <th className="p-2 font-medium">Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={`${r.dtr_id}`} className="border-t">
                      <td className="p-2">{r.work_date}</td>
                      <td className="p-2">
                        <span className="font-mono text-xs">
                          {String(r.employee_id)}
                        </span>
                      </td>
                      <td className="p-2 capitalize">
                        {r.basis.replace("_", " ")}
                      </td>
                      <td className="p-2">{r.hourly_rate ?? "—"}</td>
                      <td className="p-2">{r.daily_rate ?? "—"}</td>
                      <td className="p-2">{r.semi_monthly_rate ?? "—"}</td>
                      <td className="p-2">{r.monthly_rate ?? "—"}</td>
                      <td className="p-2 font-medium">{fmt(r.pay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
