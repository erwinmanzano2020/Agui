import type {
  PaymentMethodCategory,
  PaymentMethodSelectionResult,
} from "./payment-method-selection";

const PAYMENT_METHOD_CATEGORIES: ReadonlySet<unknown> = new Set<PaymentMethodCategory>([
  "CASH",
  "CARD",
  "ELECTRONIC_WALLET",
  "BANK_TRANSFER",
  "MIXED",
]);

export type TenderIntentInput = {
  paymentEntry: "PAYMENT_ENTRY_ESTABLISHED";
  paymentMethodSelection: PaymentMethodSelectionResult;
};

export type TenderIntentResult = {
  status: "TENDER_INTENT_ESTABLISHED";
};

function requireExactDataMembers(
  value: unknown,
  memberNames: readonly string[],
  errorMessage: string,
): Readonly<Record<string, PropertyDescriptor>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(errorMessage);
  }

  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== memberNames.length ||
    !memberNames.every((memberName) => keys.includes(memberName))
  ) {
    throw new TypeError(errorMessage);
  }

  const descriptors: Record<string, PropertyDescriptor> = {};
  for (const memberName of memberNames) {
    const descriptor = Object.getOwnPropertyDescriptor(value, memberName);
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(errorMessage);
    }
    descriptors[memberName] = descriptor;
  }

  return descriptors;
}

export function establishTenderIntent(input: TenderIntentInput): TenderIntentResult {
  const inputDescriptors = requireExactDataMembers(
    input,
    ["paymentEntry", "paymentMethodSelection"],
    "Tender Intent requires the frozen two-member prerequisite input.",
  );

  if (inputDescriptors.paymentEntry.value !== "PAYMENT_ENTRY_ESTABLISHED") {
    throw new TypeError("Tender Intent requires established Payment Entry evidence.");
  }

  const selectionDescriptors = requireExactDataMembers(
    inputDescriptors.paymentMethodSelection.value,
    ["status", "method"],
    "Tender Intent requires the frozen Payment Method Selection evidence.",
  );

  if (selectionDescriptors.status.value !== "PAYMENT_METHOD_SELECTED") {
    throw new TypeError("Tender Intent requires selected Payment Method evidence.");
  }

  if (!PAYMENT_METHOD_CATEGORIES.has(selectionDescriptors.method.value)) {
    throw new TypeError("Tender Intent requires an approved method category.");
  }

  return { status: "TENDER_INTENT_ESTABLISHED" };
}
