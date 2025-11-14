"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  canCoverWithOveragePool,
  normalizeDenominations,
} from "@/lib/pos/shift-utils";
import { getSupabase } from "@/lib/supabase";

function createRow(value = 0, count = 0) {
  return { id: crypto.randomUUID(), value, count } as const;
}

type DenominationRow = ReturnType<typeof createRow>;

type ShiftRow = {
  id: string;
  cashierId: string;
  status: "OPEN" | "CLOSED" | "VERIFIED";
  cashierName: string;
};

type ManifestResponse = {
  shift: {
    id: string;
    branchId: string;
    cashierEntityId: string;
    status: string;
  };
  submission: {
    id: string;
    submittedBy: string;
    submittedAt: string;
    denominations: Record<string, number>;
    total: number;
    notes: string | null;
  } | null;
  verification: unknown;
  openingFloat: {
    denominations: Record<string, number>;
    total: number;
  };
  overagePoolBalance: number | null;
};

type Props = {
  branchId: string;
  branchName: string;
  overagePoolEnabled: boolean;
  maxOffsetRatio: number;
};

function rowsFromDenoms(map: Record<string, number>): DenominationRow[] {
  const normalized = normalizeDenominations(map);
  if (normalized.size === 0) {
    return [createRow(1000, 0), createRow(500, 0), createRow(100, 0)];
  }
  return Array.from(normalized.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([value, count]) => createRow(value, count));
}

function rowsToPayload(rows: DenominationRow[]): Record<string, number> {
  const payload: Record<string, number> = {};
  rows.forEach((row) => {
    const value = Math.max(0, Math.trunc(row.value));
    const count = Math.max(0, Math.trunc(row.count));
    if (value > 0 && count >= 0) {
      payload[String(value)] = count;
    }
  });
  return payload;
}

function totalFromRows(rows: DenominationRow[]): number {
  return rows.reduce((sum, row) => sum + Math.max(0, row.value) * Math.max(0, row.count), 0);
}

function DenominationEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: DenominationRow[];
  onChange: (rows: DenominationRow[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={row.id} className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Value (¢)</label>
            <Input
              type="number"
              value={row.value}
              disabled={disabled}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10) || 0;
                const next = rows.slice();
                next[index] = { ...row, value };
                onChange(next);
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Count</label>
            <Input
              type="number"
              value={row.count}
              disabled={disabled}
              onChange={(event) => {
                const count = Number.parseInt(event.target.value, 10) || 0;
                const next = rows.slice();
                next[index] = { ...row, count };
                onChange(next);
              }}
            />
          </div>
        </div>
      ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange([...rows, createRow(0, 0)])}
        >
          Add denomination
        </Button>
    </div>
  );
}

export default function VerifyDropClient({
  branchId,
  branchName,
  overagePoolEnabled,
  maxOffsetRatio,
}: Props) {
  const supabase = React.useMemo(() => getSupabase(), []);
  const [shifts, setShifts] = React.useState<ShiftRow[]>([]);
  const [selectedShiftId, setSelectedShiftId] = React.useState<string | null>(null);
  const [manifest, setManifest] = React.useState<ManifestResponse | null>(null);
  const [rows, setRows] = React.useState<DenominationRow[]>([]);
  const [resolution, setResolution] = React.useState<"PAID_NOW" | "PAYROLL_DEDUCT" | "OVERAGE_OFFSET" | "ESCALATED">("PAID_NOW");
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const submissionTotal = manifest?.submission?.total ?? 0;
  const recountTotal = totalFromRows(rows);
  const difference = recountTotal - submissionTotal;
  const varianceType = difference === 0 ? "NONE" : difference > 0 ? "OVER" : "SHORT";
  const varianceAmount = Math.abs(difference);

  const overageBalance = manifest?.overagePoolBalance ?? 0;
  const { allowed: offsetAllowed, maxOffset } = canCoverWithOveragePool(
    varianceType === "SHORT" ? varianceAmount : 0,
    overageBalance,
    maxOffsetRatio,
  );

  const refreshShifts = React.useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("pos_shifts")
      .select("id, status, cashier_entity_id")
      .eq("branch_id", branchId)
      .eq("status", "CLOSED")
      .order("closed_at", { ascending: false });
    if (error) {
      console.warn("Failed to load shifts for verification", error);
      return;
    }
    const rows = (data ?? []).map((row) => ({
      id: row.id as string,
      status: (row.status as "OPEN" | "CLOSED" | "VERIFIED") ?? "CLOSED",
      cashierId: (row.cashier_entity_id as string) ?? "",
      cashierName: (row.cashier_entity_id as string) ?? "",
    }));
    if (rows.length === 0) {
      setShifts([]);
      setSelectedShiftId(null);
      setManifest(null);
      return;
    }
    const cashierIds = Array.from(new Set(rows.map((row) => row.cashierId).filter(Boolean)));
    if (cashierIds.length > 0) {
      const { data: entityRows } = await supabase
        .from("entities")
        .select("id, display_name")
        .in("id", cashierIds);
      const nameMap = new Map<string, string>();
      for (const entry of entityRows ?? []) {
        const id = (entry as { id?: string }).id;
        const name = (entry as { display_name?: string }).display_name;
        if (id) {
          nameMap.set(id, name ?? id);
        }
      }
      rows.forEach((row) => {
        row.cashierName = nameMap.get(row.cashierId) ?? row.cashierId;
      });
    }
    setShifts(rows);
    setSelectedShiftId((current) => current ?? rows[0]?.id ?? null);
  }, [branchId, supabase]);

  React.useEffect(() => {
    refreshShifts().catch((err) => console.warn("Failed to refresh shifts", err));
  }, [refreshShifts]);

  React.useEffect(() => {
    async function loadManifest(shiftId: string) {
      setError(null);
      setMessage(null);
      try {
        const response = await fetch(`/api/pos/shift/${shiftId}/manifest`);
        const payload = (await response.json()) as ManifestResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load manifest");
        }
        setManifest(payload);
        const denomin = payload.submission?.denominations ?? {};
        setRows(rowsFromDenoms(denomin));
        setResolution("PAID_NOW");
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load shift");
        setManifest(null);
        setRows(rowsFromDenoms({}));
      }
    }

    if (selectedShiftId) {
      loadManifest(selectedShiftId).catch((err) => console.warn("manifest error", err));
    }
  }, [selectedShiftId]);

  const handleVerify = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!selectedShiftId) return;
      if (!manifest?.submission) {
        setError("No blind drop submission to verify.");
        return;
      }
      if (varianceType === "NONE" && resolution !== "PAID_NOW") {
        setError("Zero variance must be marked as paid now.");
        return;
      }
      if (varianceType === "SHORT" && resolution === "OVERAGE_OFFSET" && (!overagePoolEnabled || !offsetAllowed)) {
        setError("Overage pool cannot cover this shortage.");
        return;
      }
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const response = await fetch("/api/pos/shift/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            shiftId: selectedShiftId,
            denominations: rowsToPayload(rows),
            resolution,
            resolutionMeta: {
              notes: notes || undefined,
              overagePoolBalance: manifest.overagePoolBalance,
            },
            notes: notes || undefined,
          }),
        });
        const payload = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Verification failed");
        }
        setMessage("Drop verified successfully.");
        setNotes("");
        await refreshShifts();
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to verify drop");
      } finally {
        setLoading(false);
      }
    },
    [manifest, offsetAllowed, overagePoolEnabled, refreshShifts, resolution, rows, selectedShiftId, varianceType, notes],
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Verify cash drops · {branchName}</h1>
          <p className="text-sm text-muted-foreground">Recount blind drops and resolve variances.</p>
        </div>
        {manifest?.overagePoolBalance != null && (
          <Badge tone="on">Overage pool: ₱{((manifest.overagePoolBalance ?? 0) / 100).toFixed(2)}</Badge>
        )}
      </div>
      {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
      {message && <p className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <h2 className="text-lg font-medium">Pending drops</h2>
            <p className="text-sm text-muted-foreground">Select a shift to verify.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shifts awaiting verification.</p>
          ) : (
            <select
              className="w-full rounded-md border border-input bg-background p-2 text-sm"
              value={selectedShiftId ?? ""}
              onChange={(event) => setSelectedShiftId(event.target.value || null)}
              disabled={loading}
            >
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.cashierName} · Shift {shift.id.slice(0, 8)}
                </option>
              ))}
            </select>
          )}
        </CardContent>
      </Card>
      {manifest?.submission ? (
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <h2 className="text-lg font-medium">Recount</h2>
              <p className="text-sm text-muted-foreground">
                Cashier submitted ₱{(submissionTotal / 100).toFixed(2)}. Enter your recount and choose a resolution.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleVerify}>
              <DenominationEditor rows={rows} onChange={setRows} disabled={loading} />
              <div className="rounded-md border border-muted bg-muted/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Submitted total</span>
                  <span>₱{(submissionTotal / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Recount total</span>
                  <span>₱{(recountTotal / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between font-medium">
                  <span>Variance</span>
                  <span>
                    {varianceType === "NONE"
                      ? "Balanced"
                      : `${varianceType === "SHORT" ? "Short" : "Over"} ₱${(varianceAmount / 100).toFixed(2)}`}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-muted-foreground">Resolution</label>
                <select
                  className="w-full rounded-md border border-input bg-background p-2 text-sm"
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value as typeof resolution)}
                  disabled={loading || varianceType === "NONE"}
                >
                  <option value="PAID_NOW">Pay now / add to pool</option>
                  <option value="PAYROLL_DEDUCT" disabled={varianceType !== "SHORT"}>
                    Payroll deduction
                  </option>
                  {overagePoolEnabled && (
                    <option value="OVERAGE_OFFSET" disabled={varianceType !== "SHORT"}>
                      Use overage pool
                    </option>
                  )}
                  <option value="ESCALATED">Escalate</option>
                </select>
                {resolution === "OVERAGE_OFFSET" && varianceType === "SHORT" && (
                  <p className="text-xs text-muted-foreground">
                    Available pool coverage up to ₱{(maxOffset / 100).toFixed(2)}.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground">Notes (optional)</label>
                <Input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Supervisor notes"
                  disabled={loading}
                />
              </div>
              <Button
                type="submit"
                disabled={
                  loading ||
                  !selectedShiftId ||
                  (varianceType === "SHORT" && resolution === "OVERAGE_OFFSET" && (!overagePoolEnabled || !offsetAllowed)) ||
                  (varianceType === "NONE" && resolution !== "PAID_NOW")
                }
              >
                Verify drop
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">Select a shift with a pending submission to begin verification.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
