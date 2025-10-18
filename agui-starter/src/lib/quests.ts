// agui-starter/src/lib/quests.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

export type Quest = {
  code: string;
  title?: string;
  description?: string;
};

export type DailyQuestRow = {
  user_id: string;
  quest_code: string;
  day: string; // YYYY-MM-DD
};

/** Internal: get the singleton client or throw (server) / fail gracefully (client). */
function supabaseOrThrow(): SupabaseClient {
  const client = getSupabase();
  if (!client) {
    // In browser, getSupabase() can return null if env is missing.
    throw new Error("Supabase client not available (check env vars).");
  }
  return client;
}

/**
 * Insert daily quest logs for a user.
 * Adjust the table name if yours differs.
 */
export async function insertDailyQuests(
  userId: string,
  questCodes: string[],
  dayISO: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows: DailyQuestRow[] = questCodes.map((code) => ({
    user_id: userId,
    quest_code: code,
    day: dayISO,
  }));

  try {
    const supabase = supabaseOrThrow();
    const { error } = await supabase.from("user_quest_daily").insert(rows);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Fetch today’s quests for a user.
 */
export async function fetchDailyQuests(
  userId: string,
  dayISO: string
): Promise<{ ok: true; data: DailyQuestRow[] } | { ok: false; error: string }> {
  try {
    const supabase = supabaseOrThrow();
    const { data, error } = await supabase
      .from("user_quest_daily")
      .select("*")
      .eq("user_id", userId)
      .eq("day", dayISO);

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data as DailyQuestRow[]) ?? [] };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
