// agui-starter/src/components/ui/status-hud.tsx
import React from "react";

export type StatusHudProps = {
  displayName?: string;
  level?: number;
  xp?: number;          // 0–100
  streakDays?: number;
  className?: string;
};

export function StatusHud({
  displayName = "Adventurer",
  level = 1,
  xp = 0,
  streakDays = 0,
  className = "",
}: StatusHudProps) {
  const xpClamped = Math.max(0, Math.min(100, xp));

  return (
    <div
      className={[
        "rounded-2xl border p-4 bg-background/60 backdrop-blur-sm shadow-sm",
        className,
      ].join(" ")}
      role="status"
      aria-label="Player status"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Welcome back</div>
          <div className="text-lg font-semibold">{displayName}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Level</div>
          <div className="text-2xl font-bold leading-none">{level}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>XP</span>
          <span>{xpClamped}%</span>
        </div>
        <div className="mt-1 h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${xpClamped}%` }}
          />
        </div>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        🔥 Streak: <span className="font-medium text-foreground">{streakDays}</span> day
        {streakDays === 1 ? "" : "s"}
      </div>
    </div>
  );
}
