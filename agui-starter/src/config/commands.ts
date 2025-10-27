import { DEFAULT_UI_TERMS, type UiTerms } from "@/lib/ui-terms";
import type { Feature } from "@/lib/authz";

export type Command = {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  run?: () => void;
  href?: string;
  section?: string;
  keywords?: string;
  feature?: Feature;
};

function teamKeywords(terms: UiTerms): string {
  const lower = terms.team.toLowerCase();
  return `${lower} people staff list directory`;
}

function addTeamKeywords(terms: UiTerms): string {
  const lower = terms.team.toLowerCase();
  return `add ${lower} onboarding`;
}

export function createCommands(terms: UiTerms = DEFAULT_UI_TERMS): Command[] {
  return [
    {
      id: "employees",
      label: terms.team,
      href: "/employees",
      shortcut: "G E",
      keywords: teamKeywords(terms),
      feature: "team",
    },
    {
      id: "dtr-bulk",
      label: "DTR Bulk",
      href: "/payroll/dtr-bulk",
      shortcut: "G D",
      keywords: "time logs roster timesheet",
      feature: "dtr-bulk",
    },
    {
      id: "payroll",
      label: "Payroll",
      href: "/payroll",
      shortcut: "G P",
      keywords: "payslip run salary",
      feature: "payroll",
    },
    {
      id: "new-employee",
      label: `New ${terms.team}`,
      href: "/employees/new",
      shortcut: "N E",
      keywords: addTeamKeywords(terms),
      feature: "team",
    },
    {
      id: "new-payroll",
      label: "New Payroll",
      href: "/payroll/new",
      shortcut: "N P",
      keywords: "create payrun",
      feature: "payroll",
    },
    {
      id: "toggle-theme",
      label: "Toggle Theme",
      hint: "Switch theme",
      run: () =>
        document
          .querySelector<HTMLButtonElement>("[data-theme-toggle]")
          ?.click(),
      keywords: "dark light mode night",
    },
  ];
}
