import type { CardStatus, CardTokenKind } from "@/lib/passes/cards";
import type { LoyaltyScope } from "@/lib/loyalty/rules";

export type LinkedCardSnapshot = {
  cardId: string;
  cardNo: string;
  schemeId: string;
  schemeName: string;
  scope: LoyaltyScope;
  precedence: number;
  incognitoDefault: boolean;
};

export type LoyaltyAccountSnapshot = {
  accountNo: string;
  points: number;
  tier: string | null;
};

export type ClockScanResolution = {
  tokenId: string;
  tokenKind: CardTokenKind;
  tokenExpiresAt: string | null;
  cardId: string;
  cardNo: string;
  cardStatus: CardStatus;
  schemeId: string;
  schemeName: string;
  schemeScope: LoyaltyScope;
  schemePrecedence: number;
  schemeAllowIncognito: boolean;
  entityId: string;
  entityName: string;
  incognitoDefault: boolean;
  incognitoActive: boolean;
  incognitoOverrideReason: string | null;
  higherCard: LinkedCardSnapshot | null;
  linkedCards: LinkedCardSnapshot[];
  loyaltyAccount: LoyaltyAccountSnapshot | null;
  guildRoles: string[];
  houseRoles: string[];
};

export type ClockScanEvent = {
  reason: string;
  liftedIncognito: boolean;
  recordedAt: string;
};

export type ClockScanStatus = "idle" | "resolved" | "needs-override" | "error";

export type ClockScanState = {
  status: ClockScanStatus;
  message: string | null;
  resolution: ClockScanResolution | null;
  event: ClockScanEvent | null;
};

export const INITIAL_CLOCK_SCAN_STATE: ClockScanState = {
  status: "idle",
  message: null,
  resolution: null,
  event: null,
};
