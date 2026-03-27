import assert from "node:assert/strict";

const CANONICAL_SAFE_HR_ROUTE_ENTRY_ORDER = ["auth", "entity", "feature"] as const;

type UnauthenticatedDriftExpectations = {
  response: Response;
  expectedStatus: number;
  expectedError: string;
  featureGuardCalls: number;
  payloadParseCalls?: number;
};

export function assertCanonicalSafeHrRouteEntryOrder(order: string[], trailingSteps: string[] = []) {
  assert.deepEqual(order, [...CANONICAL_SAFE_HR_ROUTE_ENTRY_ORDER, ...trailingSteps]);
}

export async function assertUnauthenticatedSafeHrRouteDrift({
  response,
  expectedStatus,
  expectedError,
  featureGuardCalls,
  payloadParseCalls,
}: UnauthenticatedDriftExpectations) {
  assert.equal(response.status, expectedStatus);
  const payload = await response.json();
  assert.equal(payload?.error, expectedError);
  assert.equal(featureGuardCalls, 0);
  if (typeof payloadParseCalls === "number") {
    assert.equal(payloadParseCalls, 0);
  }
}
