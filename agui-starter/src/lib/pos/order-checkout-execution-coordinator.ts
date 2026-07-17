import "server-only";

import {
  type OrderCheckoutContainerLifecycleResult,
  createOrderCheckoutContainerLifecycleRepository,
  getCurrentSessionOrderCheckoutContainerLifecycle,
} from "./order-checkout-container-lifecycle";

type CheckoutExecutionCoordinatorScopeInput = {
  houseId: string;
  branchId: string;
  sessionId: string;
  deviceId: string;
  orderId: string;
};

type CheckoutExecutionCoordinatorSnapshot = {
  lifecycle: OrderCheckoutContainerLifecycleResult;
  lifecycleScope: CheckoutExecutionCoordinatorScopeInput;
};

type OrderCheckoutExecutionCoordinatorRepository = {
  getCheckoutExecutionCoordinatorSnapshot: (
    input: CheckoutExecutionCoordinatorScopeInput,
  ) => Promise<CheckoutExecutionCoordinatorSnapshot>;
};

export type OrderCheckoutExecutionCoordinatorResult = {
  checkoutExecutionStatus: "READY" | "BLOCKED";
  canContinueCheckoutExecution: boolean;
  executionScopeSummary: {
    orderId: string;
    sessionId: string;
    deviceId: string;
    branchId: string;
    houseId: string;
    foundationStatus: "FOUNDATIONAL" | "BLOCKED";
    containerLifecycleState: OrderCheckoutContainerLifecycleResult["containerLifecycleState"];
  };
  blockingIssues: Array<{
    code:
      | "CHECKOUT_EXECUTION_FOUNDATION_NOT_FOUNDATIONAL"
      | "CHECKOUT_EXECUTION_LIFECYCLE_NOT_ACTIVE"
      | "CHECKOUT_EXECUTION_ANCHOR_ORDER_MISMATCH"
      | "CHECKOUT_EXECUTION_ANCHOR_SESSION_MISMATCH"
      | "CHECKOUT_EXECUTION_ANCHOR_DEVICE_MISMATCH"
      | "CHECKOUT_EXECUTION_ANCHOR_BRANCH_MISMATCH"
      | "CHECKOUT_EXECUTION_ANCHOR_HOUSE_MISMATCH";
    severity: "BLOCKER";
    message: string;
  }>;
};

export class PosOrderCheckoutExecutionCoordinatorError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "ORDER_CHECKOUT_EXECUTION_COORDINATOR_ERROR", status = 400) {
    super(message);
    this.name = "PosOrderCheckoutExecutionCoordinatorError";
    this.code = code;
    this.status = status;
  }
}

function resolveRepository(
  repository: OrderCheckoutExecutionCoordinatorRepository | null | undefined,
): OrderCheckoutExecutionCoordinatorRepository {
  if (!repository) {
    throw new PosOrderCheckoutExecutionCoordinatorError(
      "Order checkout execution coordinator repository is required",
      "ORDER_CHECKOUT_EXECUTION_COORDINATOR_REPOSITORY_REQUIRED",
      500,
    );
  }

  return repository;
}

function createAnchorBlockers(input: {
  requestedScope: CheckoutExecutionCoordinatorScopeInput;
  lifecycleScope: CheckoutExecutionCoordinatorScopeInput;
}) {
  const issues: OrderCheckoutExecutionCoordinatorResult["blockingIssues"] = [];

  if (input.requestedScope.orderId !== input.lifecycleScope.orderId) {
    issues.push({ code: "CHECKOUT_EXECUTION_ANCHOR_ORDER_MISMATCH", severity: "BLOCKER", message: "Checkout execution order anchor is out of scope." });
  }
  if (input.requestedScope.sessionId !== input.lifecycleScope.sessionId) {
    issues.push({ code: "CHECKOUT_EXECUTION_ANCHOR_SESSION_MISMATCH", severity: "BLOCKER", message: "Checkout execution session anchor is out of scope." });
  }
  if (input.requestedScope.deviceId !== input.lifecycleScope.deviceId) {
    issues.push({ code: "CHECKOUT_EXECUTION_ANCHOR_DEVICE_MISMATCH", severity: "BLOCKER", message: "Checkout execution device anchor is out of scope." });
  }
  if (input.requestedScope.branchId !== input.lifecycleScope.branchId) {
    issues.push({ code: "CHECKOUT_EXECUTION_ANCHOR_BRANCH_MISMATCH", severity: "BLOCKER", message: "Checkout execution branch anchor is out of scope." });
  }
  if (input.requestedScope.houseId !== input.lifecycleScope.houseId) {
    issues.push({ code: "CHECKOUT_EXECUTION_ANCHOR_HOUSE_MISMATCH", severity: "BLOCKER", message: "Checkout execution house anchor is out of scope." });
  }

  return issues;
}

function createCheckoutExecutionCoordinatorResult(input: {
  requestedScope: CheckoutExecutionCoordinatorScopeInput;
  lifecycleScope: CheckoutExecutionCoordinatorScopeInput;
  lifecycle: OrderCheckoutContainerLifecycleResult;
}): OrderCheckoutExecutionCoordinatorResult {
  const blockingIssues = createAnchorBlockers(input);
  const foundationStatus = input.lifecycle.lifecycleSummary.foundationStatus;

  if (foundationStatus !== "FOUNDATIONAL") {
    blockingIssues.unshift({
      code: "CHECKOUT_EXECUTION_FOUNDATION_NOT_FOUNDATIONAL",
      severity: "BLOCKER",
      message: "Checkout execution is blocked because container foundation is not foundational.",
    });
  }

  if (input.lifecycle.containerLifecycleState !== "ACTIVE") {
    blockingIssues.push({
      code: "CHECKOUT_EXECUTION_LIFECYCLE_NOT_ACTIVE",
      severity: "BLOCKER",
      message: "Checkout execution is blocked because container lifecycle is not active.",
    });
  }

  const canContinueCheckoutExecution = blockingIssues.length === 0;

  return {
    checkoutExecutionStatus: canContinueCheckoutExecution ? "READY" : "BLOCKED",
    canContinueCheckoutExecution,
    executionScopeSummary: {
      ...input.requestedScope,
      foundationStatus,
      containerLifecycleState: input.lifecycle.containerLifecycleState,
    },
    blockingIssues,
  };
}

export function createOrderCheckoutExecutionCoordinatorRepository(
  lifecycleRepository: Parameters<typeof createOrderCheckoutContainerLifecycleRepository>[0],
): OrderCheckoutExecutionCoordinatorRepository {
  const repository = createOrderCheckoutContainerLifecycleRepository(lifecycleRepository);

  return {
    async getCheckoutExecutionCoordinatorSnapshot(input) {
      return {
        lifecycle: await getCurrentSessionOrderCheckoutContainerLifecycle(input, repository),
        lifecycleScope: { ...input },
      };
    },
  };
}

export const __internal = {
  createCheckoutExecutionCoordinatorResult,
};

export async function getCurrentSessionOrderCheckoutExecutionCoordinator(
  input: CheckoutExecutionCoordinatorScopeInput,
  repository?: OrderCheckoutExecutionCoordinatorRepository | null,
): Promise<OrderCheckoutExecutionCoordinatorResult> {
  const resolvedRepository = resolveRepository(repository);
  const snapshot = await resolvedRepository.getCheckoutExecutionCoordinatorSnapshot(input);

  return createCheckoutExecutionCoordinatorResult({
    requestedScope: input,
    lifecycleScope: snapshot.lifecycleScope,
    lifecycle: snapshot.lifecycle,
  });
}
