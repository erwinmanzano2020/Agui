"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  houseId: string;
  houseSlug: string;
  defaultStartDate: string;
  defaultEndDate: string;
};

export function PayrollRunCreateForm({
  houseId,
  houseSlug,
  defaultStartDate,
  defaultEndDate,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const response = await fetch("/api/hr/payroll-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          houseId,
          periodStart: startDate,
          periodEnd: endDate,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setMessage(body?.message ?? "Unable to create payroll run.");
        return;
      }

      const payload = (await response.json()) as { runId?: string };
      if (!payload.runId) {
        setMessage("Payroll run created, but no run id returned.");
        return;
      }

      startTransition(() => {
        router.push(`/company/${houseSlug}/hr/payroll-runs/${payload.runId}`);
      });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Unable to create payroll run.";
      setMessage(text);
    }
  }

  return (
    <form className="mt-4 flex flex-wrap items-end gap-4" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        Start date
        <input
          type="date"
          name="periodStart"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          className="w-44 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        End date
        <input
          type="date"
          name="periodEnd"
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
          className="w-44 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-border bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Creating…" : "Create draft run"}
      </button>
      {message ? <p className="w-full text-sm text-rose-500">{message}</p> : null}
    </form>
  );
}
