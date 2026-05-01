import "server-only";

import type { OrderCheckoutEntryResult } from "./order-checkout-entry";
import { PosOrderCheckoutEntryError, getCurrentSessionOrderCheckoutEntry } from "./order-checkout-entry";

type CheckoutContainerFoundationScopeInput = {
  houseId: string;
  branchId: string;
  sessionId: string;
  deviceId: string;
  orderId: string;
};

type CheckoutContainerFoundationEntrySnapshot = {
  checkoutEntry: OrderCheckoutEntryResult;
  entryScope: CheckoutContainerFoundationScopeInput;
};

type OrderCheckoutContainerFoundationRepository = {
  getCheckoutEntrySnapshot: (
    input: CheckoutContainerFoundationScopeInput,
  ) => Promise<CheckoutContainerFoundationEntrySnapshot>;
};

export type OrderCheckoutContainerFoundationResult = {
  containerFoundationStatus: "FOUNDATIONAL" | "BLOCKED";
  canDefineCheckoutContainer: boolean;
  containerAnchorSummary: {
    orderId: string;
    sessionId: string;
    deviceId: string;
    branchId: string;
    houseId: string;
  };
  blockingIssues: Array<{
    code:
      | "CHECKOUT_CONTAINER_FOUNDATION_BLOCKED"
      | "CHECKOUT_CONTAINER_ANCHOR_ORDER_MISMATCH"
      | "CHECKOUT_CONTAINER_ANCHOR_SESSION_MISMATCH"
      | "CHECKOUT_CONTAINER_ANCHOR_DEVICE_MISMATCH"
      | "CHECKOUT_CONTAINER_ANCHOR_BRANCH_MISMATCH"
      | "CHECKOUT_CONTAINER_ANCHOR_HOUSE_MISMATCH";
    severity: "BLOCKER";
    message: string;
  }>;
};

function resolveRepository(
  repository: OrderCheckoutContainerFoundationRepository | null | undefined,
): OrderCheckoutContainerFoundationRepository {
  if (!repository) {
    throw new Error("Order checkout container foundation repository is required");
  }

  return repository;
}

function createAnchorBlockers(input: {
  requestedScope: CheckoutContainerFoundationScopeInput;
  entryScope: CheckoutContainerFoundationScopeInput;
}) {
  const issues: OrderCheckoutContainerFoundationResult["blockingIssues"] = [];

  if (input.requestedScope.orderId !== input.entryScope.orderId) {
    issues.push({ code: "CHECKOUT_CONTAINER_ANCHOR_ORDER_MISMATCH", severity: "BLOCKER", message: "Checkout container anchor order is out of scope." });
  }
  if (input.requestedScope.sessionId !== input.entryScope.sessionId) {
    issues.push({ code: "CHECKOUT_CONTAINER_ANCHOR_SESSION_MISMATCH", severity: "BLOCKER", message: "Checkout container anchor session is out of scope." });
  }
  if (input.requestedScope.deviceId !== input.entryScope.deviceId) {
    issues.push({ code: "CHECKOUT_CONTAINER_ANCHOR_DEVICE_MISMATCH", severity: "BLOCKER", message: "Checkout container anchor device is out of scope." });
  }
  if (input.requestedScope.branchId !== input.entryScope.branchId) {
    issues.push({ code: "CHECKOUT_CONTAINER_ANCHOR_BRANCH_MISMATCH", severity: "BLOCKER", message: "Checkout container anchor branch is out of scope." });
  }
  if (input.requestedScope.houseId !== input.entryScope.houseId) {
    issues.push({ code: "CHECKOUT_CONTAINER_ANCHOR_HOUSE_MISMATCH", severity: "BLOCKER", message: "Checkout container anchor house is out of scope." });
  }

  return issues;
}

function createContainerFoundationResult(input: {
  requestedScope: CheckoutContainerFoundationScopeInput;
  entryScope: CheckoutContainerFoundationScopeInput;
  checkoutEntry: OrderCheckoutEntryResult;
}): OrderCheckoutContainerFoundationResult {
  const anchorIssues = createAnchorBlockers(input);
  const entryBlocked = input.checkoutEntry.checkoutEntryStatus === "BLOCKED";
  const blockingIssues = [
    ...(entryBlocked
      ? [{ code: "CHECKOUT_CONTAINER_FOUNDATION_BLOCKED" as const, severity: "BLOCKER" as const, message: "Checkout container foundation is blocked by checkout entry decision." }]
      : []),
    ...anchorIssues,
  ];
  const canDefineCheckoutContainer = !entryBlocked && blockingIssues.length === 0;

  return {
    containerFoundationStatus: canDefineCheckoutContainer ? "FOUNDATIONAL" : "BLOCKED",
    canDefineCheckoutContainer,
    containerAnchorSummary: {
      orderId: input.requestedScope.orderId,
      sessionId: input.requestedScope.sessionId,
      deviceId: input.requestedScope.deviceId,
      branchId: input.requestedScope.branchId,
      houseId: input.requestedScope.houseId,
    },
    blockingIssues,
  };
}

export function createOrderCheckoutContainerFoundationRepository(
  checkoutEntryRepository: Parameters<typeof getCurrentSessionOrderCheckoutEntry>[1],
): OrderCheckoutContainerFoundationRepository {
  return {
    async getCheckoutEntrySnapshot(input) {
      // Default repository has no independent upstream anchor source beyond the scoped query input.
      // It returns trusted requested scope anchors only; independent drift validation requires a custom
      // repository that supplies entryScope from an actual upstream anchor snapshot.
      return {
        checkoutEntry: await getCurrentSessionOrderCheckoutEntry(input, checkoutEntryRepository),
        entryScope: { ...input },
      };
    },
  };
}

export const __internal = {
  createContainerFoundationResult,
};


function shouldMapEntryErrorToBlocked(error: PosOrderCheckoutEntryError): boolean {
  const safeCodes = new Set(["ORDER_INVALID_OR_CLOSED"]);
  return safeCodes.has(error.code);
}

function createEntryDeniedResult(input: {
  requestedScope: CheckoutContainerFoundationScopeInput;
}): OrderCheckoutContainerFoundationResult {
  return {
    containerFoundationStatus: "BLOCKED",
    canDefineCheckoutContainer: false,
    containerAnchorSummary: { ...input.requestedScope },
    blockingIssues: [
      {
        code: "CHECKOUT_CONTAINER_FOUNDATION_BLOCKED",
        severity: "BLOCKER",
        message: "Checkout container foundation is blocked by checkout entry decision.",
      },
    ],
  };
}

export async function getCurrentSessionOrderCheckoutContainerFoundation(
  input: CheckoutContainerFoundationScopeInput,
  repository?: OrderCheckoutContainerFoundationRepository | null,
): Promise<OrderCheckoutContainerFoundationResult> {
  const resolvedRepository = resolveRepository(repository);

  try {
    const snapshot = await resolvedRepository.getCheckoutEntrySnapshot(input);

    return createContainerFoundationResult({
      requestedScope: input,
      entryScope: snapshot.entryScope,
      checkoutEntry: snapshot.checkoutEntry,
    });
  } catch (error) {
    if (error instanceof PosOrderCheckoutEntryError && shouldMapEntryErrorToBlocked(error)) {
      return createEntryDeniedResult({ requestedScope: input });
    }

    throw error;
  }
}
