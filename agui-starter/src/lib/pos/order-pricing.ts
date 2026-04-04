import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";

import { PosOrderLineError, createSupabasePosOrderLineRepository } from "./order-line";

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
};

type OrderPricingRepository = {
  getCurrentSessionOrderLines(input: ComputeOrderPricingInput): Promise<Array<{ item_code: string; quantity: number }>>;
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

function resolveBoundedItemPrice(itemCode: string): number | null {
  return BOUNDED_ITEM_PRICES[itemCode] ?? null;
}

function createBoundedOrderPricingRepository(supabase: SupabaseClient<Database>): OrderPricingRepository {
  const lineRepository = createSupabasePosOrderLineRepository(supabase);
  return {
    async getCurrentSessionOrderLines(input) {
      return lineRepository.getOrderLinesByDraft(input);
    },
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
    const lines = await pricingRepository.getCurrentSessionOrderLines(input);
    let subtotal = 0;

    for (const line of lines) {
      const unitPrice = await pricingRepository.getPriceForItem(line.item_code);
      if (unitPrice === null || unitPrice === undefined) {
        throw new PosOrderPricingError("Missing item price", "ITEM_PRICE_MISSING", 400);
      }
      subtotal += line.quantity * unitPrice;
    }

    const roundedSubtotal = roundCurrency(subtotal);
    const tax = roundCurrency(roundedSubtotal * FIXED_TAX_RATE);

    return {
      subtotal: roundedSubtotal,
      tax,
      total: roundCurrency(roundedSubtotal + tax),
      currency: DEFAULT_CURRENCY,
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
