"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  runId: string;
  houseId: string;
};

export default function MarkPayrollRunPaidForm({ runId, houseId }: Props) {
  const router = useRouter();
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/hr/payroll-runs/${runId}/mark-paid?houseId=${houseId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paymentMethod: paymentMethod.trim() || null,
              paymentNote: paymentNote.trim() || null,
            }),
          },
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          if (response.status === 409) {
            setError(payload?.message ?? "Payroll run must be posted first.");
            return;
          }
          if (response.status === 403) {
            setError(payload?.message ?? "You do not have access to mark this run paid.");
            return;
          }
          if (response.status === 404) {
            setError(payload?.message ?? "Payroll run not found.");
            return;
          }
          setError(payload?.message ?? "Failed to mark payroll run paid.");
          return;
        }

        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to mark payroll run paid.");
      }
    });
  };

  return (
    <form className="space-y-3 rounded-xl border border-border bg-white/60 p-4" onSubmit={handleSubmit}>
      <div>
        <h4 className="text-sm font-semibold text-foreground">Mark paid</h4>
        <p className="text-xs text-muted-foreground">Record payment method and notes.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="payment-method">Payment method</Label>
          <Input
            id="payment-method"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
            placeholder="Bank transfer"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="payment-note">Payment note</Label>
          <Input
            id="payment-note"
            value={paymentNote}
            onChange={(event) => setPaymentNote(event.target.value)}
            placeholder="Optional note"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Mark paid"}
        </Button>
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
      </div>
    </form>
  );
}
