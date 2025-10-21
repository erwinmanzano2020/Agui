"use client";

import React from "react";

import EmptyState from "@/components/ui/empty-state";

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

function isRow(value: unknown): value is Row {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    (typeof record.dtr_id === "string" || typeof record.dtr_id === "number") &&
    (typeof record.employee_id === "string" ||
      typeof record.employee_id === "number") &&
    typeof record.work_date === "string" &&
    (record.basis === "hourly" ||
      record.basis === "daily" ||
      record.basis === "semi_monthly" ||
      record.basis === "monthly") &&
    typeof record.pay === "number"
  );
}

function isSummary(value: unknown): value is Summary {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const totals = record.totals as Record<string, unknown> | undefined;
  return (
    Array.isArray(record.rows) &&
    record.rows.every(isRow) &&
    totals != null &&
    typeof totals.gross === "number" &&
    typeof totals.count === "number"
  );
}

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

  const run = React.useCallback(async () => {
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
      const json: unknown = await res.json();
      if (!res.ok) {
        const message =
          typeof json === "object" && json && "error" in json
            ? String((json as Record<string, unknown>).error)
            : "Failed to fetch summary";
        throw new Error(message);
      }
      if (!isSummary(json)) {
        throw new Error("Invalid summary payload");
      }
      setData(json);
    } catch (error: unknown) {
      setErr(
        error instanceof Error ? error.message : "Failed to fetch summary",
      );
    } finally {
      setLoading(false);
    }
  }, [employeeId, from, hoursPerDay, preferBasis, to]);

  React.useEffect(() => {
    void run();
  }, [run]);

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
              className="border border-border rounded px-2 py-1 w-full bg-background text-foreground"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">To</label>
            <input
              type="date"
              className="border border-border rounded px-2 py-1 w-full bg-background text-foreground"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Employee ID (optional)</label>
            <input
              className="border border-border rounded px-2 py-1 w-full bg-background text-foreground"
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
              className="border border-border rounded px-2 py-1 w-full bg-background text-foreground"
              value={preferBasis}
              onChange={(e) =>
                setPreferBasis(e.target.value as PrimaryBasis | "")
              }
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
              className="border border-border rounded px-2 py-1 w-full bg-background text-foreground"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="pt-3">
          <button
            className="bg-success text-success-foreground rounded px-3 py-1 disabled:opacity-60"
            onClick={run}
            disabled={loading}
          >
            {loading ? "Loading…" : "Run"}
          </button>
        </div>
      </div>

      {/* Error */}
      {err && <div className="text-sm text-danger">Error: {err}</div>}

      {/* Totals */}
      {data && (
        <div className="border border-border rounded p-3">
          <h2 className="font-medium mb-2">Totals</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">Rows</div>
              <div className="font-medium">{data.totals.count}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Gross</div>
              <div className="font-medium">{fmt(data.totals.gross)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">By Basis</div>
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
                      {fmt(data.totals.by_basis?.[b] ?? 0)}
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
          <h2 className="font-medium">Rows</h2>
          {data.rows.length === 0 ? (
            <EmptyState
              className="mt-3 border-dashed border-border bg-card/60"
              icon="📋"
              title="No payroll rows"
              description="Run a summary to populate this table."
            />
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left">
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
