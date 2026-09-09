import type { PaymentFoundationResult } from "./payment-foundation";

export type PaymentEntryInput = Extract<PaymentFoundationResult, "PAYMENT_READY">;
export type PaymentEntryResult = "PAYMENT_ENTRY_ESTABLISHED";

export function establishPaymentEntry(paymentFoundationResult: PaymentEntryInput): PaymentEntryResult {
  if (paymentFoundationResult !== "PAYMENT_READY") {
    throw new TypeError("Payment Entry runtime accepts only PAYMENT_READY.");
  }

  return "PAYMENT_ENTRY_ESTABLISHED";
}
