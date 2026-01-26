"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type Props = {
  runId: string;
  houseId: string;
};

export default function PostPayrollRunButton({ runId, houseId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handlePost = () => {
    setError(null);
    const confirmed = window.confirm("Posting locks this run permanently. Continue?");
    if (!confirmed) return;

    const note = window.prompt("Optional posting note (leave blank if none):", "") ?? "";

    startTransition(async () => {
      try {
        const response = await fetch(`/api/hr/payroll-runs/${runId}/post?houseId=${houseId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postNote: note.trim() || null }),
          },
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          if (response.status === 409) {
            setError(payload?.message ?? "Payroll run cannot be posted.");
            return;
          }
          if (response.status === 403) {
            setError(payload?.message ?? "You do not have access to post this run.");
            return;
          }
          if (response.status === 404) {
            setError(payload?.message ?? "Payroll run not found.");
            return;
          }
          setError(payload?.message ?? "Failed to post payroll run.");
          return;
        }

        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to post payroll run.");
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" size="sm" onClick={handlePost} disabled={isPending}>
        {isPending ? "Posting…" : "Post run"}
      </Button>
      <p className="text-xs text-muted-foreground">Posting locks the run and assigns a reference.</p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
