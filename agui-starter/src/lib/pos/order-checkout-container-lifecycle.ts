import "server-only";

import {
  type OrderCheckoutContainerFoundationResult,
  createOrderCheckoutContainerFoundationRepository,
  getCurrentSessionOrderCheckoutContainerFoundation,
} from "./order-checkout-container-foundation";

type CheckoutContainerLifecycleScopeInput = {
  houseId: string;
  branchId: string;
  sessionId: string;
  deviceId: string;
  orderId: string;
};

type CheckoutContainerLifecycleContextSnapshot = {
  containerLifecycleState: "NOT_ENTERED" | "ENTERABLE" | "ACTIVE" | "INVALIDATED";
};

type CheckoutContainerLifecycleSnapshot = {
  foundation: OrderCheckoutContainerFoundationResult;
  foundationScope: CheckoutContainerLifecycleScopeInput;
  lifecycleContext?: CheckoutContainerLifecycleContextSnapshot | null;
};

type OrderCheckoutContainerLifecycleRepository = {
  getCheckoutContainerLifecycleSnapshot: (
    input: CheckoutContainerLifecycleScopeInput,
  ) => Promise<CheckoutContainerLifecycleSnapshot>;
};

export type OrderCheckoutContainerLifecycleResult = {
  containerLifecycleState: "NOT_ENTERED" | "ENTERABLE" | "ACTIVE" | "INVALIDATED";
  canActivateContainer: boolean;
  invalidationReasons: Array<{
    code:
      | "CHECKOUT_CONTAINER_LIFECYCLE_FOUNDATION_BLOCKED"
      | "CHECKOUT_CONTAINER_LIFECYCLE_ANCHOR_ORDER_MISMATCH"
      | "CHECKOUT_CONTAINER_LIFECYCLE_ANCHOR_SESSION_MISMATCH"
      | "CHECKOUT_CONTAINER_LIFECYCLE_ANCHOR_DEVICE_MISMATCH"
      | "CHECKOUT_CONTAINER_LIFECYCLE_ANCHOR_BRANCH_MISMATCH"
      | "CHECKOUT_CONTAINER_LIFECYCLE_ANCHOR_HOUSE_MISMATCH"
      | "CHECKOUT_CONTAINER_LIFECYCLE_CONTEXT_INVALIDATED";
    severity: "BLOCKER";
    message: string;
  }>;
  lifecycleSummary: {
    orderId: string;
    sessionId: string;
    deviceId: string;
    branchId: string;
    houseId: string;
    foundationStatus: "FOUNDATIONAL" | "BLOCKED";
  };
};

export class PosOrderCheckoutContainerLifecycleError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "ORDER_CHECKOUT_CONTAINER_LIFECYCLE_ERROR", status = 400) {
    super(message);
    this.name = "PosOrderCheckoutContainerLifecycleError";
    this.code = code;
    this.status = status;
  }
}

function resolveRepository(
  repository: OrderCheckoutContainerLifecycleRepository | null | undefined,
): OrderCheckoutContainerLifecycleRepository {
  if (!repository) {
    throw new PosOrderCheckoutContainerLifecycleError(
      "Order checkout container lifecycle repository is required",
      "ORDER_CHECKOUT_CONTAINER_LIFECYCLE_REPOSITORY_REQUIRED",
      500,
    );
  }

  return repository;
}

function createAnchorInvalidations(input: {
  requestedScope: CheckoutContainerLifecycleScopeInput;
  foundationScope: CheckoutContainerLifecycleScopeInput;
}) {
  const issues: OrderCheckoutContainerLifecycleResult["invalidationReasons"] = [];

  if (input.requestedScope.orderId !== input.foundationScope.orderId) {
    issues.push({ code: "CHECKOUT_CONTAINER_LIFECYCLE_ANCHOR_ORDER_MISMATCH", severity: "BLOCKER", message: "Checkout container lifecycle order anchor is out of scope." });
  }
  if (input.requestedScope.sessionId !== input.foundationScope.sessionId) {
    issues.push({ code: "CHECKOUT_CONTAINER_LIFECYCLE_ANCHOR_SESSION_MISMATCH", severity: "BLOCKER", message: "Checkout container lifecycle session anchor is out of scope." });
  }
  if (input.requestedScope.deviceId !== input.foundationScope.deviceId) {
    issues.push({ code: "CHECKOUT_CONTAINER_LIFECYCLE_ANCHOR_DEVICE_MISMATCH", severity: "BLOCKER", message: "Checkout container lifecycle device anchor is out of scope." });
  }
  if (input.requestedScope.branchId !== input.foundationScope.branchId) {
    issues.push({ code: "CHECKOUT_CONTAINER_LIFECYCLE_ANCHOR_BRANCH_MISMATCH", severity: "BLOCKER", message: "Checkout container lifecycle branch anchor is out of scope." });
  }
  if (input.requestedScope.houseId !== input.foundationScope.houseId) {
    issues.push({ code: "CHECKOUT_CONTAINER_LIFECYCLE_ANCHOR_HOUSE_MISMATCH", severity: "BLOCKER", message: "Checkout container lifecycle house anchor is out of scope." });
  }

  return issues;
}

function createLifecycleResult(input: {
  requestedScope: CheckoutContainerLifecycleScopeInput;
  foundationScope: CheckoutContainerLifecycleScopeInput;
  foundation: OrderCheckoutContainerFoundationResult;
  lifecycleContext?: CheckoutContainerLifecycleContextSnapshot | null;
}): OrderCheckoutContainerLifecycleResult {
  const scopeInvalidations = createAnchorInvalidations(input);
  const foundationBlocked = input.foundation.containerFoundationStatus === "BLOCKED";
  const invalidationReasons = [
    ...(foundationBlocked
      ? [{ code: "CHECKOUT_CONTAINER_LIFECYCLE_FOUNDATION_BLOCKED" as const, severity: "BLOCKER" as const, message: "Checkout container lifecycle is invalidated by foundation decision." }]
      : []),
    ...scopeInvalidations,
  ];

  const contextState = input.lifecycleContext?.containerLifecycleState;
  const contextInvalidated = contextState === "INVALIDATED";

  if (contextInvalidated && invalidationReasons.length === 0) {
    invalidationReasons.push({
      code: "CHECKOUT_CONTAINER_LIFECYCLE_CONTEXT_INVALIDATED",
      severity: "BLOCKER",
      message: "Checkout container lifecycle context is invalidated.",
    });
  }

  const hasInvalidation = invalidationReasons.length > 0;

  if (hasInvalidation) {
    return {
      containerLifecycleState: "INVALIDATED",
      canActivateContainer: false,
      invalidationReasons,
      lifecycleSummary: {
        ...input.requestedScope,
        foundationStatus: input.foundation.containerFoundationStatus,
      },
    };
  }

  const isFoundational = input.foundation.containerFoundationStatus === "FOUNDATIONAL";

  if (!contextState) {
    return {
      containerLifecycleState: "NOT_ENTERED",
      canActivateContainer: false,
      invalidationReasons: [],
      lifecycleSummary: {
        ...input.requestedScope,
        foundationStatus: input.foundation.containerFoundationStatus,
      },
    };
  }

  const isExplicitlyNotEntered = isFoundational && contextState === "NOT_ENTERED";
  const isExplicitlyEnterable = isFoundational && contextState === "ENTERABLE";
  const isExplicitlyActive = isFoundational && contextState === "ACTIVE";

  return {
    containerLifecycleState: isExplicitlyActive
      ? "ACTIVE"
      : isExplicitlyEnterable
        ? "ENTERABLE"
        : isExplicitlyNotEntered
          ? "NOT_ENTERED"
          : "NOT_ENTERED",
    canActivateContainer: isExplicitlyEnterable,
    invalidationReasons,
    lifecycleSummary: {
      ...input.requestedScope,
      foundationStatus: input.foundation.containerFoundationStatus,
    },
  };
}

export function createOrderCheckoutContainerLifecycleRepository(
  foundationRepository: Parameters<typeof createOrderCheckoutContainerFoundationRepository>[0],
): OrderCheckoutContainerLifecycleRepository {
  const repository = createOrderCheckoutContainerFoundationRepository(foundationRepository);

  return {
    async getCheckoutContainerLifecycleSnapshot(input) {
      return {
        foundation: await getCurrentSessionOrderCheckoutContainerFoundation(input, repository),
        foundationScope: { ...input },
        lifecycleContext: null,
      };
    },
  };
}

export async function getCurrentSessionOrderCheckoutContainerLifecycle(
  input: CheckoutContainerLifecycleScopeInput,
  repository?: OrderCheckoutContainerLifecycleRepository | null,
): Promise<OrderCheckoutContainerLifecycleResult> {
  const resolvedRepository = resolveRepository(repository);
  const snapshot = await resolvedRepository.getCheckoutContainerLifecycleSnapshot(input);

  return createLifecycleResult({
    requestedScope: input,
    foundationScope: snapshot.foundationScope,
    foundation: snapshot.foundation,
    lifecycleContext: snapshot.lifecycleContext,
  });
}
