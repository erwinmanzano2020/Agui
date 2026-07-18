import type { OrderCheckoutExecutionCoordinatorResult } from "./order-checkout-execution-coordinator";

export type PaymentFoundationResult = "PAYMENT_READY" | "PAYMENT_BLOCKED";

type Slice8CoordinatorResultInput = OrderCheckoutExecutionCoordinatorResult | null | undefined;

export function determinePaymentFoundationAuthority(
  coordinatorResult: Slice8CoordinatorResultInput,
): PaymentFoundationResult {
  if (coordinatorResult?.checkoutExecutionStatus === "READY") {
    return "PAYMENT_READY";
  }

  return "PAYMENT_BLOCKED";
}
