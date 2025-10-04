"use client";
import { useEffect, useState, FormEvent } from "react";
import { supabase } from "@/lib/supabase";

type Employee = {
  id: string;
  code: string;
  full_name: string;
  rate_per_day: number;
  status: string;
};

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [f, setF] = useState({ code: "", full_name: "", rate_per_day: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const q = supabase
      .from("employees")
      .select("*")
      .order("full_name", { ascending: true });
    const { data } = showArchived ? await q : await q.neq("status", "archived");
    setRows(data || []);
  };

  useEffect(() => {
    load();
  }, [showArchived]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(f.rate_per_day || "0");
    if (!f.code || !f.full_name) return;
    setSaving(true);
    const { error } = await supabase.from("employees").insert({
      code: f.code,
      full_name: f.full_name,
      rate_per_day: isNaN(rate) ? 0 : rate,
    });
    setSaving(false);
    if (!error) {
      setF({ code: "", full_name: "", rate_per_day: "" });
      load();
    }
  };

  const archive = async (id: string) => {
    await supabase
      .from("employees")
      .update({ status: "archived" })
      .eq("id", id);
    load();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Employees</h1>

      <form onSubmit={add} className="mb-6 grid grid-cols-4 gap-2">
        <input
          className="border rounded px-3 py-2"
          placeholder="Code"
          value={f.code}
          onChange={(e) => setF({ ...f, code: e.target.value })}
        />
        <input
          className="col-span-2 border rounded px-3 py-2"
          placeholder="Full name"
          value={f.full_name}
          onChange={(e) => setF({ ...f, full_name: e.target.value })}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="Rate/day"
          value={f.rate_per_day}
          onChange={(e) => setF({ ...f, rate_per_day: e.target.value })}
        />
        <button
          className="col-span-4 mt-2 bg-green-600 text-white rounded px-4 py-2 disabled:opacity-50"
          disabled={saving}
        >
          {saving ? "Saving…" : "Add"}
        </button>
      </form>

      <div className="flex items-center gap-2 mb-3">
        <input
          id="arch"
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        <label htmlFor="arch">Show archived</label>
      </div>

      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Code</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-right">Rate/Day</th>
              <th className="p-2">Status</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.code}</td>
                <td className="p-2">{r.full_name}</td>
                <td className="p-2 text-right">
                  ₱{Number(r.rate_per_day).toFixed(2)}
                </td>
                <td className="p-2">{r.status}</td>
                <a className="text-xs underline mr-2" href={`/employees/${r.id}`}>Schedule</a>
                {r.status !== 'archived' && (
                  <button onClick={()=>archive(r.id)} className="text-xs underline">Archive</button>
                )}

              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-2" colSpan={5}>
                  No employees yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
