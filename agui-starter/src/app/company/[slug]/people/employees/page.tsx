import { RequireAnyFeature } from "@/components/auth/RequireAnyFeature";
import { AppFeature } from "@/lib/auth/permissions";

type CompanyEmployeesProps = {
  params: { slug: string };
};

export default function CompanyEmployees({ params }: CompanyEmployeesProps) {
  const dest = `/company/${params.slug}/people/employees`;

  return (
    <RequireAnyFeature
      feature={[AppFeature.TEAM, AppFeature.PAYROLL, AppFeature.DTR_BULK]}
      dest={dest}
    >
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">Review your roster and manage access.</p>
        </header>
        <div className="rounded-2xl border border-border bg-white p-6 text-sm text-muted-foreground shadow-sm">
          Employee directory coming soon.
        </div>
      </div>
    </RequireAnyFeature>
  );
}
