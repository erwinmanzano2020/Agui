import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";

import {
  type OrderCheckoutTransitionResult,
  PosOrderCheckoutTransitionError,
  createSupabasePosOrderCheckoutTransitionRepository,
  getCurrentSessionOrderCheckoutTransition,
} from "./order-checkout-transition";

type CheckoutEntryScopeInput = {
  houseId: string;
  branchId: string;
  sessionId: string;
  deviceId: string;
  orderId: string;
};

type OrderCheckoutEntryRepository = {
  checkoutTransitionRepository: Exclude<
    ReturnType<typeof createSupabasePosOrderCheckoutTransitionRepository>,
    null | undefined
  >;
};

export type OrderCheckoutEntryResult = {
  checkoutEntryStatus: "ENTERABLE" | "BLOCKED";
  canEnterCheckoutBoundary: boolean;
  blockingIssues: OrderCheckoutTransitionResult["blockingIssues"];
  entrySummary: {
    scopedContextStatus: OrderCheckoutTransitionResult["transitionSummary"]["scopedContextStatus"];
    reviewValidationStatus: OrderCheckoutTransitionResult["transitionSummary"]["reviewValidationStatus"];
    checkoutTransitionStatus: OrderCheckoutTransitionResult["checkoutTransitionStatus"];
    activeLineCount: number;
    blockingIssueCount: number;
  };
};

export class PosOrderCheckoutEntryError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "ORDER_CHECKOUT_ENTRY_ERROR", status = 400) {
    super(message);
    this.name = "PosOrderCheckoutEntryError";
    this.code = code;
    this.status = status;
  }
}

function resolveRepository(repository: OrderCheckoutEntryRepository | null | undefined): OrderCheckoutEntryRepository {
  if (!repository) {
    throw new PosOrderCheckoutEntryError(
      "Order checkout entry repository is required",
      "ORDER_CHECKOUT_ENTRY_REPOSITORY_REQUIRED",
      500,
    );
  }

  return repository;
}

export function createSupabasePosOrderCheckoutEntryRepository(
  supabase: SupabaseClient<Database>,
): OrderCheckoutEntryRepository {
  return {
    checkoutTransitionRepository: createSupabasePosOrderCheckoutTransitionRepository(supabase),
  };
}

function mapUpstreamEntryFailure(error: PosOrderCheckoutTransitionError) {
  return new PosOrderCheckoutEntryError(error.message, error.code, error.status);
}

function createEntryResult(input: { checkoutTransition: OrderCheckoutTransitionResult }): OrderCheckoutEntryResult {
  const blockingIssues = input.checkoutTransition.blockingIssues.map((issue) => ({ ...issue }));
  const canEnterCheckoutBoundary = input.checkoutTransition.checkoutTransitionStatus === "ALLOWED";

  return {
    checkoutEntryStatus: canEnterCheckoutBoundary ? "ENTERABLE" : "BLOCKED",
    canEnterCheckoutBoundary,
    blockingIssues,
    entrySummary: {
      scopedContextStatus: input.checkoutTransition.transitionSummary.scopedContextStatus,
      reviewValidationStatus: input.checkoutTransition.transitionSummary.reviewValidationStatus,
      checkoutTransitionStatus: input.checkoutTransition.checkoutTransitionStatus,
      activeLineCount: input.checkoutTransition.transitionSummary.activeLineCount,
      blockingIssueCount: blockingIssues.length,
    },
  };
}

export async function getCurrentSessionOrderCheckoutEntry(
  input: CheckoutEntryScopeInput,
  repository?: OrderCheckoutEntryRepository | null,
): Promise<OrderCheckoutEntryResult> {
  const resolvedRepository = resolveRepository(repository);

  try {
    const checkoutTransition = await getCurrentSessionOrderCheckoutTransition(
      input,
      resolvedRepository.checkoutTransitionRepository,
    );
    return createEntryResult({ checkoutTransition });
  } catch (error) {
    if (error instanceof PosOrderCheckoutEntryError) {
      throw error;
    }

    if (error instanceof PosOrderCheckoutTransitionError) {
      throw mapUpstreamEntryFailure(error);
    }

    throw error;
  }
}

export type RepositoryClient = OrderCheckoutEntryRepository;
