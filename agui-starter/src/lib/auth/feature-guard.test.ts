import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { requireAnyFeatureAccessJson } from "./feature-guard";
import { AppFeature } from "./permissions";
import type { PolicyRecord } from "@/lib/policy/types";
import * as userPermissions from "@/lib/auth/user-permissions";

describe("requireAnyFeatureAccessJson", () => {
  const dtrBulkPermission: PolicyRecord = {
    id: "dtr-read",
    key: "dtr-read",
    action: "tiles:read",
    resource: "dtr-bulk",
  };

  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    Object.assign(process.env, {
      NODE_ENV: "test",
      NEXT_PUBLIC_VERCEL_ENV: undefined,
    });
  });

  it("allows access when at least one requested feature is available", async () => {
    mock.method(userPermissions, "getUserPermissions", async () => [dtrBulkPermission]);

    const response = await requireAnyFeatureAccessJson([
      AppFeature.DTR_BULK,
      AppFeature.PAYROLL,
    ]);

    assert.equal(response, null);
  });

  it("allows access when permissions are empty in non-production", async () => {
    Object.assign(process.env, { NODE_ENV: "development" });
    mock.method(userPermissions, "getUserPermissions", async () => []);

    const response = await requireAnyFeatureAccessJson([
      AppFeature.DTR_BULK,
      AppFeature.PAYROLL,
    ]);

    assert.equal(response, null);
  });

  it("allows access in non-production even when unrelated permissions exist", async () => {
    Object.assign(process.env, { NODE_ENV: "development" });
    const posPermission: PolicyRecord = {
      id: "pos-read",
      key: "pos-read",
      action: "tiles:read",
      resource: "pos",
    };
    mock.method(userPermissions, "getUserPermissions", async () => [posPermission]);

    const response = await requireAnyFeatureAccessJson([
      AppFeature.DTR_BULK,
      AppFeature.PAYROLL,
    ]);

    assert.equal(response, null);
  });

  it("returns a 403 response when none of the features are granted in production", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      NEXT_PUBLIC_VERCEL_ENV: "production",
    });
    mock.method(userPermissions, "getUserPermissions", async () => []);

    const response = await requireAnyFeatureAccessJson([
      AppFeature.DTR_BULK,
      AppFeature.PAYROLL,
    ]);

    assert.equal(response?.status, 403);
    const payload = (await response?.json()) as { error: string };
    assert.deepEqual(payload, { error: "Forbidden" });
  });

  it("allows access when preview env flag is present with empty permissions", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      NEXT_PUBLIC_VERCEL_ENV: "preview",
    });
    mock.method(userPermissions, "getUserPermissions", async () => []);

    const response = await requireAnyFeatureAccessJson([
      AppFeature.DTR_BULK,
      AppFeature.PAYROLL,
    ]);

    assert.equal(response, null);
  });
});
