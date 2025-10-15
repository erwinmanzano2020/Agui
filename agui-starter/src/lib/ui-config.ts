export type UiModuleKey =
  | "payroll"
  | "employees"
  | "dtrBulk"
  | "payslip"
  | "preview"
  | "summary"
  | "shifts";

export type UiConfig = {
  theme: {
    name: string;   // e.g., "pastel-green"
    primary: string; // hex
  };
  modules: Record<UiModuleKey, { enabled: boolean; experimental?: boolean }>;
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

// Keep an async accessor so API routes can evolve later (e.g., DB-backed config)
export async function loadUiConfig(): Promise<UiConfig> {
  return uiConfig;
}
