import { describe, it, expect } from "vitest";
import { normalizeIdentifier } from "../entity";

describe("normalizeIdentifier", () => {
  it("normalizes email", () => {
    expect(normalizeIdentifier("email", "John@Example.COM ")).toBe("john@example.com");
  });
  it("normalizes phone", () => {
    expect(normalizeIdentifier("phone", "  (0917) 123-4567 ")).toBe("+09171234567");
  });
});
