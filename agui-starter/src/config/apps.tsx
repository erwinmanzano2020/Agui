import type { ReactNode } from "react";

import {
  CalendarClockIcon,
  FileDownIcon,
  ScrollTextIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/icons/lucide";
import { DEFAULT_UI_TERMS, type UiTerms } from "@/lib/ui-terms";

export type AppMeta = {
  id: string;
  label: string;
  href: string;
  description?: string;
  icon: ReactNode;
  accentColor?: string;
};

export function createApps(terms: UiTerms = DEFAULT_UI_TERMS): AppMeta[] {
  const teamLower = terms.team.toLowerCase();

  return [
    {
      id: "employees",
      label: terms.team,
      href: "/employees",
      description: `Manage ${teamLower} records`,
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
}

export const dockIds: string[] = ["dtr", "employees", "payroll"];
