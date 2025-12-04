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
    process.env.NEXT_PUBLIC_VERCEL_ENV = undefined;
  });

  it("allows all features when permission set is empty (dev override)", () => {
    process.env.NODE_ENV = "development";
    assert.equal(canAccessAny([AppFeature.TEAM, AppFeature.DTR_BULK], []), true);
  });

  it("denies access for empty permissions in production", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    assert.equal(canAccessAny([AppFeature.TEAM, AppFeature.DTR_BULK], []), false);
  });

  it("allows access for empty permissions in preview env even with production NODE_ENV", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    assert.equal(canAccessAny([AppFeature.TEAM, AppFeature.DTR_BULK], []), true);
  });

  it("allows access in dev when permissions exist but feature policy is missing", () => {
    process.env.NODE_ENV = "development";
    const posPermission: PolicyRecord = {
      id: "pos-read",
      key: "pos-read",
      action: "tiles:read",
      resource: "pos",
    };
    assert.equal(canAccessAny(AppFeature.PAYROLL, [posPermission]), true);
  });

  it("denies access in production when feature policy is missing", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    const posPermission: PolicyRecord = {
      id: "pos-read",
      key: "pos-read",
      action: "tiles:read",
      resource: "pos",
    };
    assert.equal(canAccessAny(AppFeature.PAYROLL, [posPermission]), false);
  });
});

describe("canAccess", () => {
  afterEach(() => {
    process.env.NODE_ENV = "test";
    process.env.NEXT_PUBLIC_VERCEL_ENV = undefined;
  });

  it("allows all features when permission set is empty (dev override)", () => {
    process.env.NODE_ENV = "development";
    assert.equal(canAccess([AppFeature.TEAM, AppFeature.PAYROLL], []), true);
  });

  it("denies access for empty permissions in production", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    assert.equal(canAccess([AppFeature.TEAM, AppFeature.PAYROLL], []), false);
  });

  it("allows access for empty permissions when preview env flag is set", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
    assert.equal(canAccess([AppFeature.TEAM, AppFeature.PAYROLL], []), true);
  });

  it("allows access in dev when permissions exist but feature policy is missing", () => {
    process.env.NODE_ENV = "development";
    const posPermission: PolicyRecord = {
      id: "pos-read",
      key: "pos-read",
      action: "tiles:read",
      resource: "pos",
    };
    assert.equal(canAccess(AppFeature.PAYROLL, [posPermission]), true);
  });

  it("denies access in production when feature policy is missing", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
    const posPermission: PolicyRecord = {
      id: "pos-read",
      key: "pos-read",
      action: "tiles:read",
      resource: "pos",
    };
    assert.equal(canAccess(AppFeature.PAYROLL, [posPermission]), false);
  });
});
