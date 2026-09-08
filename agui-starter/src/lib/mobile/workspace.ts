export type AguiMobileLaunchMode = "telegram" | "direct";

export type AguiMobileActionStatus = "available" | "next" | "planned";

export type AguiMobileAction = {
  key: string;
  label: string;
  description: string;
  href: string | null;
  emoji: string;
  status: AguiMobileActionStatus;
  launchModes: readonly AguiMobileLaunchMode[];
};

const BOTH_LAUNCH_MODES: readonly AguiMobileLaunchMode[] = ["telegram", "direct"];

export const CASHIER_MOBILE_ACTIONS: readonly AguiMobileAction[] = [
  {
    key: "start-shift",
    label: "Start / Resume Shift",
    description: "Open or resume your assigned cashier box.",
    href: "/mini/cashier/start",
    emoji: "▶️",
    status: "available",
    launchModes: BOTH_LAUNCH_MODES,
  },
  {
    key: "customer-utang",
    label: "Customer Utang",
    description: "Record customer credit from one compact form.",
    href: null,
    emoji: "🧾",
    status: "next",
    launchModes: BOTH_LAUNCH_MODES,
  },
  {
    key: "collection",
    label: "Bayad Utang",
    description: "Record customer A/R collections and payment details.",
    href: null,
    emoji: "💰",
    status: "planned",
    launchModes: BOTH_LAUNCH_MODES,
  },
  {
    key: "cash-out",
    label: "Cash Out",
    description: "Business expense, supplier, parcel/COD, owner/family and other drawer cash-out flows.",
    href: null,
    emoji: "💸",
    status: "planned",
    launchModes: BOTH_LAUNCH_MODES,
  },
  {
    key: "cash-transfer",
    label: "Cash Transfer",
    description: "Record controlled cash movement between authorized custody points.",
    href: null,
    emoji: "🔄",
    status: "planned",
    launchModes: BOTH_LAUNCH_MODES,
  },
  {
    key: "cash-drop",
    label: "Cash Drop",
    description: "Secure cash into the branch Drop Vault with physical custody controls.",
    href: null,
    emoji: "🔐",
    status: "planned",
    launchModes: BOTH_LAUNCH_MODES,
  },
  {
    key: "end-shift",
    label: "End Shift",
    description: "Complete the proven blind closing and sealed Final Drop workflow.",
    href: "/mini/cashier/closing",
    emoji: "🏁",
    status: "available",
    launchModes: ["telegram"],
  },
] as const;

export function isMobileActionAvailable(action: AguiMobileAction, launchMode: AguiMobileLaunchMode) {
  return action.status === "available" && Boolean(action.href) && action.launchModes.includes(launchMode);
}

export function availableMobileActions(
  actions: readonly AguiMobileAction[] = CASHIER_MOBILE_ACTIONS,
  launchMode?: AguiMobileLaunchMode,
) {
  return actions.filter(
    (action) =>
      action.status === "available" &&
      action.href &&
      (!launchMode || action.launchModes.includes(launchMode)),
  );
}

export function nextMobileAction(actions: readonly AguiMobileAction[] = CASHIER_MOBILE_ACTIONS) {
  return actions.find((action) => action.status === "next") ?? null;
}
