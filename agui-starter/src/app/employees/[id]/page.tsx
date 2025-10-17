"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import EditEmployeeDrawer from "../_components/EditEmployeeDrawer";

import type { Employee as EmployeeRecord } from "@/lib/types";

type Shift = {
  id: string;
  code: string;
  name: string;
  start_time?: string | null;
  end_time?: string | null;
};

type Employee = Pick<EmployeeRecord, "code" | "full_name" | "rate_per_day">;

type WeeklyShiftRow = { day_of_week: number; shift_id: string | null };
type OverrideRow = {
  date: string;
  shift_id: string | null;
  shifts: { name: string | null } | { name: string | null }[] | null;
};

const EMPTY_WEEK: Record<number, string | null> = {
  1: null,
  2: null,
  3: null,
  4: null,
  5: null,
  6: null,
  7: null,
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
  const [weekly, setWeekly] = useState<Record<number, string | null>>(
    () => ({ ...EMPTY_WEEK }),
  );

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

  const load = useCallback(async () => {
    if (!employeeId) return;
    setErr(null);

    const sb = getSupabase();
    if (!sb) {
      setErr("Supabase not configured");
      setEmp(null);
      setShifts([]);
      setWeekly({ ...EMPTY_WEEK });
      setOverrides([]);
      return;
    }

    const empRes = await sb
      .from("employees")
      .select("code, full_name, rate_per_day")
      .eq("id", employeeId)
      .maybeSingle();
    if (empRes.error) setErr(empRes.error.message);
    setEmp(empRes.data ?? null);

    const shiftRes = await sb
      .from("shifts")
      .select("id, code, name, start_time, end_time")
      .order("start_time", { ascending: true });
    if (shiftRes.error) setErr((p) => p ?? shiftRes.error?.message ?? null);
    setShifts(shiftRes.data ?? []);

    const weekRes = await sb
      .from("employee_shift_weekly")
      .select("day_of_week, shift_id")
      .eq("employee_id", employeeId);
    if (weekRes.error) setErr((p) => p ?? weekRes.error?.message ?? null);
    const weeklyRows = (weekRes.data ?? []) as WeeklyShiftRow[];
    const map: Record<number, string | null> = { ...EMPTY_WEEK };
    weeklyRows.forEach((row) => {
      map[row.day_of_week] = row.shift_id ?? null;
    });
    setWeekly(map);

    const ovrRes = await sb
      .from("employee_shift_overrides")
      .select("date, shift_id, shifts(name)")
      .eq("employee_id", employeeId)
      .order("date", { ascending: true });
    if (ovrRes.error) setErr((p) => p ?? ovrRes.error?.message ?? null);
    const overrideRows = (ovrRes.data ?? []) as OverrideRow[];
    const ov = overrideRows.map((row) => {
      const shift = Array.isArray(row.shifts) ? row.shifts[0] : row.shifts;
      return {
        date: row.date,
        shift_name: shift?.name ?? null,
      };
    });
    setOverrides(ov);
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

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
        const target = e.target;
        const isEditable =
          target instanceof HTMLElement &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable);
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
      const sb = getSupabase();
      if (!sb) {
        throw new Error("Supabase not configured");
      }

      const { error } = await sb
        .from("employee_shift_weekly")
        .upsert(
          { employee_id: employeeId, day_of_week: dayValue, shift_id: shiftId },
          { onConflict: "employee_id,day_of_week" },
        );
      if (error) throw error;
      await load();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Failed to save day.");
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
      const sb = getSupabase();
      if (!sb) {
        throw new Error("Supabase not configured");
      }

      const { error } = await sb
        .from("employee_shift_overrides")
        .upsert(
          { employee_id: employeeId, date: ovrDate, shift_id: shiftId },
          { onConflict: "employee_id,date" },
        );
      if (error) throw error;

      setOvrDate("");
      setOvrShift("");
      await load();
    } catch (error: unknown) {
      setErr(
        error instanceof Error ? error.message : "Failed to save override.",
      );
    } finally {
      setBusy(false);
    }
  };

  const removeOverride = async (date: string) => {
    setBusy(true);
    setErr(null);
    try {
      const sb = getSupabase();
      if (!sb) {
        throw new Error("Supabase not configured");
      }

      const { error } = await sb
        .from("employee_shift_overrides")
        .delete()
        .eq("employee_id", employeeId)
        .eq("date", date);
      if (error) throw error;
      await load();
    } catch (error: unknown) {
      setErr(
        error instanceof Error ? error.message : "Failed to remove override.",
      );
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

      {err && <div className="mb-3 text-sm text-danger">Error: {err}</div>}

      {/* Weekly Map */}
      <div className="border border-border rounded p-3 mb-6">
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
            className="border border-border rounded px-2 py-1 bg-background text-foreground"
            value={ovrDate}
            onChange={(e) => setOvrDate(e.target.value)}
          />
          <select
            className="border border-border rounded px-2 py-1 bg-background text-foreground"
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
            className="bg-success text-success-foreground rounded px-3 py-1"
            onClick={saveOverride}
            disabled={busy || !ovrDate}
          >
            Save Override
          </button>
        </div>

        {overrides.length === 0 ? (
          <div className="text-sm text-muted-foreground">No overrides</div>
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
