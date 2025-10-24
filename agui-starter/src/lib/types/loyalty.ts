export type LoyaltyScope = "ALLIANCE" | "GUILD" | "HOUSE";
export type LoyaltyProfile = {
  id: string;
  scheme_id: string;
  entity_id: string;
  points: number;
  tier: string | null;
  account_no: string | null;
  meta: Record<string, unknown>;
};
