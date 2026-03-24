import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PAYROLL_WRITE_AUTH_REQUIRED_MESSAGE,
  PAYROLL_WRITE_FORBIDDEN_MESSAGE,
  PAYROLL_WRITE_NOT_FOUND_MESSAGE,
  PAYROLL_WRITE_UNEXPECTED_MESSAGE,
  PAYROLL_WRITE_VALIDATION_MESSAGE,
  payrollWriteAuthRequired,
  payrollWriteForbidden,
  payrollWriteNotFound,
  payrollWriteUnexpected,
  payrollWriteValidation,
} from "../write-boundary";

describe("payroll write boundary helper", () => {
  it("uses canonical validation contract", async () => {
    const response = payrollWriteValidation("Invalid JSON payload.");
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: PAYROLL_WRITE_VALIDATION_MESSAGE,
      details: { message: "Invalid JSON payload." },
    });
  });

  it("uses canonical auth/forbidden/not-found/unexpected messages", async () => {
    const auth = payrollWriteAuthRequired();
    assert.equal(auth.status, 401);
    assert.equal((await auth.json()).error, PAYROLL_WRITE_AUTH_REQUIRED_MESSAGE);

    const forbidden = payrollWriteForbidden("denied");
    assert.equal(forbidden.status, 403);
    assert.deepEqual(await forbidden.json(), {
      error: PAYROLL_WRITE_FORBIDDEN_MESSAGE,
      details: { message: "denied" },
    });

    const notFound = payrollWriteNotFound();
    assert.equal(notFound.status, 404);
    assert.equal((await notFound.json()).error, PAYROLL_WRITE_NOT_FOUND_MESSAGE);

    const unexpected = payrollWriteUnexpected("db down");
    assert.equal(unexpected.status, 500);
    assert.deepEqual(await unexpected.json(), {
      error: PAYROLL_WRITE_UNEXPECTED_MESSAGE,
      details: { message: "db down" },
    });
  });
});
