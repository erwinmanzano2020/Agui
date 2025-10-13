"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type AttendanceMode = "PRORATE" | "DEDUCTION";

export default function PayrollSettingsPageClient() {
  // Defaults per spec
  const [std, setStd] = useState<number>(630);
  const [ot, setOt] = useState<number>(1.0);
  const [mode, setMode] = useState<AttendanceMode>("DEDUCTION");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      if (!sb) {
        setMsg("Supabase not configured");
        return;
      }

      const { data, error } = await sb
        .from("settings_payroll")
        .select("standard_minutes_per_day, ot_multiplier, attendance_mode")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        setMsg(`Failed to load settings: ${error.message}`);
        return;
      }

      if (data?.standard_minutes_per_day != null) {
        setStd(data.standard_minutes_per_day as number);
      }
      if (data?.ot_multiplier != null) {
        setOt(Number(data.ot_multiplier));
      }
      if (data?.attendance_mode) {
        const v = String(data.attendance_mode).toUpperCase();
        setMode(v === "PRORATE" ? "PRORATE" : "DEDUCTION");
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);

    const sb = getSupabase();
    if (!sb) {
      setMsg("Supabase not configured");
      setSaving(false);
      return;
    }

    const { error } = await sb.from("settings_payroll").upsert({
      id: 1,
      standard_minutes_per_day: std,
      ot_multiplier: ot,
      attendance_mode: mode,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    setMsg(error ? `Save failed: ${error.message}` : "Saved ✔");
    // Optionally re-fetch to confirm persisted values
    // (left out to keep UI snappy)
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Payroll Settings</h1>

      {msg && (
        <div className="mb-3 p-3 rounded bg-green-50 border border-green-200 text-green-800">
          {msg}
        </div>
      )}

      {/* Attendance mode selector */}
      <label className="text-sm block mb-1">Attendance mode</label>
      <select
        className="border rounded px-3 py-2 w-full mb-4"
        value={mode}
        onChange={(e) => setMode(e.target.value as AttendanceMode)}
      >
        <option value="DEDUCTION">
          DEDUCTION – full day pay, show late/UT as deductions
        </option>
        <option value="PRORATE">
          PRORATE – pay only the minutes worked (no extra deduction line)
        </option>
      </select>

      {/* Standard minutes per day */}
      <label className="text-sm block mb-1">Standard minutes per day</label>
      <input
        type="number"
        className="border rounded px-3 py-2 w-full mb-4"
        value={std}
        onChange={(e) => setStd(parseInt(e.target.value || "0", 10))}
      />

      {/* OT multiplier */}
      <label className="text-sm block mb-1">OT multiplier</label>
      <input
        type="number"
        step="0.01"
        min="0"
        className="border rounded px-3 py-2 w-full mb-4"
        value={ot}
        onChange={(e) => setOt(parseFloat(e.target.value || "0"))}
      />

      <button
        className="bg-green-600 text-white rounded px-4 py-2"
        disabled={saving}
        onClick={save}
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
