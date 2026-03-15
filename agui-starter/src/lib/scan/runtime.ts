// Runtime helpers for scan-related API routes. Do not import schema libraries here.

export type ScanDecisionInput = {
  type: string;
  payload: unknown;
  companyId?: string;
};

export type ScanDecisionResult = {
  decidedAt: string;
  type: string;
  companyId?: string;
  target: "INVENTORY" | "LOYALTY" | "POS" | "UNKNOWN";
  preview?: string;
};

export async function decideScan({ type, payload, companyId }: ScanDecisionInput) {
  const normalizedType = type.trim().toUpperCase();
  let target: ScanDecisionResult["target"] = "UNKNOWN";

  if (normalizedType === "BARCODE") {
    target = "INVENTORY";
  } else if (normalizedType === "QRCODE") {
    target = "LOYALTY";
  } else if (normalizedType === "RFID") {
    target = "POS";
  }

  const preview = typeof payload === "string" ? payload.slice(0, 64) : undefined;

  const result: ScanDecisionResult = {
    decidedAt: new Date().toISOString(),
    type: normalizedType,
    companyId,
    target,
    preview,
  };

  return { ok: true as const, result };
}

export type ScanResolveInput = {
  type: string;
  payload: unknown;
  companyId?: string;
};

export type ScanResolveResult = {
  ok: true;
  result: {
    decidedAt: string;
    companyId?: string;
    type: string;
    resolved:
      | { entity: "PRODUCT" | "CUSTOMER" | "PASS"; ref: string }
      | { entity: "UNKNOWN" };
  };
};

export async function resolveScan({ type, payload, companyId }: ScanResolveInput): Promise<ScanResolveResult> {
  const normalizedType = type.trim().toUpperCase();
  let resolved:
    | { entity: "PRODUCT" | "CUSTOMER" | "PASS"; ref: string }
    | { entity: "UNKNOWN" } = { entity: "UNKNOWN" };

  if (normalizedType === "BARCODE" && typeof payload === "string") {
    resolved = { entity: "PRODUCT", ref: payload.slice(0, 64) };
  } else if (normalizedType === "QRCODE" && typeof payload === "string") {
    if (payload.startsWith("PASS:")) {
      resolved = { entity: "PASS", ref: payload.substring(5, 69) };
    } else if (payload.startsWith("CUST:")) {
      resolved = { entity: "CUSTOMER", ref: payload.substring(5, 69) };
    }
  }

  return {
    ok: true,
    result: {
      decidedAt: new Date().toISOString(),
      companyId,
      type: normalizedType,
      resolved,
    },
  };
}
