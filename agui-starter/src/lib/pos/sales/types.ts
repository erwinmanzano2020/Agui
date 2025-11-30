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
  totalCents: number;
  changeCents: number;
  outstandingCents: number;
  createdAt: string;
  customerId: string | null;
  customerName: string | null;
};
