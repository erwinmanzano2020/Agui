import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inspectSupabaseRuntimeConfig } from "../supabase-runtime";

describe("inspectSupabaseRuntimeConfig", () => {
  it("accepts valid Supabase project URL with different origin", () => {
    const result = inspectSupabaseRuntimeConfig({
      supabaseUrl: "https://proj-abc.supabase.co",
      currentOrigin: "https://agui-preview.vercel.app",
    });

    assert.equal(result.ok, true);
    assert.equal(result.diagnostic, "ok");
    assert.equal(result.authEndpoint, "https://proj-abc.supabase.co/auth/v1/otp");
  });

  it("rejects missing url", () => {
    const result = inspectSupabaseRuntimeConfig({ supabaseUrl: "" });
    assert.equal(result.ok, false);
    assert.equal(result.diagnostic, "missing_supabase_url");
  });

  it("rejects malformed url", () => {
    const result = inspectSupabaseRuntimeConfig({ supabaseUrl: "not-a-url" });
    assert.equal(result.ok, false);
    assert.equal(result.diagnostic, "invalid_supabase_url");
  });

  it("rejects same-origin supabase url to prevent self-call loops", () => {
    const result = inspectSupabaseRuntimeConfig({
      supabaseUrl: "https://agui-preview.vercel.app",
      currentOrigin: "https://agui-preview.vercel.app",
    });

    assert.equal(result.ok, false);
    assert.equal(result.diagnostic, "same_origin_supabase_url");
    assert.equal(result.authEndpoint, "https://agui-preview.vercel.app/auth/v1/otp");
  });
});
