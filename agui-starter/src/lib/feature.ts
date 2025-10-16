// agui-starter/src/lib/feature.ts
"use server";
import "server-only";
import { cache } from "react";
import { loadUiConfig, type UiModuleKey } from "@/lib/ui-config";

export const getFeatureModules = cache(async () => {
  const cfg = await loadUiConfig();
  return cfg.modules;
});

export async function isFeatureOn(k: UiModuleKey) {
  const modules = await getFeatureModules();
  return modules[k]?.enabled ?? false;
}
