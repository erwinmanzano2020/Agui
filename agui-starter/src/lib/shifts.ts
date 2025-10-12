import { getSupabase } from "@/lib/supabase";

export type EffectiveShift = {
  shift_id: string | null;
  name: string | null;
  start_time: string | null;
  end_time: string | null;
  ot_grace_min: number | null;
  standard_minutes: number | null; // NEW
};

export async function resolveEffectiveShift(
  employeeId: string,
  date: string,
): Promise<EffectiveShift> {
  const sb = getSupabase();
  if (!sb) {
    throw new Error("Supabase not configured");
  }

  // 1) Override first
  const ovrRes = await sb
    .from("employee_shift_overrides")
    .select(
      `
      shift_id,
      shifts:shift_id (name, start_time, end_time, ot_grace_min, standard_minutes)
    `,
    )
    .eq("employee_id", employeeId)
    .eq("date", date)
    .maybeSingle();

  if (ovrRes.data) {
    const s = (ovrRes.data as any).shifts;
    return {
      shift_id: (ovrRes.data as any).shift_id ?? null,
      name: s?.name ?? null,
      start_time: s?.start_time ?? null,
      end_time: s?.end_time ?? null,
      ot_grace_min: s?.ot_grace_min ?? null,
      standard_minutes: s?.standard_minutes ?? null,
    };
  }

  // 2) Fallback to weekly (DB expects 1..7 with 7=Sun)
  const jsDow = new Date(date).getDay(); // 0..6
  const dbDow = jsDow === 0 ? 7 : jsDow; // 7..6,1..6

  const weekRes = await sb
    .from("employee_shift_weekly")
    .select(
      `
      shift_id,
      shifts:shift_id (name, start_time, end_time, ot_grace_min, standard_minutes)
    `,
    )
    .eq("employee_id", employeeId)
    .eq("day_of_week", dbDow)
    .maybeSingle();

  if (weekRes.data) {
    const s = (weekRes.data as any).shifts;
    return {
      shift_id: (weekRes.data as any).shift_id ?? null,
      name: s?.name ?? null,
      start_time: s?.start_time ?? null,
      end_time: s?.end_time ?? null,
      ot_grace_min: s?.ot_grace_min ?? null,
      standard_minutes: s?.standard_minutes ?? null,
    };
  }

  return {
    shift_id: null,
    name: null,
    start_time: null,
    end_time: null,
    ot_grace_min: null,
    standard_minutes: null,
  };
}
