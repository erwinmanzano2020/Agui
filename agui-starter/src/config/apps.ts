import type { ReactNode } from "react";

export type AppMeta = {
  id: string;
  label: string;
  href: string;
  description?: string;
  icon: ReactNode;
  accent?: string;
};

export const apps: AppMeta[] = [
  {
    id: "employees",
    label: "Employees",
    href: "/employees",
    description: "Manage staff records",
    icon: "👤",
    accent: "bg-brand",
  },
  {
    id: "dtr",
    label: "DTR Bulk",
    href: "/payroll/dtr-bulk",
    description: "Quick time entry",
    icon: "⏱️",
    accent: "bg-success",
  },
  {
    id: "payroll",
    label: "Payroll",
    href: "/payroll",
    description: "Runs & payslips",
    icon: "🧾",
    accent: "bg-warning",
  },
  {
    id: "imports",
    label: "Import CSV",
    href: "/imports",
    description: "Bulk upload",
    icon: "📥",
    accent: "bg-info",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    description: "Theme & app config",
    icon: "⚙️",
    accent: "bg-muted",
  },
];

export const dock: string[] = ["dtr", "employees", "payroll"];
