import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePrecedence, type LoyaltyScheme } from "./rules";

describe("loyalty precedence", () => {
  let counter = 0;
  const baseScheme = (overrides: Partial<LoyaltyScheme>): LoyaltyScheme => ({
    id: overrides.id ?? `scheme-${counter++}`,
    scope: overrides.scope ?? "GUILD",
    name: overrides.name ?? "Default",
    precedence: overrides.precedence ?? 10,
    is_active: overrides.is_active ?? true,
    allow_incognito: overrides.allow_incognito ?? false,
    design: overrides.design ?? {},
    created_at: overrides.created_at ?? new Date().toISOString(),
    meta: overrides.meta ?? {},
  });

  it("sorts schemes by precedence without mutating the input", () => {
    const schemes = [
      baseScheme({ id: "house", scope: "HOUSE", precedence: 30 }),
      baseScheme({ id: "guild", scope: "GUILD", precedence: 10 }),
      baseScheme({ id: "alliance", scope: "ALLIANCE", precedence: 5 }),
    ];

    const sorted = resolvePrecedence(schemes);

    assert.deepEqual(sorted.map((s) => s.id), ["alliance", "guild", "house"]);
    assert.deepEqual(
      schemes.map((s) => s.id),
      ["house", "guild", "alliance"],
      "original array order should remain intact",
    );
  });

  it("applies deterministic tie-breakers for scope, name, and id", () => {
    const schemes: LoyaltyScheme[] = [
      baseScheme({ id: "g2", name: "Beta", scope: "GUILD", precedence: 1 }),
      baseScheme({ id: "a1", name: "Alpha", scope: "ALLIANCE", precedence: 1 }),
      baseScheme({ id: "h1", name: "Gamma", scope: "HOUSE", precedence: 1 }),
      baseScheme({ id: "g1", name: "Alpha", scope: "GUILD", precedence: 1 }),
    ];

    const sorted = resolvePrecedence(schemes);

    assert.deepEqual(sorted.map((s) => s.id), ["a1", "g1", "g2", "h1"]);
  });
});
