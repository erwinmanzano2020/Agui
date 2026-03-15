import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as feature from "./feature";
import * as userPermissions from "@/lib/auth/user-permissions";
import { uiConfig, type ModuleToggle } from "@/lib/ui-config";

const modulesWithPayroll = (toggle: ModuleToggle) => ({
  ...uiConfig.modules,
  payroll: toggle,
});

describe("isFeatureOn", () => {
  afterEach(() => {
    mock.restoreAll();
    Object.assign(process.env, {
      NODE_ENV: "test",
      NEXT_PUBLIC_VERCEL_ENV: undefined,
    });
  });

  it("allows modules when dev override is active and the toggle is not disabled", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      NEXT_PUBLIC_VERCEL_ENV: "preview",
    });

    mock.method(feature, "getFeatureModules", async () => modulesWithPayroll({ enabled: true }));
    mock.method(userPermissions, "getUserPermissions", async () => []);

    const enabled = await feature.isFeatureOn("payroll");

    assert.equal(enabled, true);
  });

  it("respects explicit module disables even with dev override", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      NEXT_PUBLIC_VERCEL_ENV: "preview",
    });

    mock.method(feature, "getFeatureModules", async () => modulesWithPayroll({ enabled: false }));
    mock.method(userPermissions, "getUserPermissions", async () => []);

    const enabled = await feature.isFeatureOn("payroll");

    assert.equal(enabled, false);
  });

  it("allows modules in dev when some unrelated permissions exist", async () => {
    Object.assign(process.env, { NODE_ENV: "development" });

    mock.method(feature, "getFeatureModules", async () => modulesWithPayroll({ enabled: true }));
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
