import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";

import {
  PosOrderLineError,
  type RepositoryClient as OrderLineRepositoryClient,
  createSupabasePosOrderLineRepository,
  getCurrentSessionOrderLines,
} from "./order-line";

const FIXED_TAX_RATE = 0.12;
const DEFAULT_CURRENCY = "USD";

const BOUNDED_ITEM_PRICES: Record<string, number> = {
  "ITEM-1": 10,
  "ITEM-2": 15,
  "ITEM-3": 25,
};

type ComputeOrderPricingInput = {
  houseId: string;
  branchId: string;
  sessionId: string;
  deviceId: string;
  orderId: string;
  pricingInput?: {
    lineUnitPriceOverrides?: Record<
      string,
      {
        unitPrice: number;
        source?: "manual" | "default";
      }
    >;
  };
};

type OrderPricingRepository = {
  lineRepository: Exclude<OrderLineRepositoryClient, null | undefined>;
  getPriceForItem(itemCode: string): Promise<number | null> | number | null;
};

export class PosOrderPricingError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "ORDER_PRICING_ERROR", status = 400) {
    super(message);
    this.name = "PosOrderPricingError";
    this.code = code;
    this.status = status;
  }
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function validateOverrideUnitPrice(input: number): number {
  if (!Number.isFinite(input)) {
    throw new PosOrderPricingError("Invalid override unit price", "INVALID_OVERRIDE_UNIT_PRICE", 400);
  }

  if (input < 0) {
    throw new PosOrderPricingError("Invalid override unit price", "INVALID_OVERRIDE_UNIT_PRICE", 400);
  }

  return input;
}

function validatePricingInputSource(source: unknown): "manual" | "default" {
  if (source === undefined) {
    return "manual";
  }

  if (source === "manual" || source === "default") {
    return source;
  }

  throw new PosOrderPricingError("Invalid pricing input source", "INVALID_PRICING_INPUT_SOURCE", 400);
}

function isOwnKey<T extends object>(value: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function resolveBoundedItemPrice(itemCode: string): number | null {
  if (!Object.prototype.hasOwnProperty.call(BOUNDED_ITEM_PRICES, itemCode)) {
    return null;
  }

  return BOUNDED_ITEM_PRICES[itemCode] ?? null;
}

function createBoundedOrderPricingRepository(supabase: SupabaseClient<Database>): OrderPricingRepository {
  const lineRepository = createSupabasePosOrderLineRepository(supabase);
  return {
    lineRepository,
    getPriceForItem(itemCode) {
      return resolveBoundedItemPrice(itemCode);
    },
  };
}

export function createSupabasePosOrderPricingRepository(supabase: SupabaseClient<Database>) {
  return createBoundedOrderPricingRepository(supabase);
}

function resolveRepository(
  repository: OrderPricingRepository | null | undefined,
): OrderPricingRepository {
  if (!repository) {
    throw new PosOrderPricingError("Order pricing repository is required", "ORDER_PRICING_REPOSITORY_REQUIRED", 500);
  }
  return repository;
}

export async function computeOrderPricing(
  input: ComputeOrderPricingInput,
  repository?: OrderPricingRepository | null,
) {
  const pricingRepository = resolveRepository(repository);

  try {
    const lines = await getCurrentSessionOrderLines(input, pricingRepository.lineRepository);
    let subtotal = 0;
    const lineUnitPriceOverrides = input.pricingInput?.lineUnitPriceOverrides ?? {};
    const pricedLines: Array<{
      lineId: string;
      itemCode: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      pricingSource: "bounded_default" | "override";
      pricingInputSource: "manual" | "default";
    }> = [];

    for (const line of lines) {
      let unitPrice: number | null | undefined = null;
      let pricingSource: "bounded_default" | "override" = "bounded_default";
      let pricingInputSource: "manual" | "default" = "default";

      if (isOwnKey(lineUnitPriceOverrides, line.id)) {
        const override = lineUnitPriceOverrides[line.id];
        unitPrice = validateOverrideUnitPrice(override.unitPrice);
        pricingSource = "override";
        pricingInputSource = validatePricingInputSource(override.source);
      } else {
        unitPrice = await pricingRepository.getPriceForItem(line.item_code);
        if (unitPrice === null || unitPrice === undefined || !Number.isFinite(unitPrice)) {
          throw new PosOrderPricingError("Missing item price", "ITEM_PRICE_MISSING", 400);
        }
      }

      const lineTotal = roundCurrency(line.quantity * unitPrice);
      subtotal += lineTotal;
      pricedLines.push({
        lineId: line.id,
        itemCode: line.item_code,
        quantity: line.quantity,
        unitPrice,
        lineTotal,
        pricingSource,
        pricingInputSource,
      });
    }

    const roundedSubtotal = roundCurrency(subtotal);
    const tax = roundCurrency(roundedSubtotal * FIXED_TAX_RATE);

    return {
      subtotal: roundedSubtotal,
      tax,
      total: roundCurrency(roundedSubtotal + tax),
      currency: DEFAULT_CURRENCY,
      lines: pricedLines,
    };
  } catch (error) {
    if (error instanceof PosOrderPricingError) {
      throw error;
    }
    if (error instanceof PosOrderLineError) {
      throw new PosOrderPricingError(error.message, error.code, error.status);
    }
    throw error;
  }
}
