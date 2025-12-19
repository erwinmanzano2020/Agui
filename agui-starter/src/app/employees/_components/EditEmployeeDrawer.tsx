"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type DrawerTab = "profile" | "compensation" | "audit";

type Props = {
  employeeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional: open the drawer on a specific tab */
  initialTab?: DrawerTab;
  /** Called after a successful save so parent can refresh */
  onDataChanged?: () => void;
};

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  status: "active" | "inactive";
  branch_id: string | null;
};

type RateRow = {
  id: string;
  basis: string | null;
  amount: number | null;
  effective_date: string; // YYYY-MM-DD
  note: string | null;
  created_at: string;
};

const BASIS_OPTIONS = [
  { label: "Daily", value: "daily" },
  { label: "Hourly", value: "hourly" },
  { label: "Monthly", value: "monthly" },
  { label: "Per Cutoff", value: "per_cutoff" },
];

export default function EditEmployeeDrawer({
  employeeId,
  open,
  onOpenChange,
  initialTab = "profile",
  onDataChanged,
}: Props) {
  const [tab, setTab] = useState<DrawerTab>(initialTab);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Profile state
  const [emp, setEmp] = useState<Employee | null>(null);

  // Compensation state
  const [rates, setRates] = useState<RateRow[]>([]);
  const [cBasis, setCBasis] = useState<string>("daily");
  const [cAmount, setCAmount] = useState<string>("");
  const [cDate, setCDate] = useState<string>(""); // YYYY-MM-DD
  const [cNote, setCNote] = useState<string>("");

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  // Load profile + rates when opened
  useEffect(() => {
    if (!open || !employeeId) return;

    const load = async () => {
      setErr(null);

      const sb = getSupabase();
      if (!sb) {
        setErr("Supabase not configured");
        return;
      }

      // Employee
      const empRes = await sb
        .from("employees")
        .select("id, first_name, last_name, display_name, status, branch_id")
        .eq("id", employeeId)
        .maybeSingle();

      if (empRes.error) setErr(empRes.error.message);
      setEmp(
        empRes.data
          ? {
              id: empRes.data.id,
              first_name: empRes.data.first_name,
              last_name: empRes.data.last_name,
              display_name:
                empRes.data.display_name ||
                `${empRes.data.first_name} ${empRes.data.last_name}`.trim(),
              status: empRes.data.status ?? "active",
              branch_id: empRes.data.branch_id ?? null,
            }
          : null,
      );

      // Rates
      const rateRes = await sb
        .from("employee_rate_history")
        .select("id, basis, amount, effective_date, note, created_at")
        .eq("employee_id", employeeId)
        .order("effective_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (rateRes.error)
        setErr((prev) => prev ?? rateRes.error?.message ?? null);
      setRates(rateRes.data ?? []);
    };

    load();
  }, [open, employeeId]);

  const close = () => {
    if (!busy) onOpenChange(false);
  };

  const saveProfile = async () => {
    if (!emp?.id) return;
    setBusy(true);
    setErr(null);

    const payload = {
      first_name: emp.first_name,
      last_name: emp.last_name,
      display_name: emp.display_name || `${emp.first_name} ${emp.last_name}`.trim(),
      status: emp.status,
      branch_id: emp.branch_id,
    };

    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase not configured");
      setBusy(false);
      return;
    }

    const { error } = await sb
      .from("employees")
      .update(payload)
      .eq("id", emp.id);
    if (error) setErr(error.message);

    setBusy(false);
    onDataChanged?.();
  };

  const reloadRates = async () => {
    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase not configured");
      return;
    }

    const rateRes = await sb
      .from("employee_rate_history")
      .select("id, basis, amount, effective_date, note, created_at")
      .eq("employee_id", employeeId)
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (rateRes.error) setErr((prev) => prev ?? rateRes.error?.message ?? null);
    setRates(rateRes.data ?? []);
  };

  const addRate = async () => {
    if (
      !employeeId ||
      !cDate ||
      cAmount === "" ||
      Number.isNaN(Number(cAmount))
    ) {
      setErr("Please provide Effective Date and a valid Amount.");
      return;
    }
    setBusy(true);
    setErr(null);

    const amountNum = Number(cAmount);

    // 1) Insert into rate history
    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase not configured");
      setBusy(false);
      return;
    }

    const { error } = await sb.from("employee_rate_history").insert({
      employee_id: employeeId,
      basis: cBasis || "daily",
      amount: amountNum,
      effective_date: cDate,
      note: cNote || null,
    });

    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    // 2) Reload rates in the drawer
    await reloadRates();

    // 3) Notify parent so it can refresh immediately
    onDataChanged?.();

    // 4) Clear form
    setCAmount("");
    setCDate("");
    setCNote("");

    setBusy(false);
  };

  const deleteRate = async (id: string) => {
    if (!confirm("Delete this rate entry? This cannot be undone.")) return;
    setBusy(true);
    setErr(null);

    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase not configured");
      setBusy(false);
      return;
    }

    const { error } = await sb
      .from("employee_rate_history")
      .delete()
      .eq("id", id);
    if (error) setErr(error.message);

    await reloadRates();
    onDataChanged?.();
    setBusy(false);
  };

  const currentRateHint = useMemo(() => {
    if (!rates.length) return "No compensation history yet.";
    const latest = rates[0];
    const amt =
      latest.amount != null ? `₱${Number(latest.amount).toFixed(2)}` : "—";
    const basis = latest.basis ?? "—";
    return `Latest: ${amt} (${basis}), effective ${latest.effective_date}`;
  }, [rates]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={close}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className="absolute right-0 top-0 h-full w-full max-w-xl bg-card text-card-foreground shadow-xl p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-employee-title"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 id="edit-employee-title" className="text-lg font-semibold">
            Employee Editor
          </h2>
          <button
            type="button"
            className="text-sm underline"
            onClick={close}
            disabled={busy}
          >
            Close
          </button>
        </div>

        {err && <div className="mb-3 text-sm text-danger">Error: {err}</div>}

        {/* Tabs */}
        <div className="border-b mb-4">
          <nav className="flex gap-4 text-sm">
            <button
              className={`pb-2 ${tab === "profile" ? "border-b-2 border-black font-medium" : "text-muted-foreground"}`}
              onClick={() => setTab("profile")}
            >
              Profile
            </button>
            <button
              className={`pb-2 ${tab === "compensation" ? "border-b-2 border-black font-medium" : "text-muted-foreground"}`}
              onClick={() => setTab("compensation")}
            >
              Compensation
            </button>
            <button
              className={`pb-2 ${tab === "audit" ? "border-b-2 border-black font-medium" : "text-muted-foreground"}`}
              onClick={() => setTab("audit")}
            >
              Audit
            </button>
          </nav>
        </div>

        {/* Tab contents */}
        {tab === "profile" && (
          <div className="space-y-3">
            {!emp ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <>
                <div>
                  <label className="block text-sm mb-1">First Name</label>
                  <input
                    className="border rounded px-2 py-1 w-full"
                    value={emp.first_name}
                    onChange={(e) =>
                      setEmp((p) =>
                        p ? { ...p, first_name: e.target.value } : p,
                      )
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1">Last Name</label>
                  <input
                    className="border rounded px-2 py-1 w-full"
                    value={emp.last_name}
                    onChange={(e) =>
                      setEmp((p) => (p ? { ...p, last_name: e.target.value } : p))
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1">Display Name</label>
                  <input
                    className="border rounded px-2 py-1 w-full"
                    value={emp.display_name}
                    onChange={(e) =>
                      setEmp((p) =>
                        p ? { ...p, display_name: e.target.value } : p,
                      )
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1">Status</label>
                  <select
                    className="border rounded px-2 py-1 w-full"
                    value={emp.status}
                    onChange={(e) =>
                      setEmp((p) =>
                        p ? { ...p, status: e.target.value as Employee["status"] } : p,
                      )
                    }
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>

                <div className="text-xs text-muted-foreground">{currentRateHint}</div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={busy}
                    className="bg-success text-success-foreground rounded px-3 py-1 disabled:opacity-60"
                  >
                    Save Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("compensation")}
                    className="border rounded px-3 py-1"
                  >
                    Go to Compensation →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "compensation" && (
          <div className="space-y-4">
            <div className="rounded border p-3">
              <h3 className="font-medium mb-3">Add Rate</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Basis</label>
                  <select
                    className="border rounded px-2 py-1 w-full"
                    value={cBasis}
                    onChange={(e) => setCBasis(e.target.value)}
                  >
                    {BASIS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    className="border rounded px-2 py-1 w-full"
                    value={cAmount}
                    onChange={(e) => setCAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Effective Date</label>
                  <input
                    type="date"
                    className="border rounded px-2 py-1 w-full"
                    value={cDate}
                    onChange={(e) => setCDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Note</label>
                  <input
                    className="border rounded px-2 py-1 w-full"
                    value={cNote}
                    onChange={(e) => setCNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={addRate}
                  disabled={busy}
                  className="bg-success text-success-foreground rounded px-3 py-1 disabled:opacity-60"
                >
                  Save Rate
                </button>
              </div>
            </div>

            <div className="rounded border p-3">
              <h3 className="font-medium mb-3">Rate History</h3>
              {rates.length === 0 ? (
                <div className="text-sm text-muted-foreground">No entries yet.</div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="p-2 font-medium">Effective</th>
                      <th className="p-2 font-medium">Basis</th>
                      <th className="p-2 font-medium">Amount</th>
                      <th className="p-2 font-medium">Note</th>
                      <th className="p-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-2">{r.effective_date}</td>
                        <td className="p-2">{r.basis ?? "—"}</td>
                        <td className="p-2">
                          {r.amount != null
                            ? `₱${Number(r.amount).toFixed(2)}`
                            : "—"}
                        </td>
                        <td className="p-2">{r.note ?? "—"}</td>
                        <td className="p-2">
                          <button
                            type="button"
                            className="text-xs underline"
                            onClick={() => deleteRate(r.id)}
                            disabled={busy}
                          >
                            delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              Payroll will later use the <b>as-of</b> rate based on the payout
              period.
            </div>
          </div>
        )}

        {tab === "audit" && (
          <div className="text-sm text-muted-foreground">
            Coming soon: change logs & approvals.
          </div>
        )}
      </div>
    </div>
  );
}
