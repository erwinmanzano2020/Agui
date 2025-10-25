import type { ReactNode } from "react";

import {
  CalendarCheckIcon,
  CalendarClockIcon,
  FileDownIcon,
  IdCardIcon,
  LayoutDashboardIcon,
  NetworkIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldIcon,
  StorefrontIcon,
  UsersIcon,
} from "@/components/icons/lucide";
import { pluralize } from "@/lib/utils";
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
  const alliancesLabel = pluralize(terms.alliance);
  const alliancesLower = alliancesLabel.toLowerCase();
  const guildsLabel = pluralize(terms.guild);
  const guildsLower = guildsLabel.toLowerCase();
  const alliancePassLabel = terms.alliance_pass;
  const alliancePassLower = alliancePassLabel.toLowerCase();

  return [
    {
      id: "alliances",
      label: alliancesLabel,
      href: "/alliances",
      description: `Coordinate ${alliancesLower} and programs`,
      icon: <NetworkIcon />,
    },
    {
      id: "guilds",
      label: guildsLabel,
      href: "/guilds",
      description: `Organize ${guildsLower} and houses`,
      icon: <ShieldIcon />,
    },
    {
      id: "employees",
      label: terms.team,
      href: "/employees",
      description: `Manage ${teamLower} records`,
      icon: <UsersIcon />,
    },
    {
      id: "shifts",
      label: "Shifts",
      href: "/shifts",
      description: "Design shift templates",
      icon: <CalendarCheckIcon />,
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
      id: "pos",
      label: "POS",
      href: "/pos",
      description: "Open the point-of-sale register",
      icon: <StorefrontIcon />,
    },
    {
      id: "passes",
      label: alliancePassLabel,
      href: "/passes/member",
      description: `Manage loyalty and ${alliancePassLower}`,
      icon: <IdCardIcon />,
    },
    {
      id: "imports",
      label: "Import CSV",
      href: "/imports",
      description: "Bulk upload",
      icon: <FileDownIcon />,
    },
    {
      id: "agui",
      label: "Agui",
      href: "/agui",
      description: "Inspect modules & theme",
      icon: <LayoutDashboardIcon />,
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
