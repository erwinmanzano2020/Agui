"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type Props = {
  runId: string;
  houseId: string;
};

export default function FinalizePayrollRunButton({ runId, houseId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFinalize = () => {
    setError(null);
    const confirmed = window.confirm("This locks the snapshot and prevents edits.");
    if (!confirmed) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/hr/payroll-runs/${runId}/finalize?houseId=${houseId}`,
          { method: "POST" },
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          if (response.status === 409) {
            setError(payload?.message ?? "Payroll run already finalized.");
            return;
          }
          if (response.status === 403) {
            setError(payload?.message ?? "You do not have access to finalize this run.");
            return;
          }
          if (response.status === 404) {
            setError(payload?.message ?? "Payroll run not found.");
            return;
          }
          setError(payload?.message ?? "Failed to finalize payroll run.");
          return;
        }

        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to finalize payroll run.");
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" size="sm" onClick={handleFinalize} disabled={isPending}>
        {isPending ? "Finalizing…" : "Finalize run"}
      </Button>
      <p className="text-xs text-muted-foreground">This locks the snapshot and prevents edits.</p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
