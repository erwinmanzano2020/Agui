import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMagicLinkRedirect,
  classifyMagicLinkError,
  sanitizeNextPath,
} from "../magic-link";

describe("magic-link helpers", () => {
  it("builds redirect with preview origin and safe next", () => {
    const redirect = buildMagicLinkRedirect("https://agui-git-fix-123.vercel.app", "/me?tab=work");
    assert.equal(
      redirect,
      "https://agui-git-fix-123.vercel.app/auth/callback?next=%2Fme%3Ftab%3Dwork",
    );
  });

  it("trims origin trailing slash", () => {
    const redirect = buildMagicLinkRedirect("https://preview.example.com/", "/me");
    assert.equal(redirect, "https://preview.example.com/auth/callback?next=%2Fme");
  });

  it("sanitizes unsafe next targets", () => {
    assert.equal(sanitizeNextPath("https://evil.example"), "/me");
    assert.equal(sanitizeNextPath("//evil.example"), "/me");
    assert.equal(sanitizeNextPath("/company/demo"), "/company/demo");
  });

  it("classifies fetch failures as network errors", () => {
    const classified = classifyMagicLinkError(new TypeError("Failed to fetch"));
    assert.equal(classified.kind, "network");
    assert.equal(classified.diagnostic, "network_unreachable");
  });

  it("classifies client config failures", () => {
    const classified = classifyMagicLinkError(new Error("Supabase client is not configured"));
    assert.equal(classified.kind, "config");
    assert.equal(classified.diagnostic, "client_config_invalid");
  });
});
