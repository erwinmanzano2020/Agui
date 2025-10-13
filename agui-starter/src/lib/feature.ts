// agui-starter/src/lib/feature.ts
"use server";
import "server-only";
import { cache } from "react";
import { loadUiConfig, type UiToggles } from "@/lib/ui-config";

export const getFeatureToggles = cache(async () => {
  const cfg = await loadUiConfig();
  return cfg.toggles;
});

export async function isFeatureOn<K extends keyof UiToggles>(k: K) {
  const toggles = await getFeatureToggles();
  return !!toggles[k];
}
