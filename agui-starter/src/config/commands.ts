export type Command = {
  id: string;
  label: string;
  hint?: string;
  shortcut?: string;
  run?: () => void;
  href?: string;
  section?: string;
  keywords?: string;
};

export const commands: Command[] = [
  {
    id: "employees",
    label: "Employees",
    href: "/employees",
    shortcut: "G E",
    keywords: "people staff list directory",
  },
  {
    id: "dtr-bulk",
    label: "DTR Bulk",
    href: "/payroll/dtr-bulk",
    shortcut: "G D",
    keywords: "time logs roster timesheet",
  },
  {
    id: "payroll",
    label: "Payroll",
    href: "/payroll",
    shortcut: "G P",
    keywords: "payslip run salary",
  },
  {
    id: "new-employee",
    label: "New Employee",
    href: "/employees/new",
    shortcut: "N E",
    keywords: "add staff onboarding",
  },
  {
    id: "new-payroll",
    label: "New Payroll",
    href: "/payroll/new",
    shortcut: "N P",
    keywords: "create payrun",
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
