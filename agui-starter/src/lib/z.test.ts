import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { z, stringEnum } from "@/lib/z";

describe("z facade", () => {
  it("stringEnum validates allowed values", () => {
    const Role = stringEnum(["cashier", "kiosk"] as const, "Channel");
    assert.equal(Role.safeParse("cashier").success, true);
    assert.equal(Role.safeParse("x").success, false);
  });

  it("z works for a simple object", () => {
    const Schema = z.object({ id: z.string().uuid() });
    assert.equal(
      Schema.safeParse({ id: "00000000-0000-0000-0000-000000000000" }).success,
      true,
    );
  });
});
