export type TenderType =
  | "CASH"
  | "GCASH"
  | "MAYA"
  | "CHECK"
  | "BANK_TRANSFER"
  | "LOYALTY";

export type BaseTenderMetadata = Record<string, unknown>;

export type CashTenderMetadata = BaseTenderMetadata & {
  change?: number | null;
};

export type EWalletTenderMetadata = BaseTenderMetadata & {
  reference: string;
  provider: "GCash" | "Maya";
  note?: string | null;
};

export type CheckTenderMetadata = BaseTenderMetadata & {
  bankName: string;
  checkNumber: string;
  checkDate: string;
  note?: string | null;
};

export type BankTransferTenderMetadata = BaseTenderMetadata & {
  bankName: string;
  reference: string;
  transferDate: string;
};

export type LoyaltyTenderMetadata = BaseTenderMetadata & {
  pointsRedeemed: number;
  remainingPoints?: number | null;
  conversionRate: number;
};

export type TenderMetadata =
  | CashTenderMetadata
  | EWalletTenderMetadata
  | CheckTenderMetadata
  | BankTransferTenderMetadata
  | LoyaltyTenderMetadata
  | BaseTenderMetadata
  | null
  | undefined;

export type TenderLine = {
  type: TenderType;
  amount: number;
  metadata?: TenderMetadata;
};

export type NormalizedTenderLine = {
  type: TenderType;
  amount: number;
  metadata: TenderMetadata | null;
};

export type TenderValidationOptions = {
  amountDue: number;
  tenders: TenderLine[];
  allowChange?: boolean;
  loyaltyBalance?: number;
  loyaltyConversionRate?: number;
};

export type TenderValidationResult = {
  amountDue: number;
  totalTendered: number;
  changeDue: number;
  balanceDue: number;
  normalizedTenders: NormalizedTenderLine[];
  breakdown: Record<string, { total: number; count: number }>;
  loyalty?: {
    pointsRedeemed: number;
    conversionRate: number;
    remainingPoints: number | null;
  };
};

function ensureWholeCentavos(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} exceeds safe integer range`);
  }
  return value;
}

function ensureNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} cannot be empty`);
  }
  return trimmed;
}

function ensureIsoDate(value: unknown, label: string): string {
  const str = ensureNonEmptyString(value, label);
  const parsed = new Date(str);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`${label} must be an ISO 8601 date`);
  }
  return parsed.toISOString();
}

function ensurePositiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} exceeds safe integer range`);
  }
  return value;
}

function normalizeCashMetadata(metadata: TenderMetadata | undefined): CashTenderMetadata | null {
  if (!metadata || typeof metadata !== "object") return null;
  const { change } = metadata as { change?: unknown };
  if (change == null) return metadata as CashTenderMetadata;
  return {
    ...(metadata as Record<string, unknown>),
    change: ensureWholeCentavos(change, "cash change"),
  } satisfies CashTenderMetadata;
}

function normalizeEWalletMetadata(
  type: "GCASH" | "MAYA",
  metadata: TenderMetadata | undefined,
): EWalletTenderMetadata {
  if (!metadata || typeof metadata !== "object") {
    throw new Error(`${type} tender requires metadata`);
  }
  const { reference, note } = metadata as { reference?: unknown; note?: unknown };
  return {
    provider: type === "GCASH" ? "GCash" : "Maya",
    reference: ensureNonEmptyString(reference, `${type} reference`),
    note: typeof note === "string" && note.trim() ? note.trim() : null,
  } satisfies EWalletTenderMetadata;
}

function normalizeCheckMetadata(metadata: TenderMetadata | undefined): CheckTenderMetadata {
  if (!metadata || typeof metadata !== "object") {
    throw new Error("CHECK tender requires metadata");
  }
  const { bankName, checkNumber, checkDate, note } = metadata as {
    bankName?: unknown;
    checkNumber?: unknown;
    checkDate?: unknown;
    note?: unknown;
  };
  return {
    bankName: ensureNonEmptyString(bankName, "check bank name"),
    checkNumber: ensureNonEmptyString(checkNumber, "check number"),
    checkDate: ensureIsoDate(checkDate, "check date"),
    note: typeof note === "string" && note.trim() ? note.trim() : null,
  } satisfies CheckTenderMetadata;
}

function normalizeBankTransferMetadata(metadata: TenderMetadata | undefined): BankTransferTenderMetadata {
  if (!metadata || typeof metadata !== "object") {
    throw new Error("BANK_TRANSFER tender requires metadata");
  }
  const { bankName, reference, transferDate } = metadata as {
    bankName?: unknown;
    reference?: unknown;
    transferDate?: unknown;
  };
  return {
    bankName: ensureNonEmptyString(bankName, "bank transfer bank"),
    reference: ensureNonEmptyString(reference, "bank transfer reference"),
    transferDate: ensureIsoDate(transferDate, "bank transfer date"),
  } satisfies BankTransferTenderMetadata;
}

function normalizeLoyaltyMetadata(
  metadata: TenderMetadata | undefined,
  options: { loyaltyBalance?: number; loyaltyConversionRate?: number },
): LoyaltyTenderMetadata {
  if (!metadata || typeof metadata !== "object") {
    throw new Error("LOYALTY tender requires metadata");
  }
  const { pointsRedeemed, remainingPoints, conversionRate } = metadata as {
    pointsRedeemed?: unknown;
    remainingPoints?: unknown;
    conversionRate?: unknown;
  };
  const normalizedConversion = conversionRate == null
    ? options.loyaltyConversionRate ?? 100
    : ensurePositiveInteger(conversionRate, "loyalty conversion rate");

  const points = ensurePositiveInteger(pointsRedeemed, "loyalty points redeemed");
  const remaining =
    remainingPoints == null
      ? null
      : ensureWholeCentavos(remainingPoints, "loyalty remaining points");

  if (options.loyaltyBalance != null && points > options.loyaltyBalance) {
    throw new Error("LOYALTY tender exceeds available points");
  }

  return {
    pointsRedeemed: points,
    conversionRate: normalizedConversion,
    remainingPoints: remaining,
  } satisfies LoyaltyTenderMetadata;
}

function appendBreakdown(
  breakdown: Record<string, { total: number; count: number }>,
  key: string,
  amount: number,
) {
  const entry = breakdown[key] ?? { total: 0, count: 0 };
  entry.total += amount;
  entry.count += 1;
  breakdown[key] = entry;
}

export function validateTenderLines(options: TenderValidationOptions): TenderValidationResult {
  const amountDue = ensureWholeCentavos(options.amountDue, "amount due");
  if (!Array.isArray(options.tenders) || options.tenders.length === 0) {
    throw new Error("At least one tender is required");
  }

  const allowChange = options.allowChange !== false;
  const breakdown: Record<string, { total: number; count: number }> = {};
  const normalizedTenders: NormalizedTenderLine[] = [];

  let totalTendered = 0;
  let cashTotal = 0;
  let loyaltyPointsRedeemed = 0;
  let loyaltyConversionRate = options.loyaltyConversionRate ?? 100;
  let loyaltyRemainingPoints: number | null = null;

  for (const tender of options.tenders) {
    if (!tender || typeof tender !== "object") {
      throw new Error("Invalid tender payload");
    }
    const amount = ensureWholeCentavos(tender.amount, `${tender.type ?? "tender"} amount`);
    const type = tender.type;
    if (!type) {
      throw new Error("Tender type is required");
    }

    let metadata: TenderMetadata | null = null;
    switch (type) {
      case "CASH": {
        metadata = normalizeCashMetadata(tender.metadata);
        cashTotal += amount;
        appendBreakdown(breakdown, "cash", amount);
        break;
      }
      case "GCASH":
      case "MAYA": {
        metadata = normalizeEWalletMetadata(type, tender.metadata);
        appendBreakdown(breakdown, type.toLowerCase(), amount);
        break;
      }
      case "CHECK": {
        metadata = normalizeCheckMetadata(tender.metadata);
        appendBreakdown(breakdown, "check", amount);
        break;
      }
      case "BANK_TRANSFER": {
        metadata = normalizeBankTransferMetadata(tender.metadata);
        appendBreakdown(breakdown, "bank_transfer", amount);
        break;
      }
      case "LOYALTY": {
        const normalized = normalizeLoyaltyMetadata(tender.metadata, options);
        metadata = normalized;
        const expectedValue = normalized.pointsRedeemed * normalized.conversionRate;
        if (amount !== expectedValue) {
          throw new Error("LOYALTY tender amount must match the conversion of redeemed points");
        }
        loyaltyPointsRedeemed += normalized.pointsRedeemed;
        loyaltyConversionRate = normalized.conversionRate;
        loyaltyRemainingPoints =
          normalized.remainingPoints != null ? normalized.remainingPoints : loyaltyRemainingPoints;
        appendBreakdown(breakdown, "loyalty", amount);
        break;
      }
      default:
        throw new Error(`Unsupported tender type: ${type}`);
    }

    totalTendered += amount;
    if (!Number.isSafeInteger(totalTendered)) {
      throw new Error("Tender total exceeds safe integer range");
    }

    normalizedTenders.push({ type, amount, metadata });
  }

  if (totalTendered < amountDue) {
    throw new Error("Total tendered is less than the amount due");
  }

  const overage = totalTendered - amountDue;
  let changeDue = 0;
  if (overage > 0) {
    if (!allowChange) {
      throw new Error("Over tendering is not allowed for this sale");
    }
    if (cashTotal === 0) {
      throw new Error("Non-cash tenders cannot exceed the amount due");
    }
    if (overage > cashTotal) {
      throw new Error("Cash tenders cannot cover the overage amount");
    }
    changeDue = overage;
  }

  const balanceDue = amountDue - (totalTendered - changeDue);
  if (balanceDue < 0) {
    throw new Error("balance due cannot be negative");
  }

  const result: TenderValidationResult = {
    amountDue,
    totalTendered,
    changeDue,
    balanceDue,
    normalizedTenders,
    breakdown,
  };

  if (loyaltyPointsRedeemed > 0) {
    const remaining =
      options.loyaltyBalance != null
        ? Math.max(0, options.loyaltyBalance - loyaltyPointsRedeemed)
        : loyaltyRemainingPoints;
    result.loyalty = {
      pointsRedeemed: loyaltyPointsRedeemed,
      conversionRate: loyaltyConversionRate,
      remainingPoints: remaining ?? null,
    };
  }

  return result;
}

export type SplitParticipant = {
  id: string;
  label?: string;
};

export type SplitShareInput =
  | {
      participantId: string;
      amount: number;
    }
  | {
      participantId: string;
      weight: number;
    };

export type SplitComputation = {
  amountDue: number;
  shares: { participantId: string; amount: number }[];
};

function distributeRemainder(shares: number[], remainder: number): number[] {
  const adjusted = shares.slice();
  let index = 0;
  while (remainder > 0) {
    adjusted[index % adjusted.length] += 1;
    remainder -= 1;
    index += 1;
  }
  return adjusted;
}

export function computeEqualSplit(amountDue: number, participantCount: number): number[] {
  const total = ensureWholeCentavos(amountDue, "amount due");
  const count = ensurePositiveInteger(participantCount, "participant count");
  const baseShare = Math.floor(total / count);
  const remainder = total % count;
  const shares = new Array<number>(count).fill(baseShare);
  if (remainder > 0) {
    return distributeRemainder(shares, remainder);
  }
  return shares;
}

function ensureParticipantIds(participants: SplitParticipant[]): string[] {
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error("At least one participant is required to split a sale");
  }
  return participants.map((participant, index) => {
    if (!participant || typeof participant !== "object") {
      throw new Error(`Participant ${index} is invalid`);
    }
    return ensureNonEmptyString(participant.id, `participant ${index} id`);
  });
}

export function computeSplit({
  amountDue,
  participants,
  shares,
}: {
  amountDue: number;
  participants: SplitParticipant[];
  shares?: SplitShareInput[];
}): SplitComputation {
  const total = ensureWholeCentavos(amountDue, "amount due");
  const ids = ensureParticipantIds(participants);
  if (!shares || shares.length === 0) {
    const equalShares = computeEqualSplit(total, ids.length);
    return {
      amountDue: total,
      shares: ids.map((id, index) => ({ participantId: id, amount: equalShares[index] })),
    };
  }

  const explicitAmounts = shares.every((share) => "amount" in share);
  if (explicitAmounts) {
    const amounts = shares.map((share, index) =>
      ensureWholeCentavos((share as { amount: number }).amount, `share ${index} amount`),
    );
    const totalAmount = amounts.reduce((acc, value) => acc + value, 0);
    if (totalAmount !== total) {
      throw new Error("Split amounts must add up to the amount due");
    }
    return {
      amountDue: total,
      shares: ids.map((id, index) => ({ participantId: id, amount: amounts[index] ?? 0 })),
    };
  }

  const weights = shares.map((share, index) => {
    if (!("weight" in share)) {
      throw new Error(`share ${index} is missing a weight`);
    }
    return ensurePositiveInteger((share as { weight: number }).weight, `share ${index} weight`);
  });
  const weightTotal = weights.reduce((acc, value) => acc + value, 0);
  if (weightTotal <= 0) {
    throw new Error("Split weights must add up to a positive number");
  }

  const rawShares = weights.map((weight) => Math.floor((total * weight) / weightTotal));
  const allocated = rawShares.reduce((acc, value) => acc + value, 0);
  const remainder = total - allocated;
  const finalShares = remainder > 0 ? distributeRemainder(rawShares, remainder) : rawShares;

  return {
    amountDue: total,
    shares: ids.map((id, index) => ({ participantId: id, amount: finalShares[index] ?? 0 })),
  };
}

export function isNonCashTender(type: TenderType): boolean {
  return type !== "CASH";
}

export type ManifestAggregation = {
  cash: { total: number; count: number };
  ewallets: Record<string, { total: number; count: number }>;
  checks: { total: number; count: number };
  bankTransfers: { total: number; count: number };
  loyalty: { value: number; points: number };
  nonCashTotal: number;
};

export function aggregateManifest(tenders: NormalizedTenderLine[]): ManifestAggregation {
  const summary: ManifestAggregation = {
    cash: { total: 0, count: 0 },
    ewallets: {},
    checks: { total: 0, count: 0 },
    bankTransfers: { total: 0, count: 0 },
    loyalty: { value: 0, points: 0 },
    nonCashTotal: 0,
  };

  for (const tender of tenders) {
    switch (tender.type) {
      case "CASH": {
        summary.cash.total += tender.amount;
        summary.cash.count += 1;
        break;
      }
      case "GCASH":
      case "MAYA": {
        const provider = tender.type === "GCASH" ? "GCash" : "Maya";
        const current = summary.ewallets[provider] ?? { total: 0, count: 0 };
        current.total += tender.amount;
        current.count += 1;
        summary.ewallets[provider] = current;
        summary.nonCashTotal += tender.amount;
        break;
      }
      case "CHECK": {
        summary.checks.total += tender.amount;
        summary.checks.count += 1;
        summary.nonCashTotal += tender.amount;
        break;
      }
      case "BANK_TRANSFER": {
        summary.bankTransfers.total += tender.amount;
        summary.bankTransfers.count += 1;
        summary.nonCashTotal += tender.amount;
        break;
      }
      case "LOYALTY": {
        summary.loyalty.value += tender.amount;
        const metadata = tender.metadata as LoyaltyTenderMetadata | null;
        if (metadata) {
          summary.loyalty.points += metadata.pointsRedeemed;
        }
        summary.nonCashTotal += tender.amount;
        break;
      }
      default:
        break;
    }
  }

  return summary;
}
