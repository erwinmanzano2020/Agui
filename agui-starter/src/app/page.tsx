import { Card } from "@/components/ui/card";
import { ThemedLink } from "@/components/ui/themed-link";

const MODULE_LINKS = [
  {
    title: "Employees",
    href: "/employees",
    description: "Manage profiles, rates, and employee status.",
  },
  {
    title: "Shifts",
    href: "/shifts",
    description: "Create and adjust work templates for your teams.",
  },
  {
    title: "DTR Today",
    href: "/payroll/dtr-today",
    description: "Review daily time records for the current period.",
  },
  {
    title: "Payroll Settings",
    href: "/payroll/settings",
    description: "Configure rules, cutoffs, and payout preferences.",
  },
  {
    title: "Payroll Preview",
    href: "/payroll/preview",
    description: "Simulate payroll runs before finalizing payouts.",
  },
  {
    title: "Bulk DTR",
    href: "/payroll/dtr-bulk",
    description: "Upload or edit month-long timekeeping records.",
  },
  {
    title: "Deductions",
    href: "/payroll/deductions",
    description: "Track and manage payroll deduction schedules.",
  },
  {
    title: "Payslip",
    href: "/payroll/payslip",
    description: "Generate printable payslips for individual staff.",
  },
  {
    title: "Bulk Payslip",
    href: "/payroll/bulk-payslip",
    description: "Produce payslips for entire groups in a single run.",
  },
];

export default function Home() {
  return (
    <main className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Agui Starter Town</h1>
        <p className="text-sm text-[var(--agui-muted-foreground)]">
          Jump into a module below to see the live theme in action.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULE_LINKS.map((module) => (
          <Card
            key={module.href}
            className="p-5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lifted"
          >
            <div className="flex h-full flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-[var(--agui-on-surface)]">
                  {module.title}
                </h2>
                <p className="text-sm text-[var(--agui-muted-foreground)]">
                  {module.description}
                </p>
              </div>
              <ThemedLink href={module.href} className="w-fit">
                Open module →
              </ThemedLink>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
