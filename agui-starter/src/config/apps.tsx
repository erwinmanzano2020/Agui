import type { ReactNode } from "react";

import type { AppTileVariant } from "@/components/ui/app-tile";
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
  variant?: AppTileVariant;
};

export const apps: AppMeta[] = [
  {
    id: "employees",
    label: "Employees",
    href: "/employees",
    description: "Manage staff records",
    icon: <UsersIcon />,
    accentColor: "#2563EB",
    variant: "pearl",
  },
  {
    id: "dtr",
    label: "DTR Bulk",
    href: "/payroll/dtr-bulk",
    description: "Quick time entry",
    icon: <CalendarClockIcon />,
    accentColor: "#F97316",
    variant: "black",
  },
  {
    id: "payroll",
    label: "Payroll",
    href: "/payroll",
    description: "Runs & payslips",
    icon: <ScrollTextIcon />,
    accentColor: "#16A34A",
    variant: "charcoal",
  },
  {
    id: "imports",
    label: "Import CSV",
    href: "/imports",
    description: "Bulk upload",
    icon: <FileDownIcon />,
    accentColor: "#0EA5E9",
    variant: "white",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings/appearance",
    description: "Theme & app config",
    icon: <SettingsIcon />,
    accentColor: "#A855F7",
    variant: "charcoal",
  },
];

export const dock: string[] = ["dtr", "employees", "payroll"];
