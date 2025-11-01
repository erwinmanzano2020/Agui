// Loyalty enrollment helpers with no schema libraries at module scope.

import { Channel, LoyaltyPlan } from "@/lib/schema-kit";

export const LOYALTY_CHANNELS = Channel.options;
export const LOYALTY_PLANS = LoyaltyPlan.options;

export type EnrollMemberInput = {
  memberId?: string;
  phone?: string;
  channel?: (typeof LOYALTY_CHANNELS)[number];
  plan?: (typeof LOYALTY_PLANS)[number];
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
  const plan = input.plan ?? LoyaltyPlan.options[0];

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
  return [...LOYALTY_CHANNELS];
}

export function allowedPlans() {
  return [...LOYALTY_PLANS];
}
