"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import { ThemedLink } from "@/components/ui/themed-link";
import { getSupabase } from "@/lib/supabase";
import { useUiTerms } from "@/lib/ui-terms-context";
import type { EmployeeListItem } from "@/lib/hr/employees-server";

type EmployeeRow = {
  id: string;
  display_name: string;
  status: EmployeeListItem["status"];
  branch_id: string | null;
};

const OFF_STATUSES = new Set(["inactive"]);

export default function EmployeesPageClient() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const terms = useUiTerms();
  const teamLabel = terms.team;
  const teamLower = teamLabel.toLowerCase();

  const renderStatus = (status: EmployeeRow["status"]) => {
    const raw = status ?? "active";
    const normalized = raw.toLowerCase();
    const tone = OFF_STATUSES.has(normalized) ? "off" : "on";
    const label = raw.replace(/_/g, " ");
    return <Badge tone={tone}>{label}</Badge>;
  };

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    const response = await fetch("/api/hr/employees");
    const payload = (await response.json().catch(() => null)) as
      | { employees?: EmployeeListItem[]; error?: string }
      | null;

    if (!response.ok || !payload || payload.error) {
      setErr(payload?.error ?? "Failed to load employees");
      setRows([]);
      setLoading(false);
      return;
    }

    const normalized: EmployeeRow[] = (payload.employees ?? []).map((row) => ({
      id: row.id,
      display_name: row.display_name,
      status: row.status,
      branch_id: row.branch_id ?? null,
    } satisfies EmployeeRow));

    setRows(normalized);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      .update({ status: "inactive" })
      .eq("id", id);

    if (error) setErr(error.message);
    await load();
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{teamLabel}</h1>
          <p className="text-sm text-[var(--agui-muted-foreground)]">
            Manage your {teamLower} and keep everyone in sync.
          </p>
        </div>
        <Button asChild>
          <Link href="/invites/new">Invite</Link>
        </Button>
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
          <EmptyState
            title={`No ${teamLower} yet`}
            description={`Add your first ${teamLower} to get started.`}
            actionLabel={`Add ${teamLabel}`}
            onAction={() => router.push("/employees/new")}
          />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-[color-mix(in_srgb,_var(--agui-on-surface)_85%,_var(--agui-surface)_15%)]">
                <th className="p-2 font-medium">Name</th>
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
                  <td className="p-2">
                    <ThemedLink href={`/employees/${r.id}`} className="text-sm">
                      {r.display_name}
                    </ThemedLink>
                  </td>
                  <td className="p-2">{renderStatus(r.status)}</td>
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
                      {r.status !== "inactive" && (
                        <Button
                          type="button"
                          variant="link"
                          size="xs"
                          className="text-xs"
                          onClick={() => archive(r.id)}
                          disabled={busy}
                        >
                          Deactivate
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
