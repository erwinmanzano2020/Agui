import type { Json } from "@/lib/db.types";

export type SaleTenderType = "CASH" | "EWALLET" | "CREDIT";

export type TenderInput = {
  type: SaleTenderType;
  amount: number; // centavos
  reference?: string | null;
};

export type SalesCartLineSnapshot = {
  itemId: string;
  itemName: string;
  uomId: string | null;
  barcode?: string | null;
  uomLabel?: string | null;
  quantity: number;
  unitPriceCents: number;
  baseUnitPriceCents?: number;
  lineTotalCents: number;
  tierTag?: string | null;
  specialPricing?: {
    id: string;
    type: "PERCENT_DISCOUNT" | "FIXED_PRICE";
    source: "CUSTOMER" | "GROUP";
    percentOff?: number;
  } | null;
};

export type SalesCartSnapshot = {
  subtotalCents: number;
  discountCents?: number;
  lines: SalesCartLineSnapshot[];
};

export type CheckoutInput = {
  houseId: string;
  shiftId: string;
  cart: SalesCartSnapshot;
  tenders: TenderInput[];
  customerId?: string | null;
  customerName?: string | null;
  meta?: Json | Record<string, unknown> | null;
};

export type CheckoutTotals = {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  amountReceivedCents: number;
  changeCents: number;
  outstandingCents: number;
  sumCashCents: number;
  sumNonCashNonCreditCents: number;
  sumCreditCents: number;
};

export type SaleSummary = {
  id: string;
  receiptNumber: string;
  totalCents: number;
  changeCents: number;
  outstandingCents: number;
  createdAt: string;
  customerId: string | null;
  customerName: string | null;
};

export type PosReceiptSaleLine = {
  name: string;
  uomLabel: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  savingsPerUnitCents?: number;
  tierTag?: string | null;
};

export type PosReceiptTender = {
  type: "CASH" | "NON_CASH" | "CREDIT";
  amountCents: number;
  label: string;
};

export type PosReceiptSale = {
  id: string;
  receiptNumber: string;
  createdAt: string;
  customerId: string | null;
  customerName: string | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  changeCents: number;
  outstandingCents: number;
  lines: PosReceiptSaleLine[];
  tenders: PosReceiptTender[];
  inventoryWarning?: string | null;
};

export type LoadSaleReceiptResult =
  | { ok: true; sale: PosReceiptSale }
  | { ok: false; error: "NOT_FOUND" | "FORBIDDEN" };

export type RecentSaleSummary = {
  id: string;
  receiptNumber: string | null;
  createdAt: string;
  totalCents: number;
  customerName: string | null;
  tenderSummary: "CASH" | "MIXED" | "CREDIT";
};
