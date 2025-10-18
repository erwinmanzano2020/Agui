export type IconName =
  | "employees"
  | "shifts"
  | "clock"
  | "settings"
  | "payroll"
  | "table"
  | "deductions"
  | "payslip"
  | "stack";

export type HomeModuleDefinition = {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  description?: string;
  showInGrid?: boolean;
  dock?: {
    order: number;
    label?: string;
    href?: string;
  };
};

export const HOME_MODULES: HomeModuleDefinition[] = [
  {
    id: "employees",
    label: "Employees",
    href: "/employees",
    icon: "employees",
    dock: { order: 1, label: "People" },
  },
  {
    id: "shifts",
    label: "Shifts",
    href: "/shifts",
    icon: "shifts",
    dock: { order: 2 },
  },
  {
    id: "dtr-today",
    label: "DTR Today",
    href: "/payroll/dtr-today",
    icon: "clock",
  },
  {
    id: "payroll-settings",
    label: "Payroll Settings",
    href: "/payroll/settings",
    icon: "settings",
    dock: { order: 4, label: "Settings", href: "/settings" },
  },
  {
    id: "payroll-preview",
    label: "Payroll Preview",
    href: "/payroll/preview",
    icon: "payroll",
    dock: { order: 3, label: "Payroll", href: "/payroll" },
  },
  {
    id: "bulk-dtr",
    label: "Bulk DTR",
    href: "/payroll/dtr-bulk",
    icon: "table",
  },
  {
    id: "deductions",
    label: "Deductions",
    href: "/payroll/deductions",
    icon: "deductions",
  },
  {
    id: "payslip",
    label: "Payslip",
    href: "/payroll/payslip",
    icon: "payslip",
  },
  {
    id: "bulk-payslip",
    label: "Bulk Payslip",
    href: "/payroll/bulk-payslip",
    icon: "stack",
  },
];

export function getDockModules(modules: HomeModuleDefinition[]) {
  return modules
    .filter((module) => module.dock)
    .sort((a, b) => a.dock!.order - b.dock!.order);
}

export function getGridModules(modules: HomeModuleDefinition[]) {
  return modules.filter((module) => module.showInGrid !== false);
}
