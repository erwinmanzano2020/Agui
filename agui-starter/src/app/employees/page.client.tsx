"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ThemedLink } from "@/components/ui/themed-link";
import { getSupabase } from "@/lib/supabase";

type EmployeeRow = {
  id: string;
  code: string;
  full_name: string;
  status: string | null;
  rate_per_day: number | null;
};

export default function EmployeesPageClient() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setErr(null);
    setLoading(true);
    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase not configured");
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await sb
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
    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase not configured");
      setBusy(false);
      return;
    }
    const { error } = await sb
      .from("employees")
      .update({ status: "archived" })
      .eq("id", id);

    if (error) setErr(error.message);
    await load();
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <p className="text-sm text-[var(--agui-muted-foreground)]">
          View and manage the people that make your town thrive.
        </p>
      </header>

      {err && (
        <div className="rounded-[var(--agui-radius)] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          Error: {err}
        </div>
      )}

      <Card className="overflow-x-auto p-4">
        {loading ? (
          <div className="text-sm text-[var(--agui-muted-foreground)]">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-[var(--agui-muted-foreground)]">
            No employees found.
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[color-mix(in_srgb,_var(--agui-on-surface)_85%,_var(--agui-surface)_15%)]">
                <th className="p-2 font-medium">Code</th>
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium">Rate/Day</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-[color:color-mix(in_srgb,_var(--agui-card-border)_60%,_transparent)]"
                >
                  <td className="p-2 font-medium text-[color-mix(in_srgb,_var(--agui-on-surface)_90%,_var(--agui-surface)_10%)]">
                    {r.code}
                  </td>
                  <td className="p-2">
                    <ThemedLink href={`/employees/${r.id}`} className="text-sm">
                      {r.full_name}
                    </ThemedLink>
                  </td>
                  <td className="p-2">
                    {r.rate_per_day != null
                      ? `₱${Number(r.rate_per_day).toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="p-2 capitalize">{r.status ?? "active"}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <ThemedLink
                        className="text-xs font-medium"
                        href={`/employees/${r.id}`}
                      >
                        Open
                      </ThemedLink>
                      <ThemedLink
                        className="text-xs font-medium"
                        href={`/employees/${r.id}?edit=1`}
                      >
                        Edit
                      </ThemedLink>
                      {r.status !== "archived" && (
                        <Button
                          type="button"
                          variant="link"
                          size="xs"
                          className="text-xs"
                          onClick={() => archive(r.id)}
                          disabled={busy}
                        >
                          Archive
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
