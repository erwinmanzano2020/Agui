import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPublicPath } from "@/middleware";

describe("middleware public kiosk routing", () => {
  it("marks /company/[slug]/kiosk as public", () => {
    assert.equal(isPublicPath("/company/demo/kiosk"), true);
    assert.equal(isPublicPath("/company/demo/kiosk/setup"), true);
  });

  it("keeps non-kiosk company pages protected", () => {
    assert.equal(isPublicPath("/company/demo/hr"), false);
  });
});

describe("Agui Mobile Customer Utang routing", () => {
  it("allows only the Gate 1 page and context API through the Supabase-session layer", () => {
    assert.equal(isPublicPath("/mini/cashier/customer-utang"), true);
    assert.equal(isPublicPath("/api/miniapp/cashier/customer-utang/context"), true);
    assert.equal(isPublicPath("/api/miniapp/cashier/customer-utang/submit"), false);
  });
});
