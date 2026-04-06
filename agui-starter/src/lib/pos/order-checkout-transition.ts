import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";

import {
  PosOrderReviewError,
  createSupabasePosOrderReviewRepository,
  getCurrentSessionOrderReview,
  type RepositoryClient as OrderReviewRepositoryClient,
} from "./order-review";
import {
  type OrderReviewValidationResult,
  type PosOrderReviewValidationIssue,
  PosOrderReviewValidationError,
  createSupabasePosOrderReviewValidationRepository,
  getCurrentSessionOrderReviewValidation,
  type RepositoryClient as OrderReviewValidationRepositoryClient,
} from "./order-review-validation";

type CheckoutTransitionScopeInput = {
  houseId: string;
  branchId: string;
  sessionId: string;
  deviceId: string;
  orderId: string;
};

type OrderCheckoutTransitionRepository = {
  reviewRepository: Exclude<OrderReviewRepositoryClient, null | undefined>;
  reviewValidationRepository: Exclude<OrderReviewValidationRepositoryClient, null | undefined>;
};

export type OrderCheckoutTransitionResult = {
  checkoutTransitionStatus: "ALLOWED" | "BLOCKED";
  canEnterFutureCheckout: boolean;
  blockingIssues: PosOrderReviewValidationIssue[];
  transitionSummary: {
    scopedContextStatus: OrderReviewValidationResult["validationSummary"]["scopedContextStatus"];
    reviewStatus: "READY";
    reviewValidationStatus: OrderReviewValidationResult["reviewValidationStatus"];
    activeLineCount: number;
    blockingIssueCount: number;
  };
};

export class PosOrderCheckoutTransitionError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "ORDER_CHECKOUT_TRANSITION_ERROR", status = 400) {
    super(message);
    this.name = "PosOrderCheckoutTransitionError";
    this.code = code;
    this.status = status;
  }
}

function resolveRepository(
  repository: OrderCheckoutTransitionRepository | null | undefined,
): OrderCheckoutTransitionRepository {
  if (!repository) {
    throw new PosOrderCheckoutTransitionError(
      "Order checkout transition repository is required",
      "ORDER_CHECKOUT_TRANSITION_REPOSITORY_REQUIRED",
      500,
    );
  }

  return repository;
}

export function createSupabasePosOrderCheckoutTransitionRepository(
  supabase: SupabaseClient<Database>,
): OrderCheckoutTransitionRepository {
  return {
    reviewRepository: createSupabasePosOrderReviewRepository(supabase),
    reviewValidationRepository: createSupabasePosOrderReviewValidationRepository(supabase),
  };
}

function mapUpstreamTransitionFailure(error: PosOrderReviewError | PosOrderReviewValidationError) {
  return new PosOrderCheckoutTransitionError(error.message, error.code, error.status);
}

function createTransitionResult(input: {
  reviewStatus: "READY";
  activeLineCount: number;
  reviewValidation: OrderReviewValidationResult;
}): OrderCheckoutTransitionResult {
  const blockingIssues = input.reviewValidation.blockingIssues;
  const canEnterFutureCheckout =
    input.reviewValidation.reviewValidationStatus === "READY" &&
    input.reviewValidation.isReadyForFutureCheckout &&
    blockingIssues.length === 0;

  return {
    checkoutTransitionStatus: canEnterFutureCheckout ? "ALLOWED" : "BLOCKED",
    canEnterFutureCheckout,
    blockingIssues,
    transitionSummary: {
      scopedContextStatus: input.reviewValidation.validationSummary.scopedContextStatus,
      reviewStatus: input.reviewStatus,
      reviewValidationStatus: input.reviewValidation.reviewValidationStatus,
      activeLineCount: input.activeLineCount,
      blockingIssueCount: blockingIssues.length,
    },
  };
}

export async function getCurrentSessionOrderCheckoutTransition(
  input: CheckoutTransitionScopeInput,
  repository?: OrderCheckoutTransitionRepository | null,
): Promise<OrderCheckoutTransitionResult> {
  const resolvedRepository = resolveRepository(repository);

  try {
    const reviewValidation = await getCurrentSessionOrderReviewValidation(input, resolvedRepository.reviewValidationRepository);
    let reviewActiveLineCount = reviewValidation.validationSummary.activeLineCount;

    try {
      const review = await getCurrentSessionOrderReview(input, resolvedRepository.reviewRepository);
      reviewActiveLineCount = review.activeLines.length;
    } catch (error) {
      if (!(error instanceof PosOrderReviewError)) {
        throw error;
      }

      if (
        error.code !== "ITEM_PRICE_MISSING" ||
        reviewValidation.reviewValidationStatus !== "BLOCKED" ||
        !reviewValidation.blockingIssues.some((issue) => issue.code === "ITEM_PRICE_MISSING")
      ) {
        throw error;
      }
    }

    return createTransitionResult({
      reviewStatus: "READY",
      activeLineCount: reviewActiveLineCount,
      reviewValidation,
    });
  } catch (error) {
    if (error instanceof PosOrderCheckoutTransitionError) {
      throw error;
    }

    if (error instanceof PosOrderReviewError || error instanceof PosOrderReviewValidationError) {
      throw mapUpstreamTransitionFailure(error);
    }

    throw error;
  }
}
