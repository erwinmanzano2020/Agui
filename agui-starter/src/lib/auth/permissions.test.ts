import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { AppFeature, canAccess, canAccessAny } from "./permissions";
import type { PolicyRecord } from "@/lib/policy/types";

describe("canAccessAny", () => {
  const teamPermission: PolicyRecord = {
    id: "team-read",
    key: "team-read",
    action: "tiles:read",
    resource: "team",
  };
  const dtrBulkPermission: PolicyRecord = {
    id: "dtr-read",
    key: "dtr-read",
    action: "tiles:read",
    resource: "dtr-bulk",
  };
  const payrollPermission: PolicyRecord = {
    id: "payroll-any",
    key: "payroll-any",
    action: "payroll:*",
    resource: "*",
  };

  it("allows access when any feature in the list is permitted", () => {
    assert.equal(
      canAccessAny([AppFeature.TEAM, AppFeature.DTR_BULK], [teamPermission]),
      true,
    );
  });

  it("allows access when a later feature is permitted", () => {
    assert.equal(
      canAccessAny([AppFeature.TEAM, AppFeature.DTR_BULK], [dtrBulkPermission]),
      true,
    );
  });

  it("supports single feature inputs", () => {
    assert.equal(canAccessAny(AppFeature.PAYROLL, [payrollPermission]), true);
  });

  afterEach(() => {
    process.env.NODE_ENV = "test";
  });

  it("allows all features when permission set is empty (dev override)", () => {
    process.env.NODE_ENV = "development";
    assert.equal(canAccessAny([AppFeature.TEAM, AppFeature.DTR_BULK], []), true);
  });

  it("denies access for empty permissions in production", () => {
    process.env.NODE_ENV = "production";
    assert.equal(canAccessAny([AppFeature.TEAM, AppFeature.DTR_BULK], []), false);
  });
});

describe("canAccess", () => {
  afterEach(() => {
    process.env.NODE_ENV = "test";
  });

  it("allows all features when permission set is empty (dev override)", () => {
    process.env.NODE_ENV = "development";
    assert.equal(canAccess([AppFeature.TEAM, AppFeature.PAYROLL], []), true);
  });

  it("denies access for empty permissions in production", () => {
    process.env.NODE_ENV = "production";
    assert.equal(canAccess([AppFeature.TEAM, AppFeature.PAYROLL], []), false);
  });
});
