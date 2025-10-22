// agui-starter/src/lib/types/status.ts
export type StatusHudQuestSnapshot = {
  id: string;
  title: string;
  description?: string;
  xpReward: number;
  coinReward: number;
  completed: boolean;
};

export type StatusHudUserSnapshot = {
  id: string;
  displayName: string;
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  coins: number;
  streak: number;
};

export type StatusHudSnapshot = {
  user: StatusHudUserSnapshot;
  quests: StatusHudQuestSnapshot[];
};

export type StatusHudApiResponse =
  | { ok: true; data: StatusHudSnapshot }
  | { ok: false; error: string };
