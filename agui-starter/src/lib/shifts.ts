import { getSupabase } from "@/lib/supabase";

export type EffectiveShift = {
  shift_id: string | null;
  name: string | null;
  start_time: string | null;
  end_time: string | null;
  ot_grace_min: number | null;
  standard_minutes: number | null; // NEW
};

type ShiftRow = {
  shift_id: string | null;
  shifts: {
    name: string | null;
    start_time: string | null;
    end_time: string | null;
    ot_grace_min: number | null;
    standard_minutes: number | null;
  } | null;
};

function toEffective(row: ShiftRow | null): EffectiveShift {
  const details = row?.shifts;
  return {
    shift_id: row?.shift_id ?? null,
    name: details?.name ?? null,
    start_time: details?.start_time ?? null,
    end_time: details?.end_time ?? null,
    ot_grace_min: details?.ot_grace_min ?? null,
    standard_minutes: details?.standard_minutes ?? null,
  };
}

function emptyShift(): EffectiveShift {
  return {
    shift_id: null,
    name: null,
    start_time: null,
    end_time: null,
    ot_grace_min: null,
    standard_minutes: null,
  };
}

export async function resolveEffectiveShift(
  employeeId: string,
  date: string,
): Promise<EffectiveShift> {
  const sb = getSupabase();
  if (!sb) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "Supabase client not available when resolving effective shift. Returning empty shift.",
      );
    }
    return emptyShift();
  }

  // 1) Override first
  const { data: overrideRow, error: overrideError } = await sb
    .from("employee_shift_overrides")
    .select(
      `
      shift_id,
      shifts:shift_id (name, start_time, end_time, ot_grace_min, standard_minutes)
    `,
    )
    .eq("employee_id", employeeId)
    .eq("date", date)
    .maybeSingle<ShiftRow>();

  if (overrideError) {
    console.warn("Failed to load shift override", overrideError);
  }

  if (overrideRow) {
    return toEffective(overrideRow);
  }

  // 2) Fallback to weekly (DB expects 1..7 with 7=Sun)
  const jsDow = new Date(date).getDay(); // 0..6
  const dbDow = jsDow === 0 ? 7 : jsDow; // 7..6,1..6

  const { data: weeklyRow, error: weeklyError } = await sb
    .from("employee_shift_weekly")
    .select(
      `
      shift_id,
      shifts:shift_id (name, start_time, end_time, ot_grace_min, standard_minutes)
    `,
    )
    .eq("employee_id", employeeId)
    .eq("day_of_week", dbDow)
    .maybeSingle<ShiftRow>();

  if (weeklyError) {
    console.warn("Failed to load weekly shift", weeklyError);
  }

  if (weeklyRow) {
    return toEffective(weeklyRow);
  }

  return emptyShift();
}
