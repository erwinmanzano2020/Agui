"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import EditEmployeeDrawer from "../_components/EditEmployeeDrawer";

type Shift = {
  id: string;
  code: string;
  name: string;
  start_time?: string | null;
  end_time?: string | null;
};

type Employee = {
  code: string;
  full_name: string;
  rate_per_day: number;
};

const UI_DAYS = [
  { label: "Sun", value: 7 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
] as const;

export default function EmployeeSchedulePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const employeeId = params?.id ?? "";

  const [emp, setEmp] = useState<Employee | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [weekly, setWeekly] = useState<Record<number, string | null>>({
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null,
  });

  const [overrides, setOverrides] = useState<
    Array<{ date: string; shift_name: string | null }>
  >([]);
  const [ovrDate, setOvrDate] = useState("");
  const [ovrShift, setOvrShift] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<
    "profile" | "compensation" | "audit"
  >("profile");

  const load = async () => {
    if (!employeeId) return;
    setErr(null);

    const empRes = await supabase
      .from("employees")
      .select("code, full_name, rate_per_day")
      .eq("id", employeeId)
      .maybeSingle();
    if (empRes.error) setErr(empRes.error.message);
    setEmp(empRes.data ?? null);

    const shiftRes = await supabase
      .from("shifts")
      .select("id, code, name, start_time, end_time")
      .order("start_time", { ascending: true });
    if (shiftRes.error) setErr((p) => p ?? shiftRes.error?.message ?? null);
    setShifts(shiftRes.data ?? []);

    const weekRes = await supabase
      .from("employee_shift_weekly")
      .select("day_of_week, shift_id")
      .eq("employee_id", employeeId);
    if (weekRes.error) setErr((p) => p ?? weekRes.error?.message ?? null);
    const map: Record<number, string | null> = {
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
      7: null,
    };
    (weekRes.data ?? []).forEach((r: any) => {
      map[r.day_of_week] = r.shift_id;
    });
    setWeekly(map);

    const ovrRes = await supabase
      .from("employee_shift_overrides")
      .select("date, shift_id, shifts(name)")
      .eq("employee_id", employeeId)
      .order("date", { ascending: true });
    if (ovrRes.error) setErr((p) => p ?? ovrRes.error?.message ?? null);
    const ov = (ovrRes.data ?? []).map((r: any) => ({
      date: r.date,
      shift_name: r.shifts?.name ?? null,
    }));
    setOverrides(ov);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  // Auto-open drawer via query: ?edit=1&tab=comp
  useEffect(() => {
    if (searchParams?.get("edit") === "1") {
      const tab = (searchParams.get("tab") || "").toLowerCase();
      if (tab === "comp" || tab === "compensation")
        setDrawerTab("compensation");
      else if (tab === "audit") setDrawerTab("audit");
      else setDrawerTab("profile");
      setDrawerOpen(true);
    }
  }, [searchParams]);

  // Hotkey: "E" → open on Profile
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key === "e" || e.key === "E") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const el = e.target as HTMLElement | null;
        const tag = el?.tagName;
        const isEditable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          (el as any)?.isContentEditable === true;
        if (!isEditable) {
          e.preventDefault();
          setDrawerTab("profile");
          setDrawerOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const saveDay = async (dayValue: number, shiftId: string | null) => {
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase
        .from("employee_shift_weekly")
        .upsert(
          { employee_id: employeeId, day_of_week: dayValue, shift_id: shiftId },
          { onConflict: "employee_id,day_of_week" },
        );
      if (error) throw error;
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save day.");
    } finally {
      setBusy(false);
    }
  };

  const saveOverride = async () => {
    if (!ovrDate) return;
    setBusy(true);
    setErr(null);
    try {
      const shiftId = ovrShift || null;
      const { error } = await supabase
        .from("employee_shift_overrides")
        .upsert(
          { employee_id: employeeId, date: ovrDate, shift_id: shiftId },
          { onConflict: "employee_id,date" },
        );
      if (error) throw error;

      setOvrDate("");
      setOvrShift("");
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save override.");
    } finally {
      setBusy(false);
    }
  };

  const removeOverride = async (date: string) => {
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase
        .from("employee_shift_overrides")
        .delete()
        .eq("employee_id", employeeId)
        .eq("date", date);
      if (error) throw error;
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to remove override.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Employee</h1>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded border"
            onClick={() => {
              setDrawerTab("profile");
              setDrawerOpen(true);
            }}
          >
            Edit Profile
          </button>
          <button
            className="px-3 py-2 rounded border"
            onClick={() => {
              setDrawerTab("compensation");
              setDrawerOpen(true);
            }}
          >
            ₱ Compensation
          </button>
        </div>
      </div>

      {/* Drawer */}
      <EditEmployeeDrawer
        employeeId={employeeId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialTab={drawerTab}
        onDataChanged={load} // <-- THIS refreshes the page data immediately
      />

      {/* Employee Card */}
      {!emp ? (
        <div className="border rounded p-3 mb-6">
          {err ? "Employee not found or failed to load." : "Loading employee…"}
        </div>
      ) : (
        <div className="border rounded p-3 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
            <div>
              Code: <b>{emp.code}</b>
            </div>
            <div>
              Name: <b>{emp.full_name}</b>
            </div>
            <div>
              Rate/Day: <b>₱{Number(emp.rate_per_day).toFixed(2)}</b>
            </div>
          </div>
        </div>
      )}

      {err && <div className="mb-3 text-sm text-red-600">Error: {err}</div>}

      {/* Weekly Map */}
      <div className="border rounded p-3 mb-6">
        <h2 className="font-medium mb-3">Weekly Map</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {UI_DAYS.map((d) => (
            <div key={d.value} className="border rounded p-2">
              <div className="text-sm mb-1">{d.label}</div>
              <select
                className="border rounded px-2 py-1 w-full"
                value={weekly[d.value] ?? ""}
                onChange={(e) => saveDay(d.value, e.target.value || null)}
                disabled={busy}
              >
                <option value="">Rest Day</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.start_time && s.end_time
                      ? ` (${s.start_time}–${s.end_time})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Overrides */}
      <div className="border rounded p-3 mb-6">
        <h2 className="font-medium mb-2">Date Overrides</h2>
        <div className="flex flex-col md:flex-row gap-2 mb-3">
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={ovrDate}
            onChange={(e) => setOvrDate(e.target.value)}
          />
          <select
            className="border rounded px-2 py-1"
            value={ovrShift}
            onChange={(e) => setOvrShift(e.target.value)}
            disabled={busy}
          >
            <option value="">Rest Day</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            className="bg-green-600 text-white rounded px-3 py-1"
            onClick={saveOverride}
            disabled={busy || !ovrDate}
          >
            Save Override
          </button>
        </div>

        {overrides.length === 0 ? (
          <div className="text-sm text-gray-600">No overrides</div>
        ) : (
          <ul className="text-sm list-disc ml-5">
            {overrides.map((o) => (
              <li key={o.date} className="flex items-center gap-2">
                <span>
                  {o.date}: <b>{o.shift_name ?? "Rest Day"}</b>
                </span>
                <button
                  className="text-xs underline"
                  onClick={() => removeOverride(o.date)}
                  disabled={busy}
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
