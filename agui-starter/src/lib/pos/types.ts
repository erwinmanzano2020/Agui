export type Money = number; // centavos
export type DeviceId = string;

export type CartLine = {
  lineNo: number;
  itemId: string;
  name: string;
  uom: string;
  multiplier: number;
  qty: number;
  unitPrice: Money;
  lineTotal: Money;
  meta?: Record<string, unknown>;
};

export type Cart = {
  companyId: string;
  deviceId: DeviceId;
  saleId?: string;
  status: "OPEN" | "HELD" | "COMPLETED" | "VOID";
  lines: CartLine[];
  grandTotal: Money;
  version: number;
  localSeq: number;
};
