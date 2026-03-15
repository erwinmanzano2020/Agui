import type { PolicyRecord, PolicyRequest } from "./types";

const patternCache = new Map<string, RegExp>();

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toRegExp(pattern: string): RegExp {
  const normalized = pattern.trim();
  if (!normalized || normalized === "*") {
    return /^.*$/;
  }

  let cached = patternCache.get(normalized);
  if (cached) return cached;

  const source = "^" + escapeRegExp(normalized).replace(/\\\*/g, ".*") + "$";
  cached = new RegExp(source);
  patternCache.set(normalized, cached);
  return cached;
}

function matches(pattern: string, value: string): boolean {
  const regex = toRegExp(pattern);
  return regex.test(value);
}

export function policyAllows(policy: PolicyRecord, request: PolicyRequest): boolean {
  const action = request.action;
  if (!action) return false;
  const resource = request.resource ?? "*";
  if (!matches(policy.action, action)) {
    return false;
  }

  if (resource === "*") {
    return true;
  }

  return matches(policy.resource, resource);
}

export function permissionSetAllows(
  policies: PolicyRecord[] | null | undefined,
  request: PolicyRequest,
): boolean {
  if (!policies || policies.length === 0) {
    return false;
  }

  return policies.some((policy) => policyAllows(policy, request));
}
