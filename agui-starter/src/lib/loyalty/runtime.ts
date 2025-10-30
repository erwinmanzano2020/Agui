// Loyalty enrollment helpers with no schema libraries at module scope.

const ALLOWED_CHANNELS = ["kiosk", "cashier", "self-service"] as const;
const ALLOWED_PLANS = ["basic", "premium"] as const;

export const LOYALTY_CHANNELS = ALLOWED_CHANNELS;
export const LOYALTY_PLANS = ALLOWED_PLANS;

export type EnrollMemberInput = {
  memberId?: string;
  phone?: string;
  channel?: (typeof ALLOWED_CHANNELS)[number];
  plan?: (typeof ALLOWED_PLANS)[number];
  dryRun?: boolean;
};

export type EnrollMemberResult = {
  ok: true;
  enrolled: {
    by: string;
    plan: string;
    identifier: string;
    dryRun: boolean;
  };
};

export async function enrollMember(input: EnrollMemberInput): Promise<EnrollMemberResult> {
  const identifier = input.memberId || input.phone || "";
  const by = input.channel ?? "unspecified";
  const plan = input.plan ?? "basic";

  return {
    ok: true,
    enrolled: {
      by,
      plan,
      identifier,
      dryRun: Boolean(input.dryRun),
    },
  };
}

export function allowedChannels() {
  return [...ALLOWED_CHANNELS];
}

export function allowedPlans() {
  return [...ALLOWED_PLANS];
}
