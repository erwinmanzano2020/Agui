import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPublicShellBypassPath } from "@/components/layout/app-shell-visibility";

describe("app shell visibility", () => {
  it("bypasses shell chrome for kiosk routes", () => {
    assert.equal(isPublicShellBypassPath("/company/demo/kiosk"), true);
    assert.equal(isPublicShellBypassPath("/company/demo/kiosk/setup"), true);
  });

  it("keeps shell chrome for non-kiosk company routes", () => {
    assert.equal(isPublicShellBypassPath("/company/demo"), false);
    assert.equal(isPublicShellBypassPath("/company/demo/hr"), false);
  });
});
