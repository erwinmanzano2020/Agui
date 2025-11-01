// Run with: node --test dist/lib/__tests__/schema-kit.test.js  (CI runs post-build)
import assert from "node:assert/strict";
import { test } from "node:test";

import { z } from "../../lib/z";
import { stringEnum } from "../../lib/z";

test("stringEnum error message", () => {
  const Color = stringEnum(["red", "blue"] as const, "Color");
  const r = Color.safeParse("green");
  assert.equal(r.success, false);
  assert.match(r.error.issues[0]?.message ?? "", /Color must be one of/);
});

test("z facade works", () => {
  const S = z.object({ n: z.number() });
  assert.equal(S.parse({ n: 1 }).n, 1);
});
