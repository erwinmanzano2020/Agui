import { supabase } from "./supabase";

export async function getUserStats(userId: string) {
  const { data, error } = await supabase.from("user_stats").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data || { user_id: userId, level: 1, xp: 0, coins: 0, streak: 0 };
}

export async function getDailyQuests(userId: string) {
  const { data, error } = await supabase
    .from("user_quests")
    .select("quest_code, completed, day, quests(title, xp_reward, coin_reward)")
    .eq("user_id", userId)
    .eq("day", new Date().toISOString().slice(0,10));
  if (error) throw error;
  return (data || []).map((r: any) => ({
    code: r.quest_code,
    title: r.quests?.title ?? r.quest_code,
    completed: r.completed,
    xp: r.quests?.xp_reward ?? 0,
    coins: r.quests?.coin_reward ?? 0,
  }));
}

export async function ensureDailyQuests(userId: string) {
  // pick 3 active quests for today if none exist yet
  const today = new Date().toISOString().slice(0,10);
  const { count } = await supabase
    .from("user_quests")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("day", today);
  if ((count ?? 0) > 0) return;

  const { data: q } = await supabase.from("quests").select("code").eq("active", true).limit(3);
  const rows = (q || []).map((x) => ({ user_id: userId, quest_code: x.code, day: today }));
  if (rows.length) await supabase.from("user_quests").insert(rows);
}

export async function completeQuest(userId: string, questCode: string) {
  const today = new Date().toISOString().slice(0,10);
  const { data: quest, error: errQ } = await supabase.from("quests").select("xp_reward, coin_reward").eq("code", questCode).maybeSingle();
  if (errQ) throw errQ;
  const xp = quest?.xp_reward ?? 0, coins = quest?.coin_reward ?? 0;

  const { error: errUQ } = await supabase
    .from("user_quests")
    .upsert({ user_id: userId, quest_code: questCode, day: today, completed: true, completed_at: today },
            { onConflict: "user_id,quest_code,day" });
  if (errUQ) throw errUQ;

  const { error: errRw } = await supabase.rpc("grant_rewards", { p_user: userId, p_xp: xp, p_coins: coins });
  if (errRw) throw errRw;

  return { xp, coins };
}
