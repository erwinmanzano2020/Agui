import { loadUiConfig } from "@/lib/ui-config";
import { ModuleCard } from "@/components/ui/module-card";

export const metadata = {
  title: "Agui Hub",
};

export default async function AguiHub() {
  const { theme, toggles } = await loadUiConfig();

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Agui Hub</h1>
        <p className="text-sm opacity-75">
          Your open-world RPG ERP. Theme & toggles are live from Supabase.
        </p>
        <div className="text-xs opacity-70">
          Primary: <code>{theme.primary_hex}</code> • Accent:{" "}
          <code>{theme.accent}</code> • Radius: <code>{theme.radius}px</code>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ModuleCard
          name="Employees"
          subtitle="Guild roster"
          href="/employees"
          enabled={!!toggles.employees}
        />
        <ModuleCard
          name="Shifts"
          subtitle="Shift templates"
          href="/shifts"
          enabled={!!toggles.shifts}
        />
        <ModuleCard
          name="Payroll"
          subtitle="Payslip & preview"
          href="/payroll"
          enabled={!!toggles.payroll}
        />
        <ModuleCard
          name="POS"
          subtitle="Point of sale"
          href="/pos"
          enabled={!!toggles.pos}
        />
        <ModuleCard
          name="Settings"
          subtitle="Theme & modules"
          href="/settings"
          enabled={true}
        />
      </section>
    </div>
  );
}
