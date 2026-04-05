import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";

import {
  PosOrderDraftError,
  createSupabasePosOrderDraftRepository,
  getCurrentSessionDraftOrder,
  type RepositoryClient as OrderDraftRepositoryClient,
} from "./order-draft";
import {
  PosOrderLineError,
  createSupabasePosOrderLineRepository,
  getCurrentSessionOrderLines,
  type OrderLine,
  type RepositoryClient as OrderLineRepositoryClient,
} from "./order-line";
import {
  PosOrderPricingError,
  computeOrderPricingFromScopedLines,
  createSupabasePosOrderPricingRepository,
} from "./order-pricing";

type ReviewScopeInput = {
  houseId: string;
  branchId: string;
  sessionId: string;
  deviceId: string;
  orderId: string;
};

type OrderReviewRepository = {
  draftRepository: Exclude<OrderDraftRepositoryClient, null | undefined>;
  lineRepository: Exclude<OrderLineRepositoryClient, null | undefined>;
  pricingRepository: {
    getPriceForItem(itemCode: string): Promise<number | null> | number | null;
  };
};

export class PosOrderReviewError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "ORDER_REVIEW_ERROR", status = 400) {
    super(message);
    this.name = "PosOrderReviewError";
    this.code = code;
    this.status = status;
  }
}

function resolveRepository(repository: OrderReviewRepository | null | undefined): OrderReviewRepository {
  if (!repository) {
    throw new PosOrderReviewError("Order review repository is required", "ORDER_REVIEW_REPOSITORY_REQUIRED", 500);
  }
  return repository;
}

export function createSupabasePosOrderReviewRepository(supabase: SupabaseClient<Database>): OrderReviewRepository {
  return {
    draftRepository: createSupabasePosOrderDraftRepository(supabase),
    lineRepository: createSupabasePosOrderLineRepository(supabase),
    pricingRepository: createSupabasePosOrderPricingRepository(supabase),
  };
}

type OrderReviewLine = {
  id: string;
  orderId: string;
  itemCode: string;
  quantity: number;
};

export async function getCurrentSessionOrderReview(
  input: ReviewScopeInput,
  repository?: OrderReviewRepository | null,
): Promise<{
  reviewStatus: "READY";
  draft: {
    id: string;
    houseId: string;
    branchId: string;
    sessionId: string;
    deviceId: string;
    operatorEntityId: string;
    status: "DRAFT";
  };
  activeLines: OrderReviewLine[];
  pricingSummary: {
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
  };
  pricingTraceLines: Array<{
    lineId: string;
    itemCode: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    pricingSource: "bounded_default" | "override";
    pricingInputSource: "manual" | "default";
  }>;
}> {
  const resolvedRepository = resolveRepository(repository);

  try {
    const [draft, activeLines] = await Promise.all([
      getCurrentSessionDraftOrder(input, resolvedRepository.draftRepository),
      getCurrentSessionOrderLines(input, resolvedRepository.lineRepository),
    ]);
    const pricing = await computeOrderPricingFromScopedLines(
      {
        lines: activeLines,
      },
      resolvedRepository.pricingRepository.getPriceForItem,
    );

    return {
      reviewStatus: "READY",
      draft: {
        id: draft.id,
        houseId: draft.house_id,
        branchId: draft.branch_id,
        sessionId: draft.session_id,
        deviceId: draft.device_id,
        operatorEntityId: draft.operator_entity_id,
        status: draft.status,
      },
      activeLines: mapReviewLines(activeLines),
      pricingSummary: {
        subtotal: pricing.subtotal,
        tax: pricing.tax,
        total: pricing.total,
        currency: pricing.currency,
      },
      pricingTraceLines: pricing.lines,
    };
  } catch (error) {
    if (error instanceof PosOrderReviewError) {
      throw error;
    }
    if (error instanceof PosOrderDraftError || error instanceof PosOrderLineError || error instanceof PosOrderPricingError) {
      throw new PosOrderReviewError(error.message, error.code, error.status);
    }
    throw error;
  }
}

function mapReviewLines(lines: OrderLine[]): OrderReviewLine[] {
  return lines.map((line) => ({
    id: line.id,
    orderId: line.order_id,
    itemCode: line.item_code,
    quantity: line.quantity,
  }));
}
