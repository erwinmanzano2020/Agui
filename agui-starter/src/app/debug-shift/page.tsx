// agui-starter/src/app/debug-shift/page.tsx
"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { resolveEffectiveShift, EffectiveShift } from "@/lib/shifts";

export default function DebugShiftPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [code, setCode] = useState("EMP-0001");
  const [date, setDate] = useState(today);
  const [result, setResult] = useState<EffectiveShift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const sb = getSupabase();
      if (!sb) {
        setError("Supabase not configured");
        setLoading(false);
        return;
      }

      const emp = await sb
        .from("employees")
        .select("id")
        .eq("code", code)
        .maybeSingle();

      const empId = emp.data?.id;
      if (!empId) {
        setError(`No employee found for code: ${code}`);
        setLoading(false);
        return;
      }

      const eff = await resolveEffectiveShift(empId, date);
      setResult(eff);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-semibold mb-3">Debug Shift Resolver</h1>

      <div className="flex flex-col gap-2 mb-3">
        <input
          className="border rounded px-3 py-2"
          placeholder="Employee Code (e.g., EMP-0001)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          type="date"
          className="border border-border rounded px-3 py-2 bg-background text-foreground"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button
          className="bg-success text-success-foreground rounded px-3 py-2 disabled:opacity-50"
          onClick={run}
          disabled={loading}
        >
          {loading ? "Checking…" : "Resolve shift"}
        </button>
      </div>

      {error && <div className="text-danger text-sm mb-2">{error}</div>}

      <pre className="text-sm border border-border rounded p-3 bg-muted">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}
