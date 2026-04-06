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
  type RepositoryClient as OrderLineRepositoryClient,
} from "./order-line";
import {
  PosOrderPricingError,
  computeOrderPricingFromScopedLines,
  createSupabasePosOrderPricingRepository,
} from "./order-pricing";

export type PosOrderReviewValidationIssueCode =
  | "EMPTY_ORDER"
  | "ORDER_INVALID_OR_CLOSED"
  | "ITEM_PRICE_MISSING"
  | "INVALID_SCOPED_CONTEXT";
export type PosOrderReviewValidationIssueSeverity = "BLOCKER";

export type PosOrderReviewValidationIssue = {
  code: PosOrderReviewValidationIssueCode;
  severity: PosOrderReviewValidationIssueSeverity;
  message: string;
};

type ReviewValidationScopeInput = {
  houseId: string;
  branchId: string;
  sessionId: string;
  deviceId: string;
  orderId: string;
};

type OrderReviewValidationRepository = {
  draftRepository: Exclude<OrderDraftRepositoryClient, null | undefined>;
  lineRepository: Exclude<OrderLineRepositoryClient, null | undefined>;
  pricingRepository: {
    getPriceForItem(itemCode: string): Promise<number | null> | number | null;
  };
};

export type OrderReviewValidationResult = {
  reviewValidationStatus: "READY" | "BLOCKED";
  isReadyForFutureCheckout: boolean;
  blockingIssues: PosOrderReviewValidationIssue[];
  validationSummary: {
    scopedContextStatus: "VALID" | "INVALID";
    activeLineCount: number;
    pricingStatus: "RESOLVED" | "UNRESOLVED";
    blockingIssueCount: number;
  };
};

const ORDERED_ISSUE_CODES: PosOrderReviewValidationIssueCode[] = [
  "INVALID_SCOPED_CONTEXT",
  "ORDER_INVALID_OR_CLOSED",
  "EMPTY_ORDER",
  "ITEM_PRICE_MISSING",
];

const ISSUE_MESSAGE_BY_CODE: Record<PosOrderReviewValidationIssueCode, string> = {
  EMPTY_ORDER: "Order must contain at least one active line",
  ITEM_PRICE_MISSING: "One or more active lines cannot be priced",
  ORDER_INVALID_OR_CLOSED: "Order is invalid or no longer available for review",
  INVALID_SCOPED_CONTEXT: "Current scoped order context is invalid",
};

function sortIssueCodes(issueCodes: PosOrderReviewValidationIssueCode[]): PosOrderReviewValidationIssueCode[] {
  const uniqueIssueCodes = [...new Set(issueCodes)];
  return uniqueIssueCodes.sort((a, b) => ORDERED_ISSUE_CODES.indexOf(a) - ORDERED_ISSUE_CODES.indexOf(b));
}

export function toDeterministicBlockingIssues(
  issueCodes: PosOrderReviewValidationIssueCode[],
): PosOrderReviewValidationIssue[] {
  return sortIssueCodes(issueCodes).map((code) => ({
    code,
    severity: "BLOCKER" as const,
    message: ISSUE_MESSAGE_BY_CODE[code],
  }));
}

export class PosOrderReviewValidationError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "ORDER_REVIEW_VALIDATION_ERROR", status = 400) {
    super(message);
    this.name = "PosOrderReviewValidationError";
    this.code = code;
    this.status = status;
  }
}

function validationRepositoryRequiredError() {
  return new PosOrderReviewValidationError(
    "Order review validation repository is required",
    "ORDER_REVIEW_VALIDATION_REPOSITORY_REQUIRED",
    500,
  );
}

function resolveRepository(
  repository: OrderReviewValidationRepository | null | undefined,
): OrderReviewValidationRepository {
  if (!repository) {
    throw validationRepositoryRequiredError();
  }

  return repository;
}

export function createSupabasePosOrderReviewValidationRepository(
  supabase: SupabaseClient<Database>,
): OrderReviewValidationRepository {
  return {
    draftRepository: createSupabasePosOrderDraftRepository(supabase),
    lineRepository: createSupabasePosOrderLineRepository(supabase),
    pricingRepository: createSupabasePosOrderPricingRepository(supabase),
  };
}

function createValidationResult(input: {
  issueCodes: PosOrderReviewValidationIssueCode[];
  activeLineCount: number;
  pricingStatus: "RESOLVED" | "UNRESOLVED";
  scopedContextStatus?: "VALID" | "INVALID";
}): OrderReviewValidationResult {
  const blockingIssues = toDeterministicBlockingIssues(input.issueCodes);
  const isReady = blockingIssues.length === 0;

  return {
    reviewValidationStatus: isReady ? "READY" : "BLOCKED",
    isReadyForFutureCheckout: isReady,
    blockingIssues,
    validationSummary: {
      scopedContextStatus: input.scopedContextStatus ?? "VALID",
      activeLineCount: input.activeLineCount,
      pricingStatus: input.pricingStatus,
      blockingIssueCount: blockingIssues.length,
    },
  };
}

function toScopedValidationFailure(error: PosOrderDraftError | PosOrderLineError) {
  if (error.code === "ORDER_INVALID_OR_CLOSED") {
    return new PosOrderReviewValidationError("Order invalid or closed", "ORDER_INVALID_OR_CLOSED", 403);
  }

  if (error.code === "SESSION_INVALID_OR_CLOSED") {
    return new PosOrderReviewValidationError("Invalid scoped context", "INVALID_SCOPED_CONTEXT", 403);
  }

  return new PosOrderReviewValidationError(error.message, error.code, error.status);
}

export async function getCurrentSessionOrderReviewValidation(
  input: ReviewValidationScopeInput,
  repository?: OrderReviewValidationRepository | null,
): Promise<OrderReviewValidationResult> {
  const resolvedRepository = resolveRepository(repository);

  try {
    await getCurrentSessionDraftOrder(input, resolvedRepository.draftRepository);
    const lines = await getCurrentSessionOrderLines(input, resolvedRepository.lineRepository);
    const issueCodes: PosOrderReviewValidationIssueCode[] = [];

    if (lines.length === 0) {
      issueCodes.push("EMPTY_ORDER");
    }

    if (lines.length > 0) {
      try {
        await computeOrderPricingFromScopedLines({ lines }, resolvedRepository.pricingRepository.getPriceForItem);
      } catch (error) {
        if (error instanceof PosOrderPricingError && error.code === "ITEM_PRICE_MISSING") {
          issueCodes.push("ITEM_PRICE_MISSING");
        } else {
          throw error;
        }
      }
    }

    return createValidationResult({
      issueCodes,
      activeLineCount: lines.length,
      pricingStatus: issueCodes.includes("ITEM_PRICE_MISSING") ? "UNRESOLVED" : lines.length === 0 ? "UNRESOLVED" : "RESOLVED",
    });
  } catch (error) {
    if (error instanceof PosOrderReviewValidationError) {
      throw error;
    }

    if (error instanceof PosOrderDraftError || error instanceof PosOrderLineError) {
      throw toScopedValidationFailure(error);
    }

    if (error instanceof PosOrderPricingError) {
      throw new PosOrderReviewValidationError(error.message, error.code, error.status);
    }

    throw error;
  }
}
