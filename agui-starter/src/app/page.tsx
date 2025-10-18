// agui-starter/src/app/page.tsx
"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { StatusHud } from "@/components/ui/status-hud";
import { ThemedLink } from "@/components/ui/themed-link";

const MODULE_LINKS = [
  { title: "Employees", href: "/employees", description: "Manage profiles, rates, and employee status." },
  { title: "Shifts", href: "/shifts", description: "Create and adjust work templates for your teams." },
  { title: "DTR Today", href: "/payroll/dtr-today", description: "Review daily time records for the current period." },
  { title: "Payroll Settings", href: "/payroll/settings", description: "Configure rules, cutoffs, and payout preferences." },
  { title: "Payroll Preview", href: "/payroll/preview", description: "Simulate payroll runs before finalizing payouts." },
  { title: "Bulk DTR", href: "/payroll/dtr-bulk", description: "Upload or edit month-long timekeeping records." },
  { title: "Deductions", href: "/payroll/deductions", description: "Track and manage payroll deduction schedules." },
  { title: "Payslip", href: "/payroll/payslip", description: "Generate printable payslips for individual staff." },
  { title: "Bulk Payslip", href: "/payroll/bulk-payslip", description: "Produce payslips for entire groups in a single run." },
];

/**
 * Step D: On Enter, open the global Command Palette and forward the query text.
 * Assumes <CommandPalette/> is mounted in layout.tsx and listens to Ctrl/Cmd+K.
 */
function handleHomeEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") {
    const text = (e.target as HTMLInputElement).value;

    // simulate Ctrl+K (Windows/Linux)
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    // simulate Cmd+K (macOS)
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));

    // forward the text into the palette shortly after it mounts/focuses
    setTimeout(() => {
      const paletteInput = document.querySelector<HTMLInputElement>(
        '.bg-card input[placeholder^="Type a command"]'
      );
      if (paletteInput) {
        paletteInput.value = text;
        paletteInput.dispatchEvent(new Event("input", { bubbles: true }));
        paletteInput.setSelectionRange(text.length, text.length);
        paletteInput.focus();
      }
    }, 10);
  }
}

export default function Home() {
  return (
    <main className="min-h-[calc(100dvh-4rem)] p-6 flex flex-col gap-8">
      <StatusHud className="mx-auto w-full max-w-4xl" />

      {/* Centered hero like Brave NTP */}
      <section className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-3xl">
          <h1 className="sr-only">Agui Starter Town</h1>

          {/* Big pill search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search commands, pages, or actions… then press Enter"
              className="w-full rounded-full border bg-background/80 backdrop-blur px-6 py-4 text-lg shadow-md outline-none focus:ring-2 focus:ring-primary/40"
              onKeyDown={handleHomeEnter}
              aria-label="Home launcher search"
              autoFocus
            />
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--agui-muted-foreground)] hidden sm:flex gap-1">
              <kbd className="px-2 py-1 border rounded">Ctrl</kbd>
              <span>+</span>
              <kbd className="px-2 py-1 border rounded">K</kbd>
            </div>
          </div>

          {/* Small hint */}
          <p className="mt-3 text-center text-sm text-[var(--agui-muted-foreground)]">
            Tip: Press <span className="font-medium">Ctrl/Cmd + K</span> anytime to open the Command Palette.
          </p>
        </div>
      </section>

      {/* Launcher tiles */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-[var(--agui-muted-foreground)] mb-3">
          Quick modules
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_LINKS.map((module) => (
            <Card
              key={module.href}
              className="p-5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lifted"
            >
              <div className="flex h-full flex-col justify-between gap-4">
                <div className="space-y-1.5">
                  <h3 className="text-lg font-semibold text-[var(--agui-on-surface)]">
                    {module.title}
                  </h3>
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
      </section>
    </main>
  );
}
