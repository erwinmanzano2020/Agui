"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import Link from "next/link";

export default function SettingsPage() {
  const [primary, setPrimary] = useState("#7c3aed");
  const [surface, setSurface] = useState("#0b0b0b");
  const [accent, setAccent] = useState("#06b6d4");
  const [radius, setRadius] = useState(12);

  const [payroll, setPayroll] = useState(true);
  const [employees, setEmployees] = useState(true);
  const [shifts, setShifts] = useState(true);
  const [pos, setPos] = useState(false);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    (async () => {
      const t1 = await sb.from("agui_theme").select("*").single();
      if (t1.data) {
        setPrimary(t1.data.primary ?? primary);
        setSurface(t1.data.surface ?? surface);
        setAccent(t1.data.accent ?? accent);
        setRadius(typeof t1.data.radius === "number" ? t1.data.radius : radius);
      }
      const t2 = await sb.from("agui_toggles").select("*").single();
      if (t2.data) {
        setPayroll(!!t2.data.payroll);
        setEmployees(!!t2.data.employees);
        setShifts(!!t2.data.shifts);
        setPos(!!t2.data.pos);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    const sb = getSupabase();
    if (!sb) return;

    setBusy(true);
    setMsg(null);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      sb.from("agui_theme").upsert(
        { id: 1, primary, surface, accent, radius },
        { onConflict: "id" }
      ),
      sb.from("agui_toggles").upsert(
        { id: 1, payroll, employees, shifts, pos },
        { onConflict: "id" }
      ),
    ]);
    setBusy(false);
    setMsg(e1 || e2 ? (e1?.message || e2?.message || "Save failed") : "Saved!");
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <Link className="btn btn-ghost" href="/agui">Back to Agui</Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-4">
          <h2 className="font-medium mb-3">Theme</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Primary</label>
            <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} />
            <label className="text-sm">Surface</label>
            <input type="color" value={surface} onChange={(e) => setSurface(e.target.value)} />
            <label className="text-sm">Accent</label>
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
            <label className="text-sm">Radius</label>
            <input
              type="number"
              min={0}
              max={24}
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value || "0", 10))}
            />
          </div>
        </div>

        <div className="card p-4">
          <h2 className="font-medium mb-3">Modules</h2>
          <div className="space-y-2">
            <Toggle label="Payroll" value={payroll} onChange={setPayroll} />
            <Toggle label="Employees" value={employees} onChange={setEmployees} />
            <Toggle label="Shifts" value={shifts} onChange={setShifts} />
            <Toggle label="POS" value={pos} onChange={setPos} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <input
        type="checkbox"
        className="accent-foreground"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
