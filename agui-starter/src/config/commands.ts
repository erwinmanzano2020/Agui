import type { Command } from "../components/ui/command-palette";

export const commands: Command[] = [
  { id: "emp",   label: "Go to Employees",    href: "/employees", keywords: "people staff list" },
  { id: "dtr",   label: "Open DTR Bulk",      href: "/payroll/dtr-bulk", keywords: "time logs roster" },
  { id: "pay",   label: "Go to Payroll",      href: "/payroll", keywords: "payslip run" },
  { id: "newEmp",label: "New Employee",       href: "/employees/new", shortcut: "N E" },
  { id: "newPay",label: "New Payroll",        href: "/payroll/new", shortcut: "N P" },
  // example client actions:
  { id: "theme", label: "Toggle Dark/Light",  hint: "Switch theme", run: () => document.querySelector<HTMLButtonElement>('[data-theme-toggle]')?.click(), keywords: "night light" },
];
