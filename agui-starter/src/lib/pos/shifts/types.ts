import type { Database, PosShiftRow as DbPosShiftRow } from "@/lib/db.types";

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
  countedCashCents: number;
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

export type DatabaseClient = import("@supabase/supabase-js").SupabaseClient<Database>;
