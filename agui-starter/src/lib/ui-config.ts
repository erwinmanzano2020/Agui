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

export type UiConfig = {
  theme: ThemeConfig;
  modules: Record<UiModuleKey, ModuleToggle>;
};

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
};

// Async accessor for future DB-backed config
export async function loadUiConfig(): Promise<UiConfig> {
  return uiConfig;
}
