import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as feature from "./feature";
import * as userPermissions from "@/lib/auth/user-permissions";

const emptyModules = { payroll: { enabled: true } } as any;

describe("isFeatureOn", () => {
  afterEach(() => {
    mock.restoreAll();
    process.env.NODE_ENV = "test";
    process.env.NEXT_PUBLIC_VERCEL_ENV = undefined;
  });

  it("allows modules when dev override is active and the toggle is not disabled", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";

    mock.method(feature, "getFeatureModules", async () => emptyModules);
    mock.method(userPermissions, "getUserPermissions", async () => []);

    const enabled = await feature.isFeatureOn("payroll");

    assert.equal(enabled, true);
  });

  it("respects explicit module disables even with dev override", async () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";

    mock.method(feature, "getFeatureModules", async () => ({ payroll: { enabled: false } } as any));
    mock.method(userPermissions, "getUserPermissions", async () => []);

    const enabled = await feature.isFeatureOn("payroll");

    assert.equal(enabled, false);
  });

  it("allows modules in dev when some unrelated permissions exist", async () => {
    process.env.NODE_ENV = "development";

    mock.method(feature, "getFeatureModules", async () => emptyModules);
    mock.method(userPermissions, "getUserPermissions", async () => [
      {
        id: "pos-read",
        key: "pos-read",
        action: "tiles:read",
        resource: "pos",
      },
    ]);

    const enabled = await feature.isFeatureOn("payroll");

    assert.equal(enabled, true);
  });
});
