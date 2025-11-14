"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { normalizeDenominations } from "@/lib/pos/shift-utils";
import { getSupabase } from "@/lib/supabase";

function createRow(value = 0, count = 0) {
  return { id: crypto.randomUUID(), value, count } as const;
}

type DenominationRow = ReturnType<typeof createRow>;

type ShiftSummary = {
  id: string;
  status: "OPEN" | "CLOSED" | "VERIFIED";
};

type Props = {
  branchId: string;
  branchName: string;
  cashierEntityId: string | null;
  blindDropEnabled: boolean;
  floatDefaults: Record<string, number>;
};

function rowsFromDefaults(defaults: Record<string, number>): DenominationRow[] {
  const entries = Object.entries(defaults)
    .map(([value, count]) => ({ value: Number.parseInt(value, 10) || 0, count: Number(count) || 0 }))
    .filter((entry) => entry.value > 0 && entry.count > 0)
    .sort((a, b) => b.value - a.value);
  if (entries.length === 0) {
    return [createRow(1000, 0), createRow(500, 0), createRow(100, 0)];
  }
  return entries.map((entry) => createRow(entry.value, entry.count));
}

function rowsFromJson(json: Record<string, number>): DenominationRow[] {
  const map = normalizeDenominations(json);
  if (map.size === 0) {
    return rowsFromDefaults({});
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([value, count]) => createRow(value, count));
}

function rowsToPayload(rows: DenominationRow[]): Record<string, number> {
  const payload: Record<string, number> = {};
  rows.forEach((row) => {
    const value = Math.max(0, Math.trunc(row.value));
    const count = Math.max(0, Math.trunc(row.count));
    if (value > 0 && count > 0) {
      payload[String(value)] = count;
    }
  });
  return payload;
}

function rowsTotal(rows: DenominationRow[]): number {
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
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...rows, createRow(0, 0)])}
        >
          Add denomination
        </Button>
      </div>
    </div>
  );
}

export default function EndShiftClient({
  branchId,
  branchName,
  cashierEntityId,
  blindDropEnabled,
  floatDefaults,
}: Props) {
  const supabase = React.useMemo(() => getSupabase(), []);
  const [openingRows, setOpeningRows] = React.useState<DenominationRow[]>(() => rowsFromDefaults(floatDefaults));
  const [closingRows, setClosingRows] = React.useState<DenominationRow[]>(() => rowsFromDefaults(floatDefaults));
  const [shift, setShift] = React.useState<ShiftSummary | null>(null);
  const [overageBalance, setOverageBalance] = React.useState<number | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const openingTotal = React.useMemo(() => rowsTotal(openingRows), [openingRows]);
  const closingTotal = React.useMemo(() => rowsTotal(closingRows), [closingRows]);

  const refresh = React.useCallback(async () => {
    if (!supabase || !cashierEntityId) return;
    const { data: shiftRow, error: shiftError } = await supabase
      .from("pos_shifts")
      .select("id, status, opening_float_json")
      .eq("branch_id", branchId)
      .eq("cashier_entity_id", cashierEntityId)
      .in("status", ["OPEN", "CLOSED"])
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; status: "OPEN" | "CLOSED" | "VERIFIED"; opening_float_json: Record<string, number> }>();

    if (shiftError) {
      console.warn("Failed to fetch open shift", shiftError);
    }

    if (shiftRow) {
      setShift({ id: shiftRow.id, status: shiftRow.status });
      setOpeningRows(rowsFromJson((shiftRow.opening_float_json ?? {}) as Record<string, number>));
    } else {
      setShift(null);
      setOpeningRows(rowsFromDefaults(floatDefaults));
    }

    const { data: poolRow } = await supabase
      .from("pos_overage_pool")
      .select("balance_amount")
      .eq("branch_id", branchId)
      .eq("cashier_entity_id", cashierEntityId)
      .maybeSingle<{ balance_amount: number }>();

    setOverageBalance(poolRow?.balance_amount ?? null);
  }, [branchId, cashierEntityId, floatDefaults, supabase]);

  React.useEffect(() => {
    refresh().catch((err) => console.warn("Failed to refresh shift", err));
  }, [refresh]);

  React.useEffect(() => {
    setOpeningRows(rowsFromDefaults(floatDefaults));
    setClosingRows(rowsFromDefaults(floatDefaults));
  }, [floatDefaults]);

  const handleOpenShift = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!cashierEntityId) {
        setError("Unable to determine cashier");
        return;
      }
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const response = await fetch("/api/pos/shift/open", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            branchId,
            cashierEntityId,
            openingFloat: rowsToPayload(openingRows),
          }),
        });
        const payload = (await response.json()) as { ok?: boolean; error?: string; shiftId?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Open shift failed");
        }
        setMessage("Shift opened successfully.");
        setShift({ id: payload.shiftId ?? "", status: "OPEN" });
        await refresh();
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to open shift");
      } finally {
        setLoading(false);
      }
    },
    [branchId, cashierEntityId, openingRows, refresh],
  );

  const handleSubmitDrop = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!shift) {
        setError("No open shift to submit.");
        return;
      }
      setLoading(true);
      setError(null);
      setMessage(null);
      try {
        const response = await fetch("/api/pos/shift/submit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            shiftId: shift.id,
            denominations: rowsToPayload(closingRows),
          }),
        });
        const payload = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Submit failed");
        }
        setMessage("Blind drop submitted.");
        await refresh();
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to submit");
      } finally {
        setLoading(false);
      }
    },
    [closingRows, refresh, shift],
  );

  const disabled = !supabase;
  const showSubmit = Boolean(shift && shift.status !== "VERIFIED");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cashiering · {branchName}</h1>
          <p className="text-sm text-muted-foreground">Manage your end-of-shift cash counts.</p>
        </div>
        {overageBalance != null && (
          <Badge tone="on">Overage pool: ₱{(overageBalance / 100).toFixed(2)}</Badge>
        )}
      </div>
      {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
      {message && <p className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
      {!blindDropEnabled && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">
          Blind drop submissions are currently disabled by settings.
        </p>
      )}
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <h2 className="text-lg font-medium">Start shift</h2>
            <p className="text-sm text-muted-foreground">
              Capture the float you received at the beginning of your shift.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleOpenShift}>
            <DenominationEditor rows={openingRows} onChange={setOpeningRows} disabled={loading || disabled} />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Opening float total</span>
              <span>₱{(openingTotal / 100).toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading || disabled}>Open shift</Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading || disabled}
                onClick={() => {
                  setOpeningRows(rowsFromDefaults(floatDefaults));
                }}
              >
                Reset to defaults
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div className="space-y-1">
            <h2 className="text-lg font-medium">Submit blind drop</h2>
            <p className="text-sm text-muted-foreground">
              Enter the denominations you counted at the end of your shift.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmitDrop}>
            <DenominationEditor
              rows={closingRows}
              onChange={setClosingRows}
              disabled={loading || disabled || !showSubmit || !blindDropEnabled}
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Submitted total</span>
              <span>₱{(closingTotal / 100).toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading || disabled || !showSubmit || !blindDropEnabled}>
                Submit for verification
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading || disabled}
                onClick={() => setClosingRows(rowsFromDefaults(floatDefaults))}
              >
                Fill from defaults
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
