export const CASHIER_START_MODE = "DUAL_ENTRY_CASHIER_START_POC" as const;

export type CashierStartAuthMode = "TELEGRAM" | "DIRECT";
export type CashierStartState = "READY" | "OPEN" | "PAUSED";

export type CashierStartShift = {
  shiftId: string;
  businessDate: string;
  branch: string;
  branchLabel: string;
  cashBoxLabel: string;
  cashierEmployeeId: string;
  cashierName: string;
  status: string;
  startedAt: string | Date | null;
  secured: boolean;
  paused: boolean;
  closingSubmitted: boolean;
};

export type CashierStartFailure = {
  ok: false;
  code: string;
  message: string;
  mode?: string;
  refreshRequired?: boolean;
};

export type CashierStartContextSuccess = {
  ok: true;
  action: "CASHIER_START_CONTEXT";
  mode: typeof CASHIER_START_MODE;
  authMode: CashierStartAuthMode;
  state: CashierStartState;
  stateFingerprint: string;
  actor: {
    employeeId: string;
    name: string;
    role: string;
  };
  branch: {
    code: string;
    label: string;
  };
  cashBoxLabel: string;
  existingShift: CashierStartShift | null;
  preShiftCash: {
    amount: number;
    willAutoMoveToDrawer: boolean;
  };
  openingFund: {
    openingFundType: "CARRYOVER" | "NEW_ISSUED" | string;
    source: string;
    priorClosingId: string;
    expectedAmount: number | null;
    requiresNewFund: boolean;
  };
  rules: {
    submitEnabled: true;
    canStart: boolean;
    canResume: boolean;
    preShiftCashAutoMoves: true;
    exceptionReasonRequiredWhenCarryoverDiffers: true;
    noPosTerminalOccupancy: true;
  };
};

export type CashierStartContextResponse = CashierStartContextSuccess | CashierStartFailure;

export type CashierStartSubmitPayload =
  | {
      operation: "START";
      stateFingerprint: string;
      actualOpeningFund: number;
      openingFundConfirmed: true;
      exceptionReason?: string;
    }
  | {
      operation: "RESUME";
      shiftId: string;
    };

export type CashierStartSubmitSuccess = {
  ok: true;
  action: "CASHIER_START_SUBMIT";
  mode: typeof CASHIER_START_MODE;
  status: "OPEN" | "PAUSED";
  operation: "START" | "RESUME";
  alreadyOpen: boolean;
  shift: CashierStartShift;
  openingFund?: {
    actualAmount: number;
    openingFundType: string;
    source: string;
    priorClosingId: string;
    difference: number;
  };
  preShiftCashMoved?: number;
  message: string;
};

export type CashierStartSubmitResponse = CashierStartSubmitSuccess | CashierStartFailure;

export function openingFundDiffers(context: CashierStartContextSuccess, actual: number) {
  if (context.openingFund.requiresNewFund) return false;
  const expected = Number(context.openingFund.expectedAmount ?? 0);
  return Math.abs(Number(actual) - expected) > 0.009;
}
