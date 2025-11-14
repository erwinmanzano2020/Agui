import type { Json } from "@/lib/db.types";

export type DenominationMap = Map<number, number>;

export type VarianceResult = {
  varianceType: "SHORT" | "OVER" | "NONE";
  varianceAmount: number;
  difference: number;
};

function toInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.trunc(value);
    return Number.isSafeInteger(rounded) ? rounded : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Number.isSafeInteger(parsed) ? parsed : null;
    }
  }
  return null;
}

function toNonNegativeInteger(value: unknown): number | null {
  const parsed = toInteger(value);
  if (parsed == null || parsed < 0) {
    return null;
  }
  return parsed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeDenominations(value: unknown): DenominationMap {
  const result: DenominationMap = new Map();

  if (value == null) {
    return result;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const rawValue = (entry as { value?: unknown }).value;
      const rawCount = (entry as { count?: unknown }).count;
      const denom = toNonNegativeInteger(rawValue);
      const count = toNonNegativeInteger(rawCount);
      if (denom && count != null) {
        result.set(denom, (result.get(denom) ?? 0) + count);
      }
    }
    return result;
  }

  if (isPlainObject(value)) {
    for (const [rawKey, rawCount] of Object.entries(value)) {
      const denom = toNonNegativeInteger(rawKey);
      const count = toNonNegativeInteger(rawCount);
      if (denom && count != null) {
        result.set(denom, (result.get(denom) ?? 0) + count);
      }
    }
  }

  return result;
}

export function denominationMapToJson(map: DenominationMap): Record<string, number> {
  const json: Record<string, number> = {};
  for (const [denom, count] of map.entries()) {
    if (count <= 0) continue;
    json[String(denom)] = count;
  }
  return json;
}

export function jsonToDenominationMap(value: Json | null | undefined): DenominationMap {
  return normalizeDenominations(value ?? {});
}

export function calculateDenominationTotal(map: DenominationMap): number {
  let total = 0;
  for (const [denom, count] of map.entries()) {
    total += denom * count;
  }
  return total;
}

export function determineVariance(submitted: number, counted: number): VarianceResult {
  const safeSubmitted = Number.isFinite(submitted) ? Math.max(0, Math.trunc(submitted)) : 0;
  const safeCounted = Number.isFinite(counted) ? Math.max(0, Math.trunc(counted)) : 0;
  const difference = safeCounted - safeSubmitted;
  if (difference === 0) {
    return { varianceType: "NONE", varianceAmount: 0, difference: 0 };
  }
  if (difference > 0) {
    return { varianceType: "OVER", varianceAmount: difference, difference };
  }
  return { varianceType: "SHORT", varianceAmount: Math.abs(difference), difference };
}

export function computeMaxOffset(balance: number, ratio: number): number {
  const safeBalance = Number.isFinite(balance) && balance > 0 ? Math.trunc(balance) : 0;
  const safeRatio = Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0), 1) : 0;
  if (safeBalance <= 0 || safeRatio <= 0) {
    return 0;
  }
  const maxOffset = Math.floor(safeBalance * safeRatio);
  return Math.max(maxOffset, 0);
}

export function canCoverWithOveragePool(
  shortage: number,
  balance: number,
  ratio: number,
): { allowed: boolean; maxOffset: number } {
  const safeShortage = Number.isFinite(shortage) ? Math.max(0, Math.trunc(shortage)) : 0;
  const maxOffset = computeMaxOffset(balance, ratio);
  if (safeShortage === 0) {
    return { allowed: true, maxOffset };
  }
  if (maxOffset <= 0) {
    return { allowed: false, maxOffset };
  }
  return { allowed: safeShortage <= maxOffset, maxOffset };
}

export function mergeDenominations(
  base: DenominationMap,
  updates: DenominationMap,
): DenominationMap {
  const merged = new Map<number, number>();
  for (const [denom, count] of base.entries()) {
    if (count > 0) {
      merged.set(denom, count);
    }
  }
  for (const [denom, count] of updates.entries()) {
    if (count > 0) {
      merged.set(denom, (merged.get(denom) ?? 0) + count);
    }
  }
  return merged;
}
