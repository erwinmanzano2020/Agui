import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { slugify, uniqueSlug } from "./slug";

describe("slug utilities", () => {
  it("creates predictable slugs from arbitrary strings", () => {
    assert.equal(slugify("The Quick Brown Fox"), "the-quick-brown-fox");
    assert.equal(slugify("  Café Déjà Vu!  "), "cafe-deja-vu");
  });

  it("falls back to a default value when the slug is empty", () => {
    assert.equal(slugify("!!!", { fallback: "placeholder" }), "placeholder");
  });

  it("respects the maxLength option", () => {
    assert.equal(slugify("The Quick Brown Fox", { maxLength: 10 }), "the-quick");
  });

  it("generates unique slugs using the provided availability check", async () => {
    const existing = new Set(["alpha", "alpha-2"]);
    const result = await uniqueSlug("Alpha", {
      isAvailable: (candidate) => !existing.has(candidate),
    });
    assert.equal(result, "alpha-3");
  });

  it("respects maxLength when generating unique slugs", async () => {
    const existing = new Set(["lorem-ipsum-dolor"]);
    const result = await uniqueSlug("Lorem Ipsum Dolor Sit", {
      isAvailable: (candidate) => !existing.has(candidate),
      maxLength: 18,
    });
    assert.equal(result, "lorem-ipsum-dolo-2");
  });

  it("throws after exhausting the maximum number of attempts", async () => {
    const existing = new Set(["alpha", "alpha-2", "alpha-3"]);
    await assert.rejects(
      uniqueSlug("Alpha", {
        isAvailable: (candidate) => !existing.has(candidate),
        maxAttempts: 2,
      }),
      /Unable to generate unique slug/,
    );
  });
});
