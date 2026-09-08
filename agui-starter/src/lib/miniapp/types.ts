export type MiniAppClosingMode =
  | "LOAD_ONLY_NO_OPERATIONAL_WRITES"
  | "CONTROLLED_SUBMIT_PILOT";

export type MiniAppClosingResume = {
  state: string;
  locked: boolean;
  retrySameRequest: boolean;
  reviewRequired: boolean;
  cashierSalesTotal: number;
  tomorrowFund: number;
  finalDropCash: number;
  remarks: string;
  checkerEmployeeId: string;
  checkerName: string;
  checkCount: number;
  checkTotal: number;
  checkReferences: string[];
  sealedPacket: boolean;
  lastErrorCode: string;
  lastErrorMessage: string;
};

export type MiniAppClosingLoadSuccess = {
  ok: true;
  version: string;
  hotfix: string;
  mode: MiniAppClosingMode;
  action: "CASHIER_CLOSE_LOAD";
  serverTime: string;
  loadId: string;
  requestId: string;
  stateFingerprint: string;
  identity: {
    telegramUserId: string;
    employeeId: string;
    staffName: string;
    deviceId: string;
    sharedDevice: boolean;
  };
  shift: {
    shiftId: string;
    businessDate: string;
    branch: string;
    branchLabel: string;
    station: string;
    cashBoxLabel: string;
    cashierEmployeeId: string;
    cashierName: string;
    startedAt: string;
    status: string;
  };
  preflight: { ready: boolean; blockMessage: string };
  floorChecklist: string[];
  checks: {
    count: number;
    total: number;
    references: string[];
    items: Array<{ reference: string; posReference: string; amount: number; displayName: string }>;
  };
  eligibleCheckers: Array<{
    employeeId: string;
    name: string;
    officialName: string;
    location: string;
    atClosingBranch: boolean;
    frequentlyUsedHere: boolean;
  }>;
  finalDropReservation?: {
    finalDropId: string;
    finalDropRef: string;
    vaultLabel: string;
  } | null;
  dropRefPolicy: "ASSIGNED_ON_CONTROLLED_SUBMIT" | "RESERVED_ON_CONTROL_LOAD";
  resume?: MiniAppClosingResume | null;
  rules: {
    blindClosing: true;
    expectedCashHidden: true;
    submitPrepared?: boolean;
    submitEnabled: boolean;
    oneFinalCommit?: boolean;
    finalDropRequiredWhenChecksExist: boolean;
    legacyTelegramFallbackPreserved: true;
  };
};

export type MiniAppClosingError = {
  ok: false;
  code: string;
  message: string;
  version?: string;
  hotfix?: string;
  mode?: string;
  refreshRequired?: boolean;
  retrySameRequest?: boolean;
  reviewRequired?: boolean;
  requestId?: string;
  existingRequestId?: string;
  sealedDropRecorded?: boolean;
  submitEnabled?: boolean;
};

export type MiniAppClosingLoadResponse = MiniAppClosingLoadSuccess | MiniAppClosingError;

export type MiniAppClosingSubmitPayload = {
  requestId: string;
  shiftId: string;
  stateFingerprint: string;
  floorReadyConfirmed: true;
  cashierSalesTotal: number;
  tomorrowFund: number;
  finalDropCash: number;
  remarks: string;
  checkerEmployeeId: string;
  checkerCountMatched: boolean;
  checksMatched: boolean;
  envelopeSigned: boolean;
  envelopeSealed: boolean;
  inDropVault: boolean;
  checkCount: number;
  checkTotal: number;
  checkReferences: string[];
};

export type MiniAppClosingSubmitSuccess = {
  ok: true;
  version: string;
  hotfix: string;
  mode: "CONTROLLED_SUBMIT_PILOT";
  action: "CASHIER_CLOSE_SUBMIT";
  status: "CLOSED";
  requestId: string;
  closingId: string;
  shiftId: string;
  businessDate: string;
  branch: string;
  branchLabel: string;
  cashierName: string;
  cashierSalesTotal: number;
  tomorrowFund: number;
  finalDropCash: number;
  finalDropId: string;
  finalDropRef: string;
  finalDropCheckerName: string;
  cashierResult: string;
  shortageShown: number;
  sharedDeviceLocked: boolean;
  alreadyCompleted?: boolean;
  message: string;
};

export type MiniAppClosingSubmitResponse = MiniAppClosingSubmitSuccess | MiniAppClosingError;
