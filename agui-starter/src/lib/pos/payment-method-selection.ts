import type { PaymentEntryResult } from "./payment-entry";

const PAYMENT_METHOD_CATEGORIES = [
  "CASH",
  "CARD",
  "ELECTRONIC_WALLET",
  "BANK_TRANSFER",
  "MIXED",
] as const;

export type PaymentMethodCategory = (typeof PAYMENT_METHOD_CATEGORIES)[number];

export type PaymentMethodSelectionInput = {
  paymentEntry: PaymentEntryResult;
  method: PaymentMethodCategory;
};

export type PaymentMethodSelectionResult = {
  status: "PAYMENT_METHOD_SELECTED";
  method: PaymentMethodCategory;
};

const paymentMethodCategories: ReadonlySet<unknown> = new Set(PAYMENT_METHOD_CATEGORIES);

export function selectPaymentMethod(input: PaymentMethodSelectionInput): PaymentMethodSelectionResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("Payment Method Selection requires the frozen two-member input.");
  }

  const keys = Reflect.ownKeys(input);
  if (
    keys.length !== 2 ||
    !keys.includes("paymentEntry") ||
    !keys.includes("method")
  ) {
    throw new TypeError("Payment Method Selection requires the frozen two-member input.");
  }

  if (input.paymentEntry !== "PAYMENT_ENTRY_ESTABLISHED") {
    throw new TypeError("Payment Method Selection requires established Payment Entry.");
  }

  const method = input.method;
  if (!paymentMethodCategories.has(method)) {
    throw new TypeError("Payment Method Selection requires an approved method category.");
  }

  return {
    status: "PAYMENT_METHOD_SELECTED",
    method,
  };
}
