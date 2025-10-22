import { cookies } from "next/headers";

export type UiModuleKey =
  | "payroll"
  | "employees"
  | "dtrBulk"
  | "payslip"
  | "preview"
  | "summary"
  | "shifts";

/** Exported for theme-provider & theme-css */
export type ThemeConfig = {
  name: string;   // e.g., "pastel-green"
  primary: string; // hex
};

export type ModuleToggle = { enabled: boolean; experimental?: boolean };

export type UiFlags = {
  pos_enabled?: boolean;
};

export type UiConfig = {
  theme: ThemeConfig;
  modules: Record<UiModuleKey, ModuleToggle>;
  flags: UiFlags;
};

export const POS_ENABLED_COOKIE = "agui-pos-enabled";

export const uiConfig: UiConfig = {
  theme: { name: "pastel-green", primary: "#c8e1cc" },
  modules: {
    payroll: { enabled: true },
    employees: { enabled: true },
    dtrBulk: { enabled: true },
    payslip: { enabled: true },
    preview: { enabled: true },
    summary: { enabled: true },
    shifts: { enabled: true },
  },
  flags: {
    pos_enabled: false,
  },
};

// Async accessor for future DB-backed config
export async function loadUiConfig(): Promise<UiConfig> {
  const cookieStore = cookies();
  const cookieValue = cookieStore.get(POS_ENABLED_COOKIE)?.value;

  const parseBoolean = (value: string | undefined) => {
    if (typeof value === "undefined") return undefined;
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
    return undefined;
  };

  const cookieEnabled = parseBoolean(cookieValue);
  const envEnabled = parseBoolean(process.env.NEXT_PUBLIC_POS_ENABLED);

  return {
    ...uiConfig,
    flags: {
      ...uiConfig.flags,
      pos_enabled: cookieEnabled ?? envEnabled ?? uiConfig.flags.pos_enabled ?? false,
    },
  };
}
