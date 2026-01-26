"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type Props = {
  runId: string;
  houseId: string;
  houseSlug: string;
};

export default function CreateAdjustmentRunButton({ runId, houseId, houseSlug }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = () => {
    setError(null);
    const confirmed = window.confirm("Create an adjustment run for this payroll period?");
    if (!confirmed) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/hr/payroll-runs/${runId}/adjustments?houseId=${houseId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          if (response.status === 409) {
            setError(payload?.message ?? "Payroll run must be posted before adjusting.");
            return;
          }
          if (response.status === 403) {
            setError(payload?.message ?? "You do not have access to create adjustments.");
            return;
          }
          if (response.status === 404) {
            setError(payload?.message ?? "Payroll run not found.");
            return;
          }
          setError(payload?.message ?? "Failed to create adjustment run.");
          return;
        }

        const payload = (await response.json().catch(() => null)) as { runId?: string } | null;
        if (payload?.runId) {
          router.push(`/company/${houseSlug}/hr/payroll-runs/${payload.runId}`);
        } else {
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create adjustment run.");
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" size="sm" variant="outline" onClick={handleCreate} disabled={isPending}>
        {isPending ? "Creating…" : "Create adjustment run"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
