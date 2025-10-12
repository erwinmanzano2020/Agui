// agui-starter/src/lib/feature.ts
import { loadUiConfig } from "./ui-config";

export async function isFeatureOn(key: "payroll" | "employees" | "shifts" | "pos") {
  const { toggles } = await loadUiConfig();
  return !!toggles[key];
}
