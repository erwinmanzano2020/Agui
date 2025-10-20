import type { ReactNode } from "react";

import {
  CalendarClockIcon,
  FileDownIcon,
  ScrollTextIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/icons/lucide";

export type AppMeta = {
  id: string;
  label: string;
  href: string;
  description?: string;
  icon: ReactNode;
  accentColor?: string;
};

export const apps: AppMeta[] = [
  {
    id: "employees",
    label: "Employees",
    href: "/employees",
    description: "Manage staff records",
    icon: <UsersIcon />,
  },
  {
    id: "dtr",
    label: "DTR Bulk",
    href: "/payroll/dtr-bulk",
    description: "Quick time entry",
    icon: <CalendarClockIcon />,
  },
  {
    id: "payroll",
    label: "Payroll",
    href: "/payroll",
    description: "Runs & payslips",
    icon: <ScrollTextIcon />,
  },
  {
    id: "imports",
    label: "Import CSV",
    href: "/imports",
    description: "Bulk upload",
    icon: <FileDownIcon />,
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings/appearance",
    description: "Theme & app config",
    icon: <SettingsIcon />,
  },
];

export const dock: string[] = ["dtr", "employees", "payroll"];
