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

function isPaymentMethodCategory(value: unknown): value is PaymentMethodCategory {
  return paymentMethodCategories.has(value);
}

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

  const paymentEntryDescriptor = Object.getOwnPropertyDescriptor(input, "paymentEntry");
  const methodDescriptor = Object.getOwnPropertyDescriptor(input, "method");
  if (
    paymentEntryDescriptor === undefined ||
    !("value" in paymentEntryDescriptor) ||
    methodDescriptor === undefined ||
    !("value" in methodDescriptor)
  ) {
    throw new TypeError("Payment Method Selection requires frozen members to be data properties.");
  }

  if (paymentEntryDescriptor.value !== "PAYMENT_ENTRY_ESTABLISHED") {
    throw new TypeError("Payment Method Selection requires established Payment Entry.");
  }

  const method: unknown = methodDescriptor.value;
  if (!isPaymentMethodCategory(method)) {
    throw new TypeError("Payment Method Selection requires an approved method category.");
  }

  return {
    status: "PAYMENT_METHOD_SELECTED",
    method,
  };
}
