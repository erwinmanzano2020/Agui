// agui-starter/src/lib/status-hud-store.ts
import type {
  StatusHudQuestSnapshot,
  StatusHudSnapshot,
} from "@/lib/types/status";

const XP_PER_LEVEL = 500;

export type InternalQuest = StatusHudQuestSnapshot;

export type InternalUserState = {
  id: string;
  displayName: string;
  xp: number;
  coins: number;
  streak: number;
  quests: InternalQuest[];
};

export type StatusHudState = {
  xpPerLevel: number;
  users: Record<string, InternalUserState>;
};

const DEFAULT_STATE: StatusHudState = {
  xpPerLevel: XP_PER_LEVEL,
  users: {
    "demo-user": {
      id: "demo-user",
      displayName: "Kai Rivera",
      xp: 830,
      coins: 240,
      streak: 4,
      quests: [
        {
          id: "daily-check-in",
          title: "Daily Check-in",
          description: "Open Agui and review today\'s shift board.",
          xpReward: 120,
          coinReward: 15,
          completed: true,
        },
        {
          id: "daily-review-logs",
          title: "Review attendance logs",
          description: "Scan at least three attendance alerts.",
          xpReward: 200,
          coinReward: 25,
          completed: false,
        },
        {
          id: "daily-share-feedback",
          title: "Share feedback",
          description: "Send a quick update to the team chat.",
          xpReward: 180,
          coinReward: 20,
          completed: false,
        },
      ],
    },
  },
};

function cloneState(state: StatusHudState): StatusHudState {
  if (typeof structuredClone === "function") {
    return structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state));
}

function getStore(): StatusHudState {
  const g = globalThis as typeof globalThis & { __aguiStatusState__?: StatusHudState };
  if (!g.__aguiStatusState__) {
    g.__aguiStatusState__ = cloneState(DEFAULT_STATE);
  }
  return g.__aguiStatusState__;
}

export function resetStatusHudState() {
  const g = globalThis as typeof globalThis & { __aguiStatusState__?: StatusHudState };
  g.__aguiStatusState__ = cloneState(DEFAULT_STATE);
}

export function getActiveUserId(): string {
  return process.env.NEXT_PUBLIC_AGUI_STATUS_USER_ID ?? "demo-user";
}

function toSnapshot(user: InternalUserState, xpPerLevel: number): StatusHudSnapshot {
  const safePerLevel = xpPerLevel > 0 ? xpPerLevel : XP_PER_LEVEL;
  const computedLevel = Math.floor(user.xp / safePerLevel) + 1;
  const level = computedLevel < 1 ? 1 : computedLevel;
  const xpIntoLevelRaw = user.xp - safePerLevel * (level - 1);
  const xpIntoLevel = Math.max(0, Math.min(xpIntoLevelRaw, safePerLevel));

  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      level,
      xp: user.xp,
      xpIntoLevel,
      xpForNextLevel: safePerLevel,
      coins: user.coins,
      streak: user.streak,
    },
    quests: user.quests.map((quest) => ({ ...quest })),
  };
}

export function getStatusSnapshotForUser(userId: string): StatusHudSnapshot | null {
  const store = getStore();
  const user = store.users[userId];
  if (!user) return null;
  return toSnapshot(user, store.xpPerLevel);
}

export function completeQuestForUser(
  userId: string,
  questId: string
): { ok: true; data: StatusHudSnapshot } | { ok: false; error: string } {
  const store = getStore();
  const user = store.users[userId];
  if (!user) return { ok: false, error: "User not found" };

  const quest = user.quests.find((q) => q.id === questId);
  if (!quest) return { ok: false, error: "Quest not found" };
  if (quest.completed) {
    return { ok: false, error: "Quest already completed" };
  }

  quest.completed = true;
  user.xp += quest.xpReward;
  user.coins += quest.coinReward;

  return { ok: true, data: toSnapshot(user, store.xpPerLevel) };
}
