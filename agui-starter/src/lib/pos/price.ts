export const DUPLICATE_SCAN_WINDOW_MS = 300;
export const QUANTITY_PREFIX_TIMEOUT_MS = 2_000;

export type PriceTier = {
  minQuantity: number;
  unitPrice: number;
};

export type CatalogItem = {
  id: string;
  price: number;
  tiers?: PriceTier[] | null;
};

export type CartLine = {
  lineId: string;
  itemId: string;
  quantity: number;
};

export type PricedCartLine = CartLine & {
  unitPrice: number;
  lineTotal: number;
  appliedTier: PriceTier | null;
};

export type ScanEvent = {
  barcode: string;
  timestamp: number;
};

export type QuantityPrefixState = {
  value: number;
  updatedAt: number;
};

type NormalizedTier = {
  minQuantity: number;
  unitPrice: number;
};

type NormalizedCatalogItem = {
  id: string;
  price: number;
  tiers: NormalizedTier[];
};

function assertFiniteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function assertCentavos(value: number, label: string): number {
  const coerced = assertFiniteNumber(value, label);
  if (!Number.isInteger(coerced)) {
    throw new Error(`${label} must be represented in whole centavos`);
  }
  if (coerced < 0) {
    throw new Error(`${label} cannot be negative`);
  }
  if (!Number.isSafeInteger(coerced)) {
    throw new Error(`${label} exceeds the safe integer range`);
  }
  return coerced;
}

function assertNonNegativeInteger(value: number, label: string): number {
  const coerced = assertFiniteNumber(value, label);
  if (!Number.isInteger(coerced) || coerced < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  if (!Number.isSafeInteger(coerced)) {
    throw new Error(`${label} exceeds the safe integer range`);
  }
  return coerced;
}

function normalizeTiers(tiers: CatalogItem["tiers"]): NormalizedTier[] {
  if (!tiers || tiers.length === 0) {
    return [];
  }

  const bestByQuantity = new Map<number, NormalizedTier>();
  for (const tier of tiers) {
    if (!tier) continue;
    const min = Math.max(1, assertNonNegativeInteger(tier.minQuantity, "tier.minQuantity"));
    const price = assertCentavos(tier.unitPrice, "tier.unitPrice");
    const existing = bestByQuantity.get(min);
    if (!existing || price < existing.unitPrice) {
      bestByQuantity.set(min, { minQuantity: min, unitPrice: price });
    }
  }

  return Array.from(bestByQuantity.values()).sort((a, b) => {
    if (a.minQuantity !== b.minQuantity) {
      return a.minQuantity - b.minQuantity;
    }
    return a.unitPrice - b.unitPrice;
  });
}

function normalizeCatalog(catalog: Record<string, CatalogItem>): Map<string, NormalizedCatalogItem> {
  const normalized = new Map<string, NormalizedCatalogItem>();
  for (const [id, entry] of Object.entries(catalog)) {
    if (!entry) continue;
    const price = assertCentavos(entry.price, `catalog item ${id} price`);
    const tiers = normalizeTiers(entry.tiers ?? []);
    const resolvedId = typeof entry.id === "string" && entry.id ? entry.id : id;
    const item: NormalizedCatalogItem = { id: resolvedId, price, tiers };
    normalized.set(resolvedId, item);
    if (resolvedId !== id) {
      normalized.set(id, item);
    }
  }
  return normalized;
}

function resolveTier(tiers: NormalizedTier[], quantity: number): NormalizedTier | null {
  if (tiers.length === 0) return null;
  const qty = assertNonNegativeInteger(quantity, "tier quantity");
  let selected: NormalizedTier | null = null;
  for (const tier of tiers) {
    if (qty >= tier.minQuantity) {
      selected = tier;
    } else {
      break;
    }
  }
  return selected;
}

export function toCentavos(amount: number): number {
  const cents = Math.round(assertFiniteNumber(amount, "amount") * 100 + Number.EPSILON);
  return assertCentavos(cents, "amount in centavos");
}

export function multiplyCentavos(unitPrice: number, quantity: number): number {
  const cents = assertCentavos(unitPrice, "unit price");
  const qty = assertNonNegativeInteger(quantity, "quantity");
  const total = cents * qty;
  if (!Number.isSafeInteger(total)) {
    throw new Error("Line total exceeds the safe integer range");
  }
  return total;
}

export function repriceCart(
  cart: CartLine[],
  catalog: Record<string, CatalogItem>,
): PricedCartLine[] {
  const normalizedCatalog = normalizeCatalog(catalog);
  const totalsByItem = new Map<string, number>();

  for (const line of cart) {
    const qty = assertNonNegativeInteger(line.quantity, `quantity for line ${line.lineId}`);
    const itemId = line.itemId;
    if (!normalizedCatalog.has(itemId)) {
      throw new Error(`Missing catalog entry for item ${itemId}`);
    }
    const nextTotal = (totalsByItem.get(itemId) ?? 0) + qty;
    if (!Number.isSafeInteger(nextTotal)) {
      throw new Error(`Quantity for item ${itemId} exceeds the safe integer range`);
    }
    totalsByItem.set(itemId, nextTotal);
  }

  return cart.map((line) => {
    const normalized = normalizedCatalog.get(line.itemId);
    if (!normalized) {
      throw new Error(`Missing catalog entry for item ${line.itemId}`);
    }
    const totalQuantity = totalsByItem.get(line.itemId) ?? 0;
    const tier = resolveTier(normalized.tiers, totalQuantity);
    const unitPrice = tier?.unitPrice ?? normalized.price;
    const lineQuantity = assertNonNegativeInteger(line.quantity, `quantity for line ${line.lineId}`);
    const lineTotal = multiplyCentavos(unitPrice, lineQuantity);

    return {
      ...line,
      quantity: lineQuantity,
      unitPrice,
      lineTotal,
      appliedTier: tier,
    } satisfies PricedCartLine;
  });
}

export function calculateGrandTotal(lines: Array<Pick<PricedCartLine, "lineTotal">>): number {
  return lines.reduce((sum, line, index) => {
    const value = assertCentavos(line.lineTotal, `line total at index ${index}`);
    const next = sum + value;
    if (!Number.isSafeInteger(next)) {
      throw new Error("Grand total exceeds the safe integer range");
    }
    return next;
  }, 0);
}

export function shouldIgnoreDuplicateScan(
  previous: ScanEvent | null,
  next: ScanEvent,
  thresholdMs: number = DUPLICATE_SCAN_WINDOW_MS,
): boolean {
  if (!previous) return false;
  if (previous.barcode !== next.barcode) return false;
  return next.timestamp - previous.timestamp <= thresholdMs;
}

export function isQuantityPrefixExpired(
  state: QuantityPrefixState | null,
  now: number,
  timeoutMs: number = QUANTITY_PREFIX_TIMEOUT_MS,
): boolean {
  if (!state) return true;
  return now - state.updatedAt > timeoutMs;
}

export function updateQuantityPrefix(
  state: QuantityPrefixState | null,
  digit: number,
  now: number,
  timeoutMs: number = QUANTITY_PREFIX_TIMEOUT_MS,
): QuantityPrefixState {
  const coercedDigit = assertNonNegativeInteger(digit, "digit");
  if (coercedDigit > 9) {
    throw new Error("digit must be between 0 and 9");
  }

  if (!state || isQuantityPrefixExpired(state, now, timeoutMs)) {
    return { value: coercedDigit, updatedAt: now };
  }

  const nextValue = state.value * 10 + coercedDigit;
  if (!Number.isSafeInteger(nextValue)) {
    throw new Error("Quantity prefix exceeds the safe integer range");
  }

  return { value: nextValue, updatedAt: now };
}
