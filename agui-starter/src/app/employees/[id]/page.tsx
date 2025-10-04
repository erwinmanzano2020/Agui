"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

type Shift = {
  id: string;
  code: string;
  name: string;
  start_time?: string;
  end_time?: string;
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
  const params = useParams();
  const employeeId = params?.id as string;

  const [emp, setEmp] = useState<{
    code: string;
    full_name: string;
    rate_per_day: number;
  } | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  // map by day value (1..7)
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
  const [ovrShift, setOvrShift] = useState<string>(""); // '' = Rest Day
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    const empRes = await supabase
      .from("employees")
      .select("code, full_name, rate_per_day")
      .eq("id", employeeId)
      .maybeSingle();
    setEmp(empRes.data ?? null);

    const shiftRes = await supabase
      .from("shifts")
      .select("id, code, name, start_time, end_time")
      .order("start_time", { ascending: true });
    setShifts(shiftRes.data ?? []);

    const weekRes = await supabase
      .from("employee_shift_weekly")
      .select("day_of_week, shift_id")
      .eq("employee_id", employeeId);
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
    const ov = (ovrRes.data ?? []).map((r: any) => ({
      date: r.date,
      shift_name: r.shifts?.name ?? null,
    }));
    setOverrides(ov);
  };

  useEffect(() => {
    if (employeeId) load();
  }, [employeeId]);

  const saveDay = async (dayValue: number, shiftId: string | null) => {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("employee_shift_weekly").upsert(
      {
        employee_id: employeeId,
        day_of_week: dayValue, // 1..7; 7 = Sunday
        shift_id: shiftId,
      },
      { onConflict: "employee_id,day_of_week" },
    );
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  };

  const saveOverride = async () => {
    if (!ovrDate) return;
    setBusy(true);
    setErr(null);
    const shiftId = ovrShift || null; // '' means Rest Day
    const { error } = await supabase.from("employee_shift_overrides").upsert(
      {
        employee_id: employeeId,
        date: ovrDate,
        shift_id: shiftId,
      },
      { onConflict: "employee_id,date" },
    );
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setOvrDate("");
    setOvrShift("");
    await load();
  };

  const removeOverride = async (date: string) => {
    setBusy(true);
    setErr(null);
    const { error } = await supabase
      .from("employee_shift_overrides")
      .delete()
      .eq("employee_id", employeeId)
      .eq("date", date);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Schedule</h1>

      {!emp ? (
        <div>Loading employee…</div>
      ) : (
        <div className="border rounded p-3 mb-6">
          <div className="text-sm">
            Code: <b>{emp.code}</b>
          </div>
          <div className="text-sm">
            Name: <b>{emp.full_name}</b>
          </div>
          <div className="text-sm">
            Rate/Day: <b>₱{Number(emp.rate_per_day).toFixed(2)}</b>
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
                    {s.name}{" "}
                    {s.start_time && s.end_time
                      ? `(${s.start_time}–${s.end_time})`
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
            disabled={busy}
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
