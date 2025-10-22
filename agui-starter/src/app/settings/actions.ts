"use server";

import { cookies } from "next/headers";

import { POS_ENABLED_COOKIE } from "@/lib/ui-config";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setPosEnabled(enabled: boolean) {
  const store = await cookies();

  store.set(POS_ENABLED_COOKIE, enabled ? "1" : "0", {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });

  return { pos_enabled: enabled } as const;
}
