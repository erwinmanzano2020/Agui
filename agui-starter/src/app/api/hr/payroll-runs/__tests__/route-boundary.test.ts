import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PAYROLL_ROUTE_AUTH_REQUIRED_MESSAGE,
  PAYROLL_ROUTE_FORBIDDEN_MESSAGE,
  PAYROLL_ROUTE_NOT_FOUND_MESSAGE,
  PAYROLL_ROUTE_UNEXPECTED_MESSAGE,
  PAYROLL_ROUTE_VALIDATION_MESSAGE,
  payrollRouteAuthRequired,
  payrollRouteForbidden,
  payrollRouteNotFound,
  payrollRouteUnexpected,
  payrollRouteValidation,
} from "../route-boundary";

describe("payroll route boundary helper", () => {
  it("uses canonical validation contract", async () => {
    const response = payrollRouteValidation("Invalid JSON payload.");
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: PAYROLL_ROUTE_VALIDATION_MESSAGE,
      details: { message: "Invalid JSON payload." },
    });
  });

  it("uses canonical auth/forbidden/not-found/unexpected messages", async () => {
    const auth = payrollRouteAuthRequired();
    assert.equal(auth.status, 401);
    assert.equal((await auth.json()).error, PAYROLL_ROUTE_AUTH_REQUIRED_MESSAGE);

    const forbidden = payrollRouteForbidden("denied");
    assert.equal(forbidden.status, 403);
    assert.deepEqual(await forbidden.json(), {
      error: PAYROLL_ROUTE_FORBIDDEN_MESSAGE,
      details: { message: "denied" },
    });

    const notFound = payrollRouteNotFound();
    assert.equal(notFound.status, 404);
    assert.equal((await notFound.json()).error, PAYROLL_ROUTE_NOT_FOUND_MESSAGE);

    const unexpected = payrollRouteUnexpected("db down");
    assert.equal(unexpected.status, 500);
    assert.deepEqual(await unexpected.json(), {
      error: PAYROLL_ROUTE_UNEXPECTED_MESSAGE,
      details: { message: "db down" },
    });
  });
});
