"use client";
import { useEffect, useMemo, useState } from "react";
import { getDailyQuests, getUserStats, ensureDailyQuests, completeQuest } from "../../lib/quests";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"; // if you use this helper; otherwise use your supabase client

export function StatusHUD() {
  const supabase = createClientComponentClient(); // or import your existing client
  const [userId, setUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [quests, setQuests] = useState<Array<{code: string; title: string; completed: boolean; xp: number; coins: number}>>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await ensureDailyQuests(user.id);
      const [s, q] = await Promise.all([getUserStats(user.id), getDailyQuests(user.id)]);
      setStats(s); setQuests(q);
    })();
  }, []);

  if (!userId || !stats) {
    return <div className="bg-card rounded-2xl p-4 shadow-soft border border-border">Loading HUD…</div>;
  }

  const pct = useMemo(() => Math.min(100, Math.round((stats.xp / 400) * 100)), [stats.xp]);

  return (
    <div className="bg-card text-card-foreground rounded-2xl p-4 shadow-soft border border-border w-full">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <div className="font-semibold text-lg">Agui Operator</div>
          <div className="text-xs text-muted-foreground">Lv. {stats.level} • {stats.xp}/400 XP</div>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold">🪙 {stats.coins.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">🔥 Streak {stats.streak}</div>
        </div>
      </div>

      <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-success transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {quests.map((q) => (
          <button
            key={q.code}
            onClick={async () => {
              if (q.completed) return;
              await completeQuest(userId, q.code);
              const [s2, q2] = await Promise.all([getUserStats(userId), getDailyQuests(userId)]);
              setStats(s2); setQuests(q2);
            }}
            className={`rounded-xl px-3 py-2 text-xs border text-left
              ${q.completed ? "bg-success/10 border-success/30 text-success" : "bg-muted border-border text-muted-foreground hover:bg-muted/80"}`}
          >
            {q.completed ? "✓ " : "• "} {q.title}
          </button>
        ))}
      </div>
    </div>
  );
}
