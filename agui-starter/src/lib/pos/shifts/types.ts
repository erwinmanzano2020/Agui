import type { Database, PosShiftRow as DbPosShiftRow } from "@/lib/db.types";
import type { WorkspaceRole } from "@/lib/workspaces/roles";

export type PosShiftStatus = Extract<DbPosShiftRow["status"], "OPEN" | "CLOSED" | "CANCELLED">;

export type PosShiftRow = DbPosShiftRow;

export type OpenShiftInput = {
  houseId: string;
  branchId?: string | null;
  userId: string;
  openingCashCents: number;
};

export type CloseShiftInput = {
  shiftId: string;
  houseId: string;
  userId: string;
  userRoles?: WorkspaceRole[];
  countedCashCents: number;
  closingNotes?: string | null;
};

export type PosShiftSummary = {
  shift: PosShiftRow;
  totalSalesCents: number;
  totalCashTenderCents: number;
  totalNonCashTenderCents: number;
  totalCreditTenderCents: number;
  expectedCashCents: number;
  cashOverShortCents: number;
};

export type PosShiftSummaryView = {
  shiftId: string;
  cashierId: string;
  cashierLabel: string;
  openedAt: string;
  closedAt: string | null;
  status: PosShiftRow["status"];
  openingCashCents: number;
  expectedCashCents: number;
  countedCashCents: number;
  cashOverShortCents: number;
  totalSalesCents: number;
  totalCashTenderCents: number;
  totalNonCashTenderCents: number;
  totalCreditTenderCents: number;
  closingNotes: string | null;
};

export type PosDailyShiftSummary = {
  date: string;
  timeZone: string;
  shifts: PosShiftSummaryView[];
  totals: {
    openingCashCents: number;
    cashTenderCents: number;
    countedCashCents: number;
    cashOverShortCents: number;
    salesCents: number;
  };
};

export type DatabaseClient = import("@supabase/supabase-js").SupabaseClient<Database>;
