"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Emp = { id: string; full_name: string; code: string };
type Ded = {
  id: string;
  employee_id: string;
  effective_date: string; // ISO YYYY-MM-DD
  type: string;
  note: string | null;
  amount: number;
};

// helper: given 'YYYY-MM' (or 'YYYY-MM-??'), build [from, next) range
function monthRange(ym: string) {
  const [year, month] = ym.slice(0, 7).split("-").map(Number);
  const y = year;
  const m = month; // 1..12
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const to = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  return { from, to }; // use: gte(from) AND lt(to)
}

function peso(n: number) {
  return `₱${Number(n || 0).toFixed(2)}`;
}

export default function DeductionsPage() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [empId, setEmpId] = useState<string>("");
  const [monthISO, setMonthISO] = useState(() =>
    new Date().toISOString().slice(0, 7),
  ); // YYYY-MM
  const [rows, setRows] = useState<Ded[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form state
  const [dateIn, setDateIn] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [typeIn, setTypeIn] = useState("goods");
  const [amountIn, setAmountIn] = useState<string>("0");
  const [noteIn, setNoteIn] = useState("");

  const total = useMemo(
    () => rows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows],
  );

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

        const { data, error } = await sb
          .from("employees")
          .select("id, full_name, code")
          .neq("status", "archived")
          .order("full_name");

        if (cancelled) return;

        if (error) {
          setErr(error.message);
          setEmps([]);
        } else {
          setEmps((data || []) as Emp[]);
          if (data && data[0]) setEmpId(data[0].id);
        }
      } catch (error) {
        if (!cancelled)
          setErr(
            error instanceof Error
              ? error.message
              : "Failed to load employees.",
          );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function load() {
    if (!empId) return;
    setErr(null);
    setLoading(true);
    const { from, to } = monthRange(monthISO);

    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase is not configured. Check environment variables.");
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await sb
        .from("payroll_deductions")
        .select("id, employee_id, effective_date, type, note, amount")
        .eq("employee_id", empId)
        .gte("effective_date", from) // inclusive
        .lt("effective_date", to) // exclusive next-month start
        .order("effective_date", { ascending: true })
        .order("id", { ascending: true });

      if (error) throw error;
      setRows((data || []) as Ded[]);
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : "Failed to load deductions.",
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [empId, monthISO]);

  async function addDed() {
    if (!empId) return;
    const amt = Number(amountIn || 0);
    if (Number.isNaN(amt) || amt <= 0) return;
    setErr(null);

    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase is not configured. Check environment variables.");
      return;
    }

    try {
      const { error } = await sb.from("payroll_deductions").insert([
        {
          employee_id: empId,
          effective_date: dateIn, // YYYY-MM-DD
          type: typeIn || "other",
          amount: amt,
          note: noteIn || null,
        },
      ]);
      if (error) throw error;
      setAmountIn("0");
      setNoteIn("");
      await load();
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : "Failed to add deduction.",
      );
    }
  }

  async function editDed(id: string, patch: Partial<Ded>) {
    setErr(null);
    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase is not configured. Check environment variables.");
      return;
    }

    try {
      const { error } = await sb
        .from("payroll_deductions")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      await load();
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : "Failed to update deduction.",
      );
    }
  }

  async function deleteDed(id: string) {
    setErr(null);
    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase is not configured. Check environment variables.");
      return;
    }

    try {
      const { error } = await sb
        .from("payroll_deductions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await load();
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : "Failed to delete deduction.",
      );
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Deductions</h1>

      {err && <div className="mb-3 text-sm text-red-600">{err}</div>}

      <div className="flex gap-3 items-center mb-3">
        <select
          className="border rounded px-3 py-2"
          value={empId}
          onChange={(e) => setEmpId(e.target.value)}
        >
          {emps.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name} ({e.code})
            </option>
          ))}
        </select>

        <input
          className="border rounded px-3 py-2"
          type="month"
          value={monthISO}
          onChange={(e) => setMonthISO(e.target.value)}
        />
        <div className="text-sm text-gray-600">Filter by employee & month</div>
      </div>

      <div className="border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Amount</th>
              <th className="p-2 text-left">Note</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">
                  <input
                    type="date"
                    className="border rounded px-2 py-1"
                    value={r.effective_date}
                    onChange={(e) =>
                      void editDed(r.id, { effective_date: e.target.value })
                    }
                  />
                </td>
                <td className="p-2">
                  <select
                    className="border rounded px-2 py-1"
                    value={r.type || "other"}
                    onChange={(e) =>
                      void editDed(r.id, { type: e.target.value })
                    }
                  >
                    <option value="goods">goods</option>
                    <option value="loan">loan</option>
                    <option value="penalty">penalty</option>
                    <option value="shortage">shortage</option>
                    <option value="other">other</option>
                  </select>
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="border rounded px-2 py-1 w-32"
                    value={String(r.amount ?? 0)}
                    onChange={(e) =>
                      void editDed(r.id, {
                        amount: Number(e.target.value || 0),
                      })
                    }
                  />
                </td>
                <td className="p-2">
                  <input
                    type="text"
                    className="border rounded px-2 py-1 w-64"
                    value={r.note || ""}
                    onChange={(e) =>
                      void editDed(r.id, { note: e.target.value })
                    }
                  />
                </td>
                <td className="p-2">
                  <button
                    className="text-red-600 hover:underline"
                    onClick={() => void deleteDed(r.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td className="p-2" colSpan={5}>
                  No deductions in this month.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t">
              <td className="p-2 font-medium" colSpan={2}>
                Total
              </td>
              <td className="p-2 font-medium">{peso(total)}</td>
              <td className="p-2" colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add form */}
      <div className="mt-6 border rounded p-4">
        <div className="font-medium mb-3">Add Deduction</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={dateIn}
            onChange={(e) => setDateIn(e.target.value)}
          />
          <select
            className="border rounded px-3 py-2"
            value={typeIn}
            onChange={(e) => setTypeIn(e.target.value)}
          >
            <option value="goods">goods</option>
            <option value="loan">loan</option>
            <option value="penalty">penalty</option>
            <option value="shortage">shortage</option>
            <option value="other">other</option>
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            className="border rounded px-3 py-2"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
          />
          <input
            type="text"
            placeholder="Note"
            className="border rounded px-3 py-2"
            value={noteIn}
            onChange={(e) => setNoteIn(e.target.value)}
          />
        </div>
        <button
          className="mt-4 bg-green-600 text-white rounded px-4 py-2"
          onClick={() => void addDed()}
        >
          Add
        </button>
      </div>
    </div>
  );
}
