// agui-starter/src/components/ui/status-hud.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import type {
  StatusHudApiResponse,
  StatusHudQuestSnapshot,
  StatusHudSnapshot,
} from "@/lib/types/status";

export type StatusHudProps = {
  className?: string;
};

type FetchError = { message: string };

async function requestStatus(): Promise<StatusHudSnapshot> {
  const res = await fetch("/api/status", { cache: "no-store" });
  const json = (await res.json()) as StatusHudApiResponse;

  if (!res.ok || !json.ok) {
    throw new Error(json.ok ? `Request failed (${res.status})` : json.error);
  }

  return json.data;
}

async function completeQuest(questId: string): Promise<StatusHudSnapshot> {
  const res = await fetch(`/api/status/quests/${questId}/complete`, {
    method: "POST",
  });
  const json = (await res.json()) as StatusHudApiResponse;

  if (!res.ok || !json.ok) {
    throw new Error(json.ok ? `Request failed (${res.status})` : json.error);
  }

  return json.data;
}

export function StatusHud({ className }: StatusHudProps) {
  const [snapshot, setSnapshot] = useState<StatusHudSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [pendingQuestId, setPendingQuestId] = useState<string | null>(null);
  const toast = useToast();

  const fetchStatus = useCallback(() => requestStatus(), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchStatus()
      .then((data) => {
        if (!active) return;
        setSnapshot(data);
      })
      .catch((err) => {
        if (!active) return;
        setError({
          message:
            err instanceof Error ? err.message : "Failed to load player status",
        });
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [fetchStatus]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchStatus()
      .then((data) => {
        setSnapshot(data);
      })
      .catch((err) => {
        setError({
          message:
            err instanceof Error ? err.message : "Failed to load player status",
        });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fetchStatus]);

  const handleQuestClick = useCallback(
    async (quest: StatusHudQuestSnapshot) => {
      if (quest.completed || pendingQuestId) return;

      setPendingQuestId(quest.id);
      try {
        const data = await completeQuest(quest.id);
        setSnapshot(data);
        toast.success(`Quest complete! +${quest.xpReward} XP · +${quest.coinReward} coins.`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to complete quest"
        );
      } finally {
        setPendingQuestId(null);
      }
    },
    [pendingQuestId, toast]
  );

  const xpPercent = useMemo(() => {
    if (!snapshot) return 0;
    const denom = Math.max(1, snapshot.user.xpForNextLevel);
    const raw = Math.round((snapshot.user.xpIntoLevel / denom) * 100);
    return Math.max(0, Math.min(100, raw));
  }, [snapshot]);

  if (loading) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-border bg-card/70 p-6 shadow-soft",
          "animate-pulse",
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 rounded-full bg-muted" />
          <div className="h-8 w-16 rounded-md bg-muted" />
        </div>
        <div className="mt-6 h-3 w-full rounded-full bg-muted" />
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-14 rounded-xl bg-muted" />
          ))}
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-16 rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card/70 p-6 shadow-soft backdrop-blur",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {error && (
        <div className="space-y-4">
          <div className="text-sm text-danger">
            Failed to load your status: <span className="font-medium">{error.message}</span>
          </div>
          <Button onClick={handleRetry} size="sm" variant="outline">
            Try again
          </Button>
        </div>
      )}

      {!error && snapshot && (
        <div className="space-y-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Welcome back
              </p>
              <h2 className="text-xl font-semibold text-foreground">
                {snapshot.user.displayName}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              <StatTile label="Level" value={snapshot.user.level.toString()} />
              <StatTile
                label="XP"
                value={`${snapshot.user.xpIntoLevel} / ${snapshot.user.xpForNextLevel}`}
              />
              <StatTile label="Coins" value={snapshot.user.coins.toString()} />
              <StatTile label="Streak" value={`${snapshot.user.streak} days`} />
            </div>
          </header>

          <section>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress to next level</span>
              <span>{xpPercent}%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Daily quests</h3>
              <span className="text-xs text-muted-foreground">
                {snapshot.quests.filter((q) => q.completed).length} / {snapshot.quests.length} completed
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {snapshot.quests.map((quest) => {
                const disabled = quest.completed || pendingQuestId !== null;
                const isActive = pendingQuestId === quest.id;
                return (
                  <button
                    key={quest.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleQuestClick(quest)}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                      quest.completed
                        ? "border-emerald-200/70 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100"
                        : "border-border/60 bg-card hover:border-primary/60 hover:bg-primary/5",
                      disabled && !quest.completed && "cursor-not-allowed opacity-70"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{quest.title}</p>
                        {quest.description && (
                          <p className="text-xs text-muted-foreground">{quest.description}</p>
                        )}
                        <p className="text-xs font-medium text-muted-foreground">
                          Rewards: +{quest.xpReward} XP · +{quest.coinReward} coins
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-xs font-medium">
                        {quest.completed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600 dark:text-emerald-300">
                            ✓ Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-muted-foreground">
                            Tap to complete
                          </span>
                        )}
                        {!quest.completed && isActive && (
                          <span className="inline-flex items-center gap-2 text-muted-foreground">
                            <span className="h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
                            Updating…
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

type StatTileProps = { label: string; value: string };

function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-left shadow-sm">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
