import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveLookupErrorMessage } from "./lookup-error";

describe("resolveLookupErrorMessage", () => {
  it("prefers details.message over error", () => {
    const message = resolveLookupErrorMessage({
      error: "Not allowed",
      details: { message: "House lookup denied" },
    });

    assert.equal(message, "House lookup denied");
  });

  it("falls back to error when details.message is unavailable", () => {
    const message = resolveLookupErrorMessage({ error: "Not allowed" });
    assert.equal(message, "Not allowed");
  });

  it("falls back to generic message when payload has no safe text", () => {
    const message = resolveLookupErrorMessage({ details: { code: "forbidden" } });
    assert.equal(message, "Unable to look up identities right now.");
  });
});
