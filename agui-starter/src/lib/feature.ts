// agui-starter/src/lib/feature.ts
"use server";
import "server-only";
import { cache } from "react";
import { loadUiConfig, type UiModuleKey } from "@/lib/ui-config";
import { applyDevPermissionsOverride, shouldBypassPermissions } from "@/lib/auth/permissions";
import { getUserPermissions } from "@/lib/auth/user-permissions";

export const getFeatureModules = cache(async () => {
  const cfg = await loadUiConfig();
  return cfg.modules;
});

export async function isFeatureOn(k: UiModuleKey) {
  const modules = await getFeatureModules();
  const toggle = modules[k];

  if (toggle?.enabled === false) {
    return false;
  }

  const permissions = await getUserPermissions();
  if (shouldBypassPermissions()) {
    return true;
  }

  const effectivePermissions = applyDevPermissionsOverride(permissions);

  // dev override is active when permissions are empty in non-production and the toggle
  // is not explicitly disabled; default undefined to enabled
  const enabled = toggle?.enabled ?? true;
  if (effectivePermissions !== permissions && enabled) {
    return true;
  }

  return toggle?.enabled ?? false;
}
