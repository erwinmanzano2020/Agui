"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type EmployeeRow = {
  id: string;
  code: string;
  full_name: string;
  status: string | null;
  rate_per_day: number | null;
};

export default function EmployeesPage() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setErr(null);
    setLoading(true);
    const { data, error } = await supabase
      .from("employees")
      .select("id, code, full_name, status, rate_per_day")
      .order("full_name", { ascending: true });

    if (error) setErr(error.message);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const archive = async (id: string) => {
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from("employees")
      .update({ status: "archived" })
      .eq("id", id);

    if (error) setErr(error.message);
    await load();
    setBusy(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Employees</h1>

      {err && <div className="mb-3 text-sm text-red-600">Error: {err}</div>}

      <div className="border rounded p-3">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-600">No employees found.</div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left border-b">
                <th className="p-2 font-medium">Code</th>
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium">Rate/Day</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.code}</td>
                  <td className="p-2">
                    {/* Name is now a link to the employee page */}
                    <Link href={`/employees/${r.id}`} className="underline">
                      {r.full_name}
                    </Link>
                  </td>
                  <td className="p-2">
                    {r.rate_per_day != null
                      ? `₱${Number(r.rate_per_day).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="p-2">{r.status ?? "active"}</td>
                  {/* All actions must be inside a <td> */}
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      <Link
                        className="text-xs underline"
                        href={`/employees/${r.id}`}
                      >
                        Open
                      </Link>
                      {/* Direct-to-drawer edit */}
                      <Link
                        className="text-xs underline"
                        href={`/employees/${r.id}?edit=1`}
                      >
                        Edit
                      </Link>
                      {r.status !== "archived" && (
                        <button
                          type="button"
                          onClick={() => archive(r.id)}
                          className="text-xs underline disabled:opacity-60"
                          disabled={busy}
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
