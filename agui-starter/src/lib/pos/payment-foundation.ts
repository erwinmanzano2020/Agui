import type { OrderCheckoutExecutionCoordinatorResult } from "./order-checkout-execution-coordinator";

export type PaymentFoundationResult = "PAYMENT_READY" | "PAYMENT_BLOCKED";

type Slice8CoordinatorResultInput = OrderCheckoutExecutionCoordinatorResult | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCanonicalCoordinatorResult(value: unknown): value is OrderCheckoutExecutionCoordinatorResult {
  if (!isRecord(value)) {
    return false;
  }

  if (value.checkoutExecutionStatus !== "READY" && value.checkoutExecutionStatus !== "BLOCKED") {
    return false;
  }

  return (
    typeof value.canContinueCheckoutExecution === "boolean" &&
    isRecord(value.executionScopeSummary) &&
    typeof value.executionScopeSummary.orderId === "string" &&
    typeof value.executionScopeSummary.sessionId === "string" &&
    typeof value.executionScopeSummary.deviceId === "string" &&
    typeof value.executionScopeSummary.branchId === "string" &&
    typeof value.executionScopeSummary.houseId === "string" &&
    typeof value.executionScopeSummary.foundationStatus === "string" &&
    typeof value.executionScopeSummary.containerLifecycleState === "string" &&
    Array.isArray(value.blockingIssues)
  );
}

export function determinePaymentFoundationAuthority(
  coordinatorResult: Slice8CoordinatorResultInput,
): PaymentFoundationResult {
  if (!isCanonicalCoordinatorResult(coordinatorResult)) {
    return "PAYMENT_BLOCKED";
  }

  if (coordinatorResult.checkoutExecutionStatus === "READY") {
    return "PAYMENT_READY";
  }

  return "PAYMENT_BLOCKED";
}
