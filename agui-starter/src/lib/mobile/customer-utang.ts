export const CUSTOMER_UTANG_ACTION = "CUSTOMER_UTANG_CONTEXT" as const;
export const CUSTOMER_UTANG_MODE = "DUAL_ENTRY_CUSTOMER_UTANG_POC" as const;

export type CustomerUtangAuthMode = "TELEGRAM" | "DIRECT";

export type CustomerUtangCustomer = {
  customerId: string;
  officialName: string;
  collectionTerms: string;
  defaultDueDays: number;
  dueDate: string;
  currentAR: number | null;
};

export type CustomerUtangFailure = {
  ok: false;
  code: string;
  message: string;
  mode?: string;
  state?: "STALE_PREVIOUS_DAY_SHIFT" | string;
  recoveryRequired?: boolean;
};

export type CustomerUtangContextSuccess = {
  ok: true;
  action: typeof CUSTOMER_UTANG_ACTION;
  mode: typeof CUSTOMER_UTANG_MODE;
  authMode: CustomerUtangAuthMode;
  actor: {
    employeeId: string;
    employeeName: string;
    role: string;
    capabilities: string[];
  };
  branch: {
    code: string;
    label: string;
  };
  shift: {
    shiftId: string;
    status: "OPEN";
    businessDate: string;
    station: string;
    cashBoxLabel: string;
  };
  customers: CustomerUtangCustomer[];
  stateFingerprint: string;
  operationalWritesExpected: false;
};

export type CustomerUtangContextResponse = CustomerUtangContextSuccess | CustomerUtangFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCustomer(value: unknown): value is CustomerUtangCustomer {
  if (!isRecord(value)) return false;
  return (
    typeof value.customerId === "string" && value.customerId.length > 0 &&
    typeof value.officialName === "string" && value.officialName.length > 0 &&
    typeof value.collectionTerms === "string" &&
    typeof value.defaultDueDays === "number" && Number.isInteger(value.defaultDueDays) && value.defaultDueDays >= 0 &&
    typeof value.dueDate === "string" && value.dueDate.length > 0 &&
    (value.currentAR === null || (typeof value.currentAR === "number" && Number.isFinite(value.currentAR)))
  );
}

/** Fail-closed validation of the read-only Apps Script response boundary. */
export function isCustomerUtangContextSuccess(value: unknown): value is CustomerUtangContextSuccess {
  if (!isRecord(value) || !isRecord(value.actor) || !isRecord(value.branch) || !isRecord(value.shift)) return false;
  return (
    value.ok === true &&
    value.action === CUSTOMER_UTANG_ACTION &&
    value.mode === CUSTOMER_UTANG_MODE &&
    (value.authMode === "DIRECT" || value.authMode === "TELEGRAM") &&
    typeof value.actor.employeeId === "string" && value.actor.employeeId.length > 0 &&
    typeof value.actor.employeeName === "string" && value.actor.employeeName.length > 0 &&
    typeof value.actor.role === "string" && value.actor.role.length > 0 &&
    Array.isArray(value.actor.capabilities) && value.actor.capabilities.every((item) => typeof item === "string") &&
    typeof value.branch.code === "string" && value.branch.code.length > 0 &&
    typeof value.branch.label === "string" && value.branch.label.length > 0 &&
    typeof value.shift.shiftId === "string" && value.shift.shiftId.length > 0 &&
    value.shift.status === "OPEN" &&
    typeof value.shift.businessDate === "string" && value.shift.businessDate.length > 0 &&
    typeof value.shift.station === "string" &&
    typeof value.shift.cashBoxLabel === "string" &&
    Array.isArray(value.customers) && value.customers.every(isCustomer) &&
    typeof value.stateFingerprint === "string" && value.stateFingerprint.length > 0 &&
    value.operationalWritesExpected === false
  );
}

export function filterCustomerUtangCustomers(customers: readonly CustomerUtangCustomer[], query: string) {
  const needle = query.trim().toLocaleLowerCase("en-PH");
  if (!needle) return [...customers];
  return customers.filter((customer) =>
    `${customer.officialName} ${customer.customerId}`.toLocaleLowerCase("en-PH").includes(needle),
  );
}
