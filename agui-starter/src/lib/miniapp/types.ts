export type MiniAppClosingLoadSuccess = {
  ok: true;
  version: string;
  hotfix: string;
  mode: "LOAD_ONLY_NO_OPERATIONAL_WRITES";
  action: "CASHIER_CLOSE_LOAD";
  serverTime: string;
  loadId: string;
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
  dropRefPolicy: "ASSIGNED_ON_CONTROLLED_SUBMIT";
  rules: {
    blindClosing: true;
    expectedCashHidden: true;
    submitEnabled: false;
    finalDropRequiredWhenChecksExist: boolean;
    legacyTelegramFallbackPreserved: true;
  };
};

export type MiniAppClosingLoadError = {
  ok: false;
  code: string;
  message: string;
  version?: string;
  hotfix?: string;
  mode?: string;
};

export type MiniAppClosingLoadResponse = MiniAppClosingLoadSuccess | MiniAppClosingLoadError;
