import { AppFeature } from "@/lib/auth/permissions";
import { DEFAULT_UI_TERMS, type UiTerms } from "@/lib/ui-terms";

export type CommandDefinition = {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  run?: () => void;
  href?: string;
  section?: string;
  keywords?: string;
  feature?: AppFeature;
};

function teamKeywords(terms: UiTerms): string {
  const lower = terms.team.toLowerCase();
  return `${lower} people staff list directory`;
}

function addTeamKeywords(terms: UiTerms): string {
  const lower = terms.team.toLowerCase();
  return `add ${lower} onboarding`;
}

export function getCommandRegistry(terms: UiTerms = DEFAULT_UI_TERMS): CommandDefinition[] {
  return [
    {
      id: "employees",
      label: terms.team,
      href: "/employees",
      shortcut: "G E",
      keywords: teamKeywords(terms),
      feature: AppFeature.TEAM,
    },
    {
      id: "dtr-bulk",
      label: "DTR Bulk",
      href: "/payroll/dtr-bulk",
      shortcut: "G D",
      keywords: "time logs roster timesheet",
      feature: AppFeature.DTR_BULK,
    },
    {
      id: "payroll",
      label: "Payroll",
      href: "/payroll",
      shortcut: "G P",
      keywords: "payslip run salary",
      feature: AppFeature.PAYROLL,
    },
    {
      id: "new-employee",
      label: `New ${terms.team}`,
      href: "/employees/new",
      shortcut: "N E",
      keywords: addTeamKeywords(terms),
      feature: AppFeature.TEAM,
    },
    {
      id: "new-payroll",
      label: "New Payroll",
      href: "/payroll/new",
      shortcut: "N P",
      keywords: "create payrun",
      feature: AppFeature.PAYROLL,
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
