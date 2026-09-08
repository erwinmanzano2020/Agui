import assert from "node:assert/strict";
import test from "node:test";

import { launchModeFromTelegramInitData } from "@/lib/mobile/entry";

test("Agui Mobile launch mode uses Telegram only when signed initData is present", () => {
  assert.equal(launchModeFromTelegramInitData("query_id=abc&hash=def"), "telegram");
  assert.equal(launchModeFromTelegramInitData("   query_id=abc   "), "telegram");
});

test("Agui Mobile launch mode falls back to direct entry when initData is missing", () => {
  assert.equal(launchModeFromTelegramInitData(""), "direct");
  assert.equal(launchModeFromTelegramInitData("   "), "direct");
  assert.equal(launchModeFromTelegramInitData(undefined), "direct");
  assert.equal(launchModeFromTelegramInitData(null), "direct");
});
