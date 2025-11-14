import { aggregateManifest, type NormalizedTenderLine, type TenderMetadata, type TenderType } from "@/lib/pos/tenders";

type SaleLineSnapshot = {
  id: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  description?: string | null;
};

type SaleSnapshot = {
  saleId: string;
  lines: SaleLineSnapshot[];
  tenders: NormalizedTenderLine[];
  manifest?: ReturnManifestSnapshot;
};

type ReturnManifestSnapshot = {
  nonCashTotals?: {
    ewallets: Record<string, { total: number; count: number }>;
    checks: { total: number; count: number };
    bankTransfers: { total: number; count: number };
    loyalty: { value: number; points: number };
  };
};

type ReturnLineSelection = {
  lineId: string;
  quantity: number;
  reason?: string;
};

type ReturnComputationOptions = {
  sale: SaleSnapshot;
  selections: ReturnLineSelection[];
  exchangeAmount?: number;
  loyaltyConversionRate?: number;
};

type ReturnLineAdjustment = {
  lineId: string;
  quantity: number;
  value: number;
  reason?: string;
};

type TenderReversal = NormalizedTenderLine & { direction: "DEBIT" | "CREDIT" };

type ReturnComputation = {
  saleId: string;
  totalReturnValue: number;
  exchangeValue: number;
  refundDue: number;
  lineAdjustments: ReturnLineAdjustment[];
  tenderReversals: TenderReversal[];
  loyalty?: {
    pointsToRestore: number;
    value: number;
    conversionRate: number;
  };
  manifest?: ReturnManifestSnapshot;
};

function ensureNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} exceeds safe integer range`);
  }
  return value;
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

function ensureString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} cannot be empty`);
  }
  return trimmed;
}

function normalizeLine(line: SaleLineSnapshot, index: number): SaleLineSnapshot {
  return {
    id: ensureString(line.id, `line ${index} id`),
    quantity: ensurePositiveInteger(line.quantity, `line ${index} quantity`),
    unitPrice: ensureNonNegativeInteger(line.unitPrice, `line ${index} unit price`),
    lineTotal: ensureNonNegativeInteger(line.lineTotal, `line ${index} line total`),
    description: line.description ?? null,
  } satisfies SaleLineSnapshot;
}

function normalizeSaleSnapshot(snapshot: SaleSnapshot): SaleSnapshot {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("Sale snapshot is required");
  }
  if (!Array.isArray(snapshot.lines) || snapshot.lines.length === 0) {
    throw new Error("Sale snapshot is missing line items");
  }

  return {
    saleId: ensureString(snapshot.saleId, "sale id"),
    lines: snapshot.lines.map((line, index) => normalizeLine(line, index)),
    tenders: Array.isArray(snapshot.tenders) ? snapshot.tenders : [],
    manifest: snapshot.manifest,
  } satisfies SaleSnapshot;
}

function normalizeSelections(selections: ReturnLineSelection[]): ReturnLineSelection[] {
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error("At least one line must be selected for return");
  }
  return selections.map((selection, index) => {
    if (!selection || typeof selection !== "object") {
      throw new Error(`Selection ${index} is invalid`);
    }
    return {
      lineId: ensureString(selection.lineId, `selection ${index} line id`),
      quantity: ensurePositiveInteger(selection.quantity, `selection ${index} quantity`),
      reason: selection.reason?.trim() || undefined,
    } satisfies ReturnLineSelection;
  });
}

function computeLineAdjustments(
  sale: SaleSnapshot,
  selections: ReturnLineSelection[],
): { adjustments: ReturnLineAdjustment[]; total: number } {
  const lineMap = new Map<string, SaleLineSnapshot>();
  for (const line of sale.lines) {
    lineMap.set(line.id, line);
  }

  const adjustments: ReturnLineAdjustment[] = [];
  let total = 0;

  for (const selection of selections) {
    const line = lineMap.get(selection.lineId);
    if (!line) {
      throw new Error(`Line ${selection.lineId} is not part of the sale`);
    }
    if (selection.quantity > line.quantity) {
      throw new Error(`Return quantity for line ${selection.lineId} exceeds sold quantity`);
    }
    const unitTotal = line.unitPrice;
    const value = unitTotal * selection.quantity;
    total += value;
    adjustments.push({
      lineId: line.id,
      quantity: selection.quantity,
      value,
      reason: selection.reason,
    });
  }

  return { adjustments, total };
}

function proRateRefund(
  refundDue: number,
  saleTotal: number,
  tenders: NormalizedTenderLine[],
  loyaltyConversionRate: number,
): { reversals: TenderReversal[]; loyalty?: ReturnComputation["loyalty"] } {
  if (refundDue <= 0 || saleTotal <= 0) {
    return { reversals: [], loyalty: undefined };
  }

  const reversals: TenderReversal[] = [];
  let remaining = refundDue;
  let loyaltyPointsToRestore = 0;
  let loyaltyValue = 0;
  let loyaltyConversion = loyaltyConversionRate;

  const eligibleTenders = tenders.filter((tender) => tender.amount > 0);
  const lastIndex = eligibleTenders.length - 1;

  eligibleTenders.forEach((tender, index) => {
    if (remaining <= 0) return;
    const baseShare = Math.floor((refundDue * tender.amount) / saleTotal);
    const share = index === lastIndex ? remaining : Math.min(remaining, baseShare);
    if (share <= 0) return;

    if (tender.type === "LOYALTY") {
      const metadata = (tender.metadata ?? {}) as TenderMetadata & {
        pointsRedeemed?: number;
        conversionRate?: number;
      };
      const conversion = metadata.conversionRate && metadata.conversionRate > 0
        ? metadata.conversionRate
        : loyaltyConversionRate;
      loyaltyConversion = conversion;
      let points = Math.round(share / conversion);
      if (points <= 0 && share > 0) {
        points = 1;
      }
      let value = points * conversion;
      if (value > remaining) {
        points = Math.floor(remaining / conversion);
        value = points * conversion;
      }
      if (points <= 0 || value <= 0) {
        return;
      }
      loyaltyPointsToRestore += points;
      loyaltyValue += value;
      remaining -= value;
      reversals.push({
        type: "LOYALTY",
        amount: value,
        metadata: {
          ...metadata,
          pointsRedeemed: points,
          conversionRate: conversion,
          restore: true,
        },
        direction: "CREDIT",
      });
      return;
    }

    remaining -= share;
    reversals.push({
      type: tender.type as TenderType,
      amount: share,
      metadata: tender.metadata ?? null,
      direction: "CREDIT",
    });
  });

  const loyalty =
    loyaltyPointsToRestore > 0
      ? { pointsToRestore: loyaltyPointsToRestore, value: loyaltyValue, conversionRate: loyaltyConversion }
      : undefined;

  return { reversals, loyalty };
}

export function computeReturn(options: ReturnComputationOptions): ReturnComputation {
  const sale = normalizeSaleSnapshot(options.sale);
  const selections = normalizeSelections(options.selections);
  const exchangeValue = options.exchangeAmount
    ? ensureNonNegativeInteger(options.exchangeAmount, "exchange amount")
    : 0;
  const { adjustments, total } = computeLineAdjustments(sale, selections);

  const saleTotal = sale.lines.reduce((acc, line) => acc + line.lineTotal, 0);
  const refundDue = Math.max(0, total - exchangeValue);
  const { reversals, loyalty } = proRateRefund(
    refundDue,
    saleTotal,
    sale.tenders,
    options.loyaltyConversionRate ?? 100,
  );

  const manifest = sale.manifest
    ? (() => {
        const totals = aggregateManifest(reversals);
        return {
          ...sale.manifest,
          nonCashTotals: {
            ewallets: totals.ewallets,
            checks: totals.checks,
            bankTransfers: totals.bankTransfers,
            loyalty: totals.loyalty,
          },
        } satisfies ReturnManifestSnapshot;
      })()
    : undefined;

  return {
    saleId: sale.saleId,
    totalReturnValue: total,
    exchangeValue,
    refundDue,
    lineAdjustments: adjustments,
    tenderReversals: reversals,
    loyalty,
    manifest,
  } satisfies ReturnComputation;
}

export type VoidRequest = {
  saleId: string;
  reason: string;
  approvedBy: string;
  voidLines?: ReturnLineSelection[];
};

export type VoidComputation = {
  saleId: string;
  reason: string;
  approvedBy: string;
  audit: {
    linesVoided: number;
    hasInventoryImpact: boolean;
  };
};

export function computeVoidSummary(request: VoidRequest): VoidComputation {
  const saleId = ensureString(request.saleId, "sale id");
  const reason = ensureString(request.reason, "void reason");
  const approvedBy = ensureString(request.approvedBy, "approved by");
  const voidLines = request.voidLines ? normalizeSelections(request.voidLines) : [];
  const linesVoided = voidLines.length;
  const hasInventoryImpact = voidLines.some((line) => line.quantity > 0);

  return {
    saleId,
    reason,
    approvedBy,
    audit: {
      linesVoided,
      hasInventoryImpact,
    },
  } satisfies VoidComputation;
}
