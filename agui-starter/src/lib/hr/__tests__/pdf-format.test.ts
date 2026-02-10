import assert from "node:assert/strict";
import { test } from "node:test";

import { formatMoneyPHP } from "../pdf-format";

test("formatMoneyPHP renders PHP currency code without peso symbol", () => {
  const formatted = formatMoneyPHP(1000);
  assert.equal(formatted, "PHP 1,000.00");
  assert.ok(!formatted.includes("₱"));
});

test("formatMoneyPHP handles non-finite values", () => {
  assert.equal(formatMoneyPHP(Number.NaN), "PHP 0.00");
});
